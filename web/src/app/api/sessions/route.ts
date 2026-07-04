import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { sessions, quizzes } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getAuthUserId } from '@/lib/server-auth';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateCode() {
  return Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}

export async function GET() {
  const teacherId = await getAuthUserId();
  if (!teacherId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await db
    .select({
      id: sessions.id,
      code: sessions.code,
      status: sessions.status,
      isActive: sessions.isActive,
      createdAt: sessions.createdAt,
      quizTitle: quizzes.title,
      quizId: sessions.quizId,
      batchId: sessions.batchId,
      batchOrder: sessions.batchOrder,
      lobbyCount: sql<number>`(SELECT COUNT(*) FROM session_progress WHERE session_id = ${sessions.id})::int`,
      finishedCount: sql<number>`(SELECT COUNT(*) FROM session_progress WHERE session_id = ${sessions.id} AND is_finished = true)::int`,
    })
    .from(sessions)
    .leftJoin(quizzes, eq(sessions.quizId, quizzes.id))
    .where(eq(sessions.teacherId, teacherId))
    .orderBy(sessions.createdAt);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const teacherId = await getAuthUserId();
  if (!teacherId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { quizId } = await req.json();
  if (!quizId) return NextResponse.json({ error: 'quizId required' }, { status: 400 });

  const [quiz] = await db.select({ teacherId: quizzes.teacherId }).from(quizzes).where(eq(quizzes.id, quizId));
  if (!quiz || quiz.teacherId !== teacherId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let code: string;
  let tries = 0;
  do {
    code = generateCode();
    tries++;
    if (tries > 10) return NextResponse.json({ error: 'Failed to generate a unique room code' }, { status: 500 });
    const existing = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.code, code));
    if (!existing.length) break;
  } while (true);

  const [session] = await db.insert(sessions).values({ quizId, teacherId, code }).returning();
  return NextResponse.json(session, { status: 201 });
}
