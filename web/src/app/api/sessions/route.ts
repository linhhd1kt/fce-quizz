import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { sessions, quizzes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthUserId } from '@/lib/server-auth';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateCode() {
  return Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}

export async function GET() {
  const teacherId = await getAuthUserId();
  if (!teacherId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await db
    .select({ id: sessions.id, code: sessions.code, isActive: sessions.isActive, createdAt: sessions.createdAt, quizTitle: quizzes.title, quizId: sessions.quizId, batchId: sessions.batchId, batchOrder: sessions.batchOrder })
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
  let code: string;
  let tries = 0;
  do {
    code = generateCode();
    tries++;
    if (tries > 10) return NextResponse.json({ error: 'Không thể tạo mã phòng' }, { status: 500 });
    const existing = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.code, code));
    if (!existing.length) break;
  } while (true);

  const [session] = await db.insert(sessions).values({ quizId, teacherId, code }).returning();
  return NextResponse.json(session, { status: 201 });
}
