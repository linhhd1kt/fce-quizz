import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { attempts, quizzes, studentQuestionStats } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== 'student') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const studentId = session.user.id as string;

  // Get distinct quizzes student has attempted
  const rows = await db
    .selectDistinct({ quizId: attempts.quizId, quizTitle: quizzes.title })
    .from(attempts)
    .leftJoin(quizzes, eq(attempts.quizId, quizzes.id))
    .where(eq(attempts.studentId, studentId));

  const now = new Date();
  const result = [];

  for (const row of rows) {
    if (!row.quizId) continue;

    const [quiz] = await db
      .select({ questions: quizzes.questions })
      .from(quizzes)
      .where(eq(quizzes.id, row.quizId));

    const totalCount = Array.isArray(quiz?.questions) ? (quiz.questions as unknown[]).length : 0;

    const stats = await db
      .select({ questionId: studentQuestionStats.questionId, nextReviewAt: studentQuestionStats.nextReviewAt })
      .from(studentQuestionStats)
      .where(
        and(
          eq(studentQuestionStats.studentId, studentId),
          eq(studentQuestionStats.quizId, row.quizId)
        )
      );

    const reviewedDue = stats.filter((s) => !s.nextReviewAt || s.nextReviewAt <= now).length;
    const unseenCount = Math.max(0, totalCount - stats.length);
    const dueCount = reviewedDue + unseenCount;

    result.push({
      quizId: row.quizId,
      quizTitle: row.quizTitle ?? 'Unknown',
      dueCount,
      totalCount,
    });
  }

  return NextResponse.json(result);
}
