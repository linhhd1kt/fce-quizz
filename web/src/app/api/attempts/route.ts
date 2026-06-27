import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { attempts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const [attempt] = await db.insert(attempts).values({
    sessionId: body.sessionId,
    quizId: body.quizId,
    studentName: body.studentName,
    score: body.score,
    totalQuestions: body.totalQuestions,
    timeSpentMs: body.timeSpentMs,
    answers: body.answers,
  }).returning();
  return NextResponse.json(attempt, { status: 201 });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  const studentName = searchParams.get('studentName');
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

  const conditions = studentName
    ? and(eq(attempts.sessionId, sessionId), eq(attempts.studentName, studentName))
    : eq(attempts.sessionId, sessionId);

  const data = await db.select().from(attempts).where(conditions).orderBy(attempts.completedAt);
  return NextResponse.json(data);
}
