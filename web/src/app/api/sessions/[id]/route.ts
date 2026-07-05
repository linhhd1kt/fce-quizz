import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { sessions, quizzes, attempts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthTeacherId } from '@/lib/server-auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const teacherId = await getAuthTeacherId();
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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const teacherId = await getAuthTeacherId();
  if (!teacherId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const [session] = await db
    .select({ id: sessions.id, batchId: sessions.batchId })
    .from(sessions)
    .where(and(eq(sessions.id, id), eq(sessions.teacherId, teacherId)));

  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (session.batchId) {
    await db.delete(sessions).where(and(eq(sessions.batchId, session.batchId), eq(sessions.teacherId, teacherId)));
  } else {
    await db.delete(sessions).where(eq(sessions.id, id));
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const teacherId = await getAuthTeacherId();
  if (!teacherId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const { status } = body as { status?: string };

  if (status !== 'active' && status !== 'ended') {
    return NextResponse.json({ error: 'status must be active or ended' }, { status: 400 });
  }

  const [updated] = await db
    .update(sessions)
    .set({ status })
    .where(and(eq(sessions.id, id), eq(sessions.teacherId, teacherId)))
    .returning({ id: sessions.id, status: sessions.status });

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(updated);
}
