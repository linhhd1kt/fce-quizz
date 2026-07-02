import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { students, studentStats, attempts, sessions, quizzes } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'student') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const studentId = session.user.id;

  const [student] = await db.select().from(students).where(eq(students.id, studentId));
  if (!student) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const [stats] = await db.select().from(studentStats).where(eq(studentStats.studentId, studentId));

  const history = await db
    .select({
      id: attempts.id,
      score: attempts.score,
      totalQuestions: attempts.totalQuestions,
      completedAt: attempts.completedAt,
      quizTitle: quizzes.title,
    })
    .from(attempts)
    .leftJoin(quizzes, eq(attempts.quizId, quizzes.id))
    .where(eq(attempts.studentId, studentId))
    .orderBy(desc(attempts.completedAt))
    .limit(20);

  const avgScore = stats && stats.totalAnswered > 0
    ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100)
    : 0;

  return NextResponse.json({
    student: {
      id: student.id,
      username: student.username,
      displayName: student.displayName,
    },
    stats: stats ?? {
      currentStreak: 0, longestStreak: 0, totalGames: 0,
      totalCorrect: 0, totalAnswered: 0, badges: [], consecutivePerfect: 0,
    },
    avgScore,
    history,
  });
}
