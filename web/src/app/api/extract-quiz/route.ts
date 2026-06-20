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

const BASE_RULES = `
EXTRACT: Only questions with explicit A/B/C/D (or A/B/C) answer choices.
SKIP entirely: Writing tasks, open cloze (fill one word, no choices given), word formation, key word transformations, sentence completion without choices, Speaking tasks.

QUESTION TYPES:
- MCQ Cloze (FCE Part 1): text = the full sentence containing the numbered gap, e.g. "Scientists discovered they can also be .......... to good use as a material." Options = the 4 words shown below the passage (e.g. "made", "put", "given", "got"). Do NOT include "A/B/C/D" labels in options.
- Reading MCQ (FCE Part 5/6/7): text = the question stem. Options = the 4 answer choices as full phrases/sentences. Do NOT include "A/B/C/D" labels.
- Listening MCQ: text = the situation description + question. Options = the 3 answer choices as full phrases. Do NOT include "A/B/C/D" labels.

CRITICAL RULES:
- "options": array of EXACT TEXT from the exam — NO "A.", "B.", "C.", "D." prefix labels.
- "answer": must be the EXACT same string as one of the "options" values.
- "explanation": 2-3 sentences explaining why this answer is correct and others are wrong.
- If an answer key is visible anywhere on the page, use it. Otherwise use your best judgment.
- Never omit a question due to uncertainty about the answer.`;

const TEXT_PROMPT = `You are an expert Cambridge/FCE exam question extractor.
${BASE_RULES}

Return ONLY valid JSON (no markdown, no extra text):
{"title":"quiz title","questions":[{"id":"q-1","type":"multiple-choice","text":"Full question text here","options":["first option","second option","third option","fourth option"],"answer":"exact matching option","explanation":"..."}]}`;

const VISION_PROMPT = `You are an expert Cambridge/FCE exam question extractor reviewing scanned exam pages.
${BASE_RULES}

Return ONLY valid JSON (no markdown, no extra text):
{"title":"quiz title","questions":[{"id":"q-1","type":"multiple-choice","text":"Full question text here","options":["first option","second option","third option","fourth option"],"answer":"exact matching option","explanation":"..."}]}`;

type PageRange = { from: number; to: number };

function parsePageRange(input: string): PageRange[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((part) => {
      const m = part.match(/^(\d+)(?:-(\d+))?$/);
      if (!m) return [];
      const from = parseInt(m[1]);
      const to = m[2] ? parseInt(m[2]) : from;
      return from <= to ? [{ from, to }] : [];
    });
}

async function detectMCQPageRanges(buffer: Buffer): Promise<PageRange[]> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfdetect-'));
  const pdfPath = path.join(tmpDir, 'input.pdf');
  try {
    fs.writeFileSync(pdfPath, buffer);
    const { stdout } = await execFileAsync('pdftotext', [pdfPath, '-'], {
      maxBuffer: 20 * 1024 * 1024,
    });

    // Split by form-feed (page separator)
    const pages = stdout.split('\f');
    const mcqPages = new Set<number>();

    pages.forEach((text, idx) => {
      const pageNum = idx + 1;
      // Detect A/B/C options: lines starting with A/B or inline "A word B word C word"
      const hasOptions =
        (/^\s*A[\s.]\s*\S/m.test(text) && /^\s*B[\s.]\s*\S/m.test(text)) ||
        /\bA\b[\s\S]{1,40}\bB\b[\s\S]{1,40}\bC\b/.test(text);

      if (hasOptions) {
        // Include previous page too (passage text is usually on the page before options)
        if (pageNum > 1) mcqPages.add(pageNum - 1);
        mcqPages.add(pageNum);
      }
    });

    const sorted = Array.from(mcqPages).sort((a, b) => a - b);
    const ranges: PageRange[] = [];
    for (const p of sorted) {
      if (!ranges.length || p > ranges[ranges.length - 1].to + 2) {
        ranges.push({ from: p, to: p });
      } else {
        ranges[ranges.length - 1].to = p;
      }
    }
    return ranges;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function isScanned(text: string, numPages: number): boolean {
  return text.length / Math.max(numPages, 1) < 100;
}

// Strip "A. " / "A) " / "A " prefix if AI adds them despite instructions
function normalizeQuestion(q: Record<string, unknown>): Record<string, unknown> {
  const opts = q.options as unknown[];
  if (!Array.isArray(opts) || opts.length < 2) return q;

  const strs = opts.map((o) => String(o));
  const anyHasPrefix = strs.some((o) => /^[A-Da-d][.)]\s+/.test(o));
  if (!anyHasPrefix) return q;

  const stripped = strs.map((o) => o.replace(/^[A-Da-d][.)]\s+/, '').trim());
  let answer = String(q.answer ?? '').replace(/^[A-Da-d][.)]\s+/, '').trim();

  // If answer is just a letter like "A", map it to the corresponding option
  if (/^[A-Da-d]$/.test(answer)) {
    const idx = answer.toUpperCase().charCodeAt(0) - 65;
    answer = stripped[idx] ?? answer;
  }

  return { ...q, options: stripped, answer };
}

