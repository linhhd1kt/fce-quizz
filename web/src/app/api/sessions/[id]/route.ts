import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { sessions, quizzes, attempts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthUserId } from '@/lib/server-auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const teacherId = await getAuthUserId();
  if (!teacherId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const [session] = await db
    .select({ id: sessions.id, code: sessions.code, isActive: sessions.isActive, createdAt: sessions.createdAt, quiz: quizzes })
    .from(sessions)
    .leftJoin(quizzes, eq(sessions.quizId, quizzes.id))
    .where(eq(sessions.id, id));

  if (!session || session.quiz?.teacherId !== teacherId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const sessionAttempts = await db.select().from(attempts).where(eq(attempts.sessionId, id)).orderBy(attempts.completedAt);
  return NextResponse.json({ session, attempts: sessionAttempts });
}
