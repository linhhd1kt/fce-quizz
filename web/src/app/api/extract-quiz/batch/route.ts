import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { db } from '@/db/client';
import { quizzes } from '@/db/schema';
import { getAuthTeacherId } from '@/lib/server-auth';
import { extractQuestionsFromRange } from '../route';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const teacherId = await getAuthTeacherId();
  if (!teacherId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.GITHUB_TOKEN;
  if (!apiKey) return NextResponse.json({ error: 'Server not configured.' }, { status: 500 });

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

  const rangesStr = formData.get('ranges') as string | null;
  if (!rangesStr) return NextResponse.json({ error: 'ranges is required.' }, { status: 400 });

  let ranges: { name: string; from: number; to: number }[];
  try {
    ranges = JSON.parse(rangesStr);
  } catch {
    return NextResponse.json({ error: 'Invalid ranges JSON.' }, { status: 400 });
  }

  if (!Array.isArray(ranges) || ranges.length === 0) {
    return NextResponse.json({ error: 'At least one range is required.' }, { status: 400 });
  }

  const timePerQuestion = parseInt((formData.get('timePerQuestion') as string | null) ?? '45') || 45;
  const buffer = Buffer.from(await file.arrayBuffer());
  const client = new OpenAI({ baseURL: 'https://models.inference.ai.azure.com', apiKey });

  const TARGET = 15;

  function chunkEvenly<T>(arr: T[]): T[][] {
    const n = arr.length;
    if (n <= 16) return [arr];
    const numParts = Math.round(n / TARGET);
    const size = Math.ceil(n / numParts);
    const chunks: T[][] = [];
    for (let i = 0; i < n; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
  }

  const created: { id: string; title: string; questionCount: number }[] = [];

  for (const range of ranges) {
    try {
      const { title, questions } = await extractQuestionsFromRange(buffer, range, client);
      if (questions.length === 0) {
        console.warn(`[extract-quiz/batch] No questions found for range ${range.from}-${range.to}`);
        continue;
      }

      const baseName = range.name || title || file.name.replace(/\.pdf$/i, '');
      const chunks = chunkEvenly(questions);

      for (let i = 0; i < chunks.length; i++) {
        const chunkTitle = chunks.length === 1 ? baseName : `${baseName} (${i + 1}/${chunks.length})`;
        const [quiz] = await db.insert(quizzes).values({
          teacherId,
          title: chunkTitle,
          description: `AI-extracted from pages ${range.from}–${range.to}`,
          source: file.name,
          timePerQuestion,
          questions: chunks[i],
          skippedSections: null,
        }).returning();
        created.push({ id: quiz.id, title: quiz.title, questionCount: chunks[i].length });
      }
    } catch (e) {
      console.error(`[extract-quiz/batch] Failed for range ${range.from}-${range.to}:`, e instanceof Error ? e.message : e);
    }
  }

  if (created.length === 0) {
    return NextResponse.json({ error: 'No questions found in any of the specified ranges.' }, { status: 422 });
  }

  return NextResponse.json({ quizzes: created }, { status: 201 });
}
