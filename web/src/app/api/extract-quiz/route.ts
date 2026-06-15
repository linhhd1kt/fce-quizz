import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buf: Buffer, opts?: { max?: number }) => Promise<{ text: string; numpages: number }>;
import OpenAI from 'openai';

export const maxDuration = 60;

const execFileAsync = promisify(execFile);
const GITHUB_MODELS_URL = 'https://models.inference.ai.azure.com';

const TEXT_PROMPT = `You are an expert exam question extractor.
Given text from a PDF, extract all multiple-choice questions and return structured JSON.
- Extract ONLY multiple-choice questions (A/B/C/D options)
- "answer" must EXACTLY match one of the strings in "options"
- "explanation": 2-3 sentences explaining why the correct answer is right
- For cloze: text = "Question N: Choose the correct word", options = the word choices
Return ONLY this JSON (no markdown):
{"title":"quiz title","questions":[{"id":"q-1","type":"multiple-choice","text":"...","options":["..."],"answer":"exact match","explanation":"..."}]}`;

const VISION_PROMPT = `You are an expert exam question extractor.
These are scanned exam pages. Extract all multiple-choice questions visible.
- Extract ONLY multiple-choice questions (A/B/C/D or A/B/C)
- "answer" must EXACTLY match one of the strings in "options"
- "explanation": 2-3 sentences explaining why the correct answer is right
- If answer key is visible, use it; otherwise use your best judgment
Return ONLY this JSON (no markdown):
{"title":"quiz title","questions":[{"id":"q-1","type":"multiple-choice","text":"...","options":["..."],"answer":"exact match","explanation":"..."}]}`;

function isScanned(text: string, numPages: number): boolean {
  return text.length / Math.max(numPages, 1) < 100;
}

function validate(questions: unknown[]): Record<string, unknown>[] {
  return (questions as Record<string, unknown>[]).filter((q) => {
    const opts = q.options as string[] | undefined;
    return Array.isArray(opts) && opts.length >= 2 && opts.includes(q.answer as string);
  });
}

async function pdfToJpegBase64(buffer: Buffer, maxPages = 20): Promise<string[]> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfquiz-'));
  const pdfPath = path.join(tmpDir, 'input.pdf');
  const outPrefix = path.join(tmpDir, 'page');

  try {
    fs.writeFileSync(pdfPath, buffer);
    await execFileAsync('pdftoppm', [
      '-r', '120',       // 120 DPI — legible but not too large
      '-jpeg',
      '-l', String(maxPages),
      pdfPath,
      outPrefix,
    ]);

    return fs.readdirSync(tmpDir)
      .filter((f) => f.endsWith('.jpg') || f.endsWith('.jpeg'))
      .sort()
      .map((f) => {
        const img = fs.readFileSync(path.join(tmpDir, f));
        return `data:image/jpeg;base64,${img.toString('base64')}`;
      });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function callAI(client: OpenAI, prompt: string, userContent: OpenAI.Chat.ChatCompletionContentPart[]): Promise<{ title?: string; questions?: unknown[] }> {
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: userContent },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 4096,
  });
  return JSON.parse(response.choices[0].message.content ?? '{}');
}

export async function POST(req: NextRequest) {
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    return NextResponse.json({ error: 'Server not configured (missing GITHUB_TOKEN).' }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file || file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Please upload a PDF file.' }, { status: 400 });
  }

  if (file.size > 100 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large. Maximum 100MB.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const client = new OpenAI({ baseURL: GITHUB_MODELS_URL, apiKey: githubToken });

  // Try text extraction
  let pdfText = '';
  let numPages = 0;
  let scanned = false;

  try {
    const data = await pdfParse(buffer, { max: 30 });
    pdfText = data.text;
    numPages = data.numpages;
    scanned = isScanned(pdfText, numPages);
  } catch (e) {
    console.error('[extract-quiz] pdf-parse error:', e instanceof Error ? e.message : e);
    scanned = true;
  }

  let aiResult: { title?: string; questions?: unknown[] };

  try {
    if (scanned) {
      console.log('[extract-quiz] scanned PDF — using vision (pdftoppm + gpt-4o)');
      const images = await pdfToJpegBase64(buffer, 20);

      if (images.length === 0) {
        return NextResponse.json({ error: 'Could not render PDF pages. Make sure pdftoppm is installed on the server.' }, { status: 500 });
      }

      // Process in batches of 5 pages
      const BATCH = 5;
      aiResult = {};
      for (let i = 0; i < images.length; i += BATCH) {
        const batch = images.slice(i, i + BATCH);
        const content: OpenAI.Chat.ChatCompletionContentPart[] = [
          { type: 'text', text: `Pages ${i + 1}–${i + batch.length} of "${file.name}". Extract MCQ questions.` },
          ...batch.map((url): OpenAI.Chat.ChatCompletionContentPart => ({
            type: 'image_url',
            image_url: { url, detail: 'high' },
          })),
        ];
        const result = await callAI(client, VISION_PROMPT, content);
        if (!aiResult.title) aiResult.title = result.title;
        aiResult.questions = [...(aiResult.questions ?? []), ...(result.questions ?? [])];
      }
    } else {
      const chunk = pdfText.slice(0, 12000);
      const content: OpenAI.Chat.ChatCompletionContentPart[] = [
        { type: 'text', text: `Extract MCQ questions from this PDF text:\n\n${chunk}` },
      ];
      aiResult = await callAI(client, TEXT_PROMPT, content);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[extract-quiz] AI error:', msg);
    return NextResponse.json({ error: `AI extraction failed: ${msg}` }, { status: 502 });
  }

  const valid = validate(aiResult.questions ?? []);
  if (valid.length === 0) {
    return NextResponse.json(
      { error: 'No multiple-choice questions found. Try uploading a specific section (e.g. pages 10–30) rather than the full book.' },
      { status: 422 },
    );
  }

  return NextResponse.json({
    id: `upload-${Date.now()}`,
    title: aiResult.title ?? file.name.replace('.pdf', ''),
    description: `AI-extracted from ${file.name}${scanned ? ' (vision OCR)' : ''} · ${numPages || '?'} pages`,
    source: file.name,
    totalQuestions: valid.length,
    questions: valid,
  });
}
