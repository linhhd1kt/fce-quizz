import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { attempts, sessions } from '@/db/schema';
import { eq, desc, asc } from 'drizzle-orm';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [session] = await db
    .select({ id: sessions.id, status: sessions.status })
    .from(sessions)
    .where(eq(sessions.id, id));

  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const results = await db
    .select({
      studentName: attempts.studentName,
      score: attempts.score,
      totalQuestions: attempts.totalQuestions,
      timeSpentMs: attempts.timeSpentMs,
    })
    .from(attempts)
    .where(eq(attempts.sessionId, id))
    .orderBy(desc(attempts.score), asc(attempts.timeSpentMs));

  return NextResponse.json({
    sessionStatus: session.status,
    entries: results.map((r, idx) => ({
      rank: idx + 1,
      studentName: r.studentName,
      score: r.score,
      totalQuestions: r.totalQuestions,
      timeSpentMs: r.timeSpentMs,
    })),
  });
}
