import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { sessions, quizzes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthUserId } from '@/lib/server-auth';
import type { MultipleChoiceQuestion } from '@/types/quiz';
import { chunkByTargetGames } from '@/lib/chunk-by-target-games';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateCode() {
  return Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}

async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = generateCode();
    const existing = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.code, code));
    if (!existing.length) return code;
  }
  throw new Error('Could not generate unique code');
}

export async function POST(req: NextRequest) {
  const teacherId = await getAuthUserId();
  if (!teacherId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { quizId, batchSize, targetGames } = await req.json();
  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, quizId));
  if (!quiz || quiz.teacherId !== teacherId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const allQuestions = quiz.questions as MultipleChoiceQuestion[];
  if (allQuestions.length === 0) return NextResponse.json({ error: 'Quiz has no questions' }, { status: 400 });
  if (targetGames != null && targetGames > 20) return NextResponse.json({ error: 'targetGames exceeds maximum of 20' }, { status: 400 });

  let chunks: MultipleChoiceQuestion[][];
  if (targetGames != null) {
    chunks = chunkByTargetGames(allQuestions, targetGames);
  } else {
    const size = Math.max(5, Math.min(50, batchSize ?? 15));
    chunks = [];
    for (let i = 0; i < allQuestions.length; i += size) {
      chunks.push(allQuestions.slice(i, i + size));
    }
  }

  const batchId = crypto.randomUUID();
  const parts: { id: string; code: string; batchOrder: number; questionCount: number }[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const code = await uniqueCode();
    const [s] = await db.insert(sessions).values({
      quizId,
      teacherId,
      code,
      questionsSubset: chunks[i],
      batchId,
      batchOrder: i + 1,
    }).returning();
    parts.push({ id: s.id, code: s.code, batchOrder: i + 1, questionCount: chunks[i].length });
  }

  return NextResponse.json({ batchId, quizTitle: quiz.title, parts }, { status: 201 });
}
