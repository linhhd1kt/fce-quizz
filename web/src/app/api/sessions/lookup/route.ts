import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { sessions, quizzes } from '@/db/schema';
import { eq, ilike } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });

  const [row] = await db
    .select({
      id: sessions.id,
      status: sessions.status,
      quizTitle: quizzes.title,
      timePerQuestion: quizzes.timePerQuestion,
    })
    .from(sessions)
    .leftJoin(quizzes, eq(sessions.quizId, quizzes.id))
    .where(ilike(sessions.code, code));

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(row);
}
