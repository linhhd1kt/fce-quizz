import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { sessions, quizzes } from '@/db/schema';
import { eq, ilike } from 'drizzle-orm';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [row] = await db
    .select({
      id: sessions.id,
      code: sessions.code,
      isActive: sessions.isActive,
      questionsSubset: sessions.questionsSubset,
      batchId: sessions.batchId,
      batchOrder: sessions.batchOrder,
      quizzes,
    })
    .from(sessions)
    .leftJoin(quizzes, eq(sessions.quizId, quizzes.id))
    .where(ilike(sessions.code, code));

  if (!row || !row.isActive) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(row);
}