function extractJSON(text: string): { title?: string; questions?: unknown[] } {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch { /* fall through */ }

  // Strip markdown fences
  const stripped = text
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/m, '')
    .trim();
  try {
    return JSON.parse(stripped);
  } catch { /* fall through */ }

  // Find first { ... } block
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch { /* fall through */ }
  }

  console.warn('[extract-quiz] Could not parse AI response as JSON');
  return {};
}

function validate(questions: unknown[]): Record<string, unknown>[] {
  return (questions as Record<string, unknown>[])
    .map(normalizeQuestion)
    .filter((q) => {
      const opts = q.options as string[] | undefined;
      return Array.isArray(opts) && opts.length >= 2 && opts.includes(q.answer as string);
    });
}

async function pdfToJpegBase64(buffer: Buffer, ranges?: PageRange[]): Promise<string[]> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfquiz-'));
  const pdfPath = path.join(tmpDir, 'input.pdf');

  try {
    fs.writeFileSync(pdfPath, buffer);
    const allImages: string[] = [];

    if (ranges && ranges.length > 0) {
      for (const range of ranges) {
        const rangeDir = path.join(tmpDir, `r${range.from}`);
        fs.mkdirSync(rangeDir);
        await execFileAsync('pdftoppm', [
          '-r', '120', '-jpeg',
          '-f', String(range.from),
          '-l', String(range.to),
          pdfPath,
          path.join(rangeDir, 'page'),
        ]);
        const imgs = fs.readdirSync(rangeDir)
          .filter((f) => f.endsWith('.jpg') || f.endsWith('.jpeg'))
          .sort()
          .map((f) => `data:image/jpeg;base64,${fs.readFileSync(path.join(rangeDir, f)).toString('base64')}`);
        allImages.push(...imgs);
      }
    } else {
      await execFileAsync('pdftoppm', [
        '-r', '120', '-jpeg',
        '-l', '20',
        pdfPath,
        path.join(tmpDir, 'page'),
      ]);
      allImages.push(
        ...fs.readdirSync(tmpDir)
          .filter((f) => f.startsWith('page') && (f.endsWith('.jpg') || f.endsWith('.jpeg')))
          .sort()
          .map((f) => `data:image/jpeg;base64,${fs.readFileSync(path.join(tmpDir, f)).toString('base64')}`),
      );
    }

    return allImages;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function callAI(
  client: OpenAI,
  systemPrompt: string,
  userContent: OpenAI.Chat.ChatCompletionContentPart[],
): Promise<{ title?: string; questions?: unknown[] }> {
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4096,
    temperature: 0.1,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  });
  const text = response.choices[0]?.message?.content ?? '{}';
  return extractJSON(text);
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GITHUB_TOKEN;
  if (!apiKey) {
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

  const pageRangeStr = (formData.get('pageRange') as string | null) ?? '';
  const autoDetect = (formData.get('autoDetect') as string | null) !== 'false';

  const buffer = Buffer.from(await file.arrayBuffer());
  const client = new OpenAI({ baseURL: 'https://models.inference.ai.azure.com', apiKey });

  // Determine page ranges to use
  let ranges: PageRange[] | undefined;
  let forceVision = false;

  if (pageRangeStr.trim()) {
    ranges = parsePageRange(pageRangeStr);
    forceVision = ranges.length > 0;
    console.log('[extract-quiz] Manual page range:', ranges);
  } else if (autoDetect) {
    try {
      ranges = await detectMCQPageRanges(buffer);
      if (ranges.length > 0) {
        forceVision = true;
        console.log('[extract-quiz] Auto-detected MCQ ranges:', ranges);
      }
    } catch (e) {
      console.warn('[extract-quiz] Auto-detect failed, falling back to full scan:', e instanceof Error ? e.message : e);
    }
  }

  // Detect if PDF is scanned (unless we're already forcing vision)
  let pdfText = '';
  let numPages = 0;
  let scanned = forceVision;

  if (!forceVision) {
    try {
      const data = await pdfParse(buffer, { max: 30 });
      pdfText = data.text;
      numPages = data.numpages;
      scanned = isScanned(pdfText, numPages);
    } catch (e) {
      console.error('[extract-quiz] pdf-parse error:', e instanceof Error ? e.message : e);
      scanned = true;
    }
  }

  let aiResult: { title?: string; questions?: unknown[] };

  try {
    if (scanned || forceVision) {
      const modeLabel = ranges?.length ? `pages ${ranges.map((r) => `${r.from}-${r.to}`).join(', ')}` : 'all pages (vision)';
      console.log(`[extract-quiz] Vision mode — ${modeLabel}`);
      const images = await pdfToJpegBase64(buffer, ranges);

      if (images.length === 0) {
        return NextResponse.json(
          { error: 'Could not render PDF pages. Make sure pdftoppm is installed on the server.' },
          { status: 500 },
        );
      }

      const BATCH = 5;
      aiResult = {};
      let questionOffset = 0;
      for (let i = 0; i < images.length; i += BATCH) {
        const batch = images.slice(i, i + BATCH);
        const content: OpenAI.Chat.ChatCompletionContentPart[] = [
          {
            type: 'text',
            text: `Pages ${i + 1}–${i + batch.length}. Continue from q-${questionOffset + 1}. Extract ALL MCQ questions with A/B/C/D options. Skip non-MCQ sections.`,
          },
          ...batch.map((url): OpenAI.Chat.ChatCompletionContentPartImage => ({
            type: 'image_url',
            image_url: { url, detail: 'high' },
          })),
        ];
        const result = await callAI(client, VISION_PROMPT, content);
        if (!aiResult.title) aiResult.title = result.title;
        const batchQs = result.questions ?? [];
        aiResult.questions = [...(aiResult.questions ?? []), ...batchQs];
        questionOffset += batchQs.length;
      }
    } else {
      // Text mode: chunk through entire text
      const CHUNK = 15000;
      aiResult = {};
      let questionOffset = 0;
      for (let i = 0; i < pdfText.length; i += CHUNK) {
        const chunk = pdfText.slice(i, i + CHUNK);
        const content: OpenAI.Chat.ChatCompletionContentPart[] = [
          {
            type: 'text',
            text: `Part ${Math.floor(i / CHUNK) + 1}. Continue from q-${questionOffset + 1}. Extract ALL MCQ questions with A/B/C/D options. Skip non-MCQ sections (Writing, open cloze, word formation, key word transformations).\n\n${chunk}`,
          },
        ];
        const result = await callAI(client, TEXT_PROMPT, content);
        if (!aiResult.title) aiResult.title = result.title;
        const batchQs = result.questions ?? [];
        aiResult.questions = [...(aiResult.questions ?? []), ...batchQs];
        questionOffset += batchQs.length;
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[extract-quiz] AI error:', msg);
    return NextResponse.json({ error: `AI extraction failed: ${msg}` }, { status: 502 });
  }

  const valid = validate(aiResult.questions ?? []);
  if (valid.length === 0) {
    return NextResponse.json(
      { error: 'No multiple-choice questions found. Try specifying a page range (e.g. 8-19) or check that the PDF contains A/B/C/D questions.' },
      { status: 422 },
    );
  }

  const rangeLabel = ranges?.length ? ` (pages ${ranges.map((r) => `${r.from}–${r.to}`).join(', ')})` : '';
  return NextResponse.json({
    id: `upload-${Date.now()}`,
    title: aiResult.title ?? file.name.replace('.pdf', ''),
    description: `AI-extracted from ${file.name}${rangeLabel}${scanned ? ' (vision OCR)' : ''} · ${numPages || '?'} pages`,
    source: file.name,
    totalQuestions: valid.length,
    questions: valid,
  });
}
