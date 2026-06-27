import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { quizzes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthUserId } from '@/lib/server-auth';

export async function GET() {
  const teacherId = await getAuthUserId();
  if (!teacherId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await db.select().from(quizzes).where(eq(quizzes.teacherId, teacherId)).orderBy(quizzes.createdAt);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const teacherId = await getAuthUserId();
  if (!teacherId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const [quiz] = await db.insert(quizzes).values({
    teacherId,
    title: body.title,
    description: body.description ?? '',
    source: body.source ?? '',
    timePerQuestion: body.timePerQuestion ?? 45,
    questions: body.questions,
    skippedSections: body.skippedSections ?? null,
  }).returning();
  return NextResponse.json(quiz, { status: 201 });
}
