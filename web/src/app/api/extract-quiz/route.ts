import { NextRequest, NextResponse } from 'next/server';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buf: Buffer, opts?: { max?: number }) => Promise<{ text: string; numpages: number }>;
import OpenAI from 'openai';

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are an expert exam question extractor.
Given text extracted from a PDF textbook or exam paper, extract all multiple-choice questions and return structured JSON.

Rules:
- Extract ONLY multiple-choice questions (with clearly defined A/B/C/D options)
- "answer" must EXACTLY match one of the strings in "options"
- "explanation": 2-3 sentences explaining why the correct answer is right
- If no clear answer key is visible, make your best judgment based on context
- For cloze/fill-the-gap: text = "Question N: Choose the correct word", options = the word choices
- For comprehension: text = the actual question, context = the passage if present

Return ONLY this JSON (no markdown, no extra text):
{
  "title": "inferred quiz title (e.g. book name + section)",
  "questions": [
    {
      "id": "q-1",
      "type": "multiple-choice",
      "text": "question text",
      "context": "optional passage text",
      "options": ["A text", "B text", "C text", "D text"],
      "answer": "exact match of correct option",
      "explanation": "why this answer is correct"
    }
  ]
}`;

function detectPoorQuality(text: string, numPages: number): boolean {
  const avgCharsPerPage = text.length / Math.max(numPages, 1);
  return avgCharsPerPage < 100;
}

export async function POST(req: NextRequest) {
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    return NextResponse.json(
      { error: 'Server is not configured (missing GITHUB_TOKEN).' },
      { status: 500 },
    );
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

  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large. Maximum 20MB.' }, { status: 400 });
  }

  // Extract text from PDF
  let pdfText = '';
  let numPages = 0;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const data = await pdfParse(buffer, { max: 30 }); // max 30 pages
    pdfText = data.text;
    numPages = data.numpages;
  } catch {
    return NextResponse.json(
      { error: 'Could not read PDF. The file may be corrupted or password-protected.' },
      { status: 422 },
    );
  }

  if (detectPoorQuality(pdfText, numPages)) {
    return NextResponse.json(
      {
        error:
          'This PDF appears to be scanned (image-based). ' +
          'Web upload only supports text-based PDFs. ' +
          'For scanned books, use the Python extractor tool.',
      },
      { status: 422 },
    );
  }

  // Truncate to ~12k chars to fit context window
  const chunk = pdfText.slice(0, 12000);

  // Call GitHub Models API (gpt-4o)
  const client = new OpenAI({
    baseURL: 'https://models.inference.ai.azure.com',
    apiKey: githubToken,
  });

  let aiResult: { title?: string; questions?: unknown[] };
  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Extract multiple-choice questions from this PDF text:\n\n${chunk}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 4096,
    });
    aiResult = JSON.parse(response.choices[0].message.content ?? '{}');
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: `AI extraction failed: ${msg}` }, { status: 502 });
  }

  const questions = (aiResult.questions ?? []) as Record<string, unknown>[];
  const valid = questions.filter((q) => {
    const opts = q.options as string[] | undefined;
    return Array.isArray(opts) && opts.includes(q.answer as string);
  });

  if (valid.length === 0) {
    return NextResponse.json(
      { error: 'No multiple-choice questions found in this PDF. Try a different section or file.' },
      { status: 422 },
    );
  }

  const quizId = `upload-${Date.now()}`;
  const quizSet = {
    id: quizId,
    title: aiResult.title ?? file.name.replace('.pdf', ''),
    description: `AI-extracted from ${file.name} (${numPages} pages)`,
    source: file.name,
    totalQuestions: valid.length,
    questions: valid,
  };

  return NextResponse.json(quizSet);
}
