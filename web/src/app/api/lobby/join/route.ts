import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { sessions, sessionProgress } from '@/db/schema';
import { ilike, sql } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { code, studentName } = body as { code?: string; studentName?: string };

  if (!code || !studentName) {
    return NextResponse.json({ error: 'code and studentName required' }, { status: 400 });
  }

  const [session] = await db
    .select({ id: sessions.id, status: sessions.status })
    .from(sessions)
    .where(ilike(sessions.code, code));

  if (!session || session.status === 'ended') {
    return NextResponse.json({ error: 'Session not found or ended' }, { status: 404 });
  }

  await db
    .insert(sessionProgress)
    .values({
      sessionId: session.id,
      studentName,
      currentQuestion: 0,
      score: 0,
      totalQuestions: 0,
      isFinished: false,
      updatedAt: sql`now()`,
    })
    .onConflictDoUpdate({
      target: [sessionProgress.sessionId, sessionProgress.studentName],
      set: { updatedAt: sql`now()` },
    });

  return NextResponse.json({ ok: true, sessionId: session.id, status: session.status });
}
