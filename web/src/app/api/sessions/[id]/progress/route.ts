import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { sessions, sessionProgress } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { studentName, questionIndex, isCorrect, totalQuestions } = body;

  if (!studentName || questionIndex === undefined || isCorrect === undefined || !totalQuestions) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
  if (!session?.isActive) {
    return NextResponse.json({ error: 'Session not found or inactive' }, { status: 404 });
  }

  const isFinished = questionIndex + 1 >= totalQuestions;
  const newScore = isCorrect ? 1 : 0;

  await db
    .insert(sessionProgress)
    .values({
      sessionId: id,
      studentName,
      currentQuestion: questionIndex + 1,
      score: newScore,
      totalQuestions,
      isFinished,
      updatedAt: sql`now()`,
    })
    .onConflictDoUpdate({
      target: [sessionProgress.sessionId, sessionProgress.studentName],
      set: {
        currentQuestion: questionIndex + 1,
        score: sql`session_progress.score + ${newScore}`,
        totalQuestions,
        isFinished,
        updatedAt: sql`now()`,
      },
    });

  return NextResponse.json({ ok: true });
}
