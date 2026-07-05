import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { quizzes, attempts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthTeacherId } from '@/lib/server-auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const teacherId = await getAuthTeacherId();
  if (!teacherId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const [quiz] = await db.select().from(quizzes).where(
    and(eq(quizzes.id, id), eq(quizzes.teacherId, teacherId))
  );
  if (!quiz) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(quiz);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const teacherId = await getAuthTeacherId();
  if (!teacherId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const [updated] = await db
    .update(quizzes)
    .set({ questions: body.questions })
    .where(and(eq(quizzes.id, id), eq(quizzes.teacherId, teacherId)))
    .returning();
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const teacherId = await getAuthTeacherId();
  if (!teacherId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const [quiz] = await db.select({ id: quizzes.id }).from(quizzes).where(
    and(eq(quizzes.id, id), eq(quizzes.teacherId, teacherId))
  );
  if (!quiz) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await db.delete(attempts).where(eq(attempts.quizId, id));
  await db.delete(quizzes).where(eq(quizzes.id, id));
  return NextResponse.json({ ok: true });
}
