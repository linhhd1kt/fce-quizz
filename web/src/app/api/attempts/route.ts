import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { attempts, sessions, quizzes, studentStats, studentQuestionStats, sessionProgress } from '@/db/schema';
import { eq, and, sql, count } from 'drizzle-orm';
import { auth } from '@/auth';
import { getAuthUserId } from '@/lib/server-auth';
import { updateStreak } from '@/lib/streak';
import { evaluateBadges } from '@/lib/badges';
import type { StudentStats } from '@/types/quiz';

interface SubmittedAnswer { questionId: string; answer: string; timeSpent?: number; }
interface Question { id: string; answer: string; }

export async function POST(req: NextRequest) {
  let body: { sessionId?: string; studentName?: string; timeSpentMs?: number; answers?: SubmittedAnswer[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  const { sessionId, studentName, timeSpentMs, answers } = body as {
    sessionId: string;
    studentName: string;
    timeSpentMs: number;
    answers: SubmittedAnswer[];
  };

  if (!sessionId || !studentName || !Array.isArray(answers)) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
  }

  const [session] = await db
    .select({ id: sessions.id, quizId: sessions.quizId, status: sessions.status, questionsSubset: sessions.questionsSubset })
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  if (!session || session.status === 'ended' || !session.quizId) {
    return NextResponse.json({ error: 'Session not found or inactive.' }, { status: 404 });
  }

  const [quiz] = await db
    .select({ questions: quizzes.questions })
    .from(quizzes)
    .where(eq(quizzes.id, session.quizId));

  if (!quiz) {
    return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });
  }

  const questions = (session.questionsSubset ?? quiz.questions) as Question[];
  const totalQuestions = questions.length;

  const score = answers.reduce((acc, submitted) => {
    const q = questions.find((qq) => qq.id === submitted.questionId);
    return acc + (q && q.answer === submitted.answer ? 1 : 0);
  }, 0);

  // Resolve student identity from session
  const nextSession = await auth();
  const studentId = nextSession?.user?.role === 'student' ? nextSession.user.id : null;

  const [attempt] = await db.insert(attempts).values({
    sessionId,
    quizId: session.quizId,
    studentId,
    studentName,
    score,
    totalQuestions,
    timeSpentMs: timeSpentMs ?? 0,
    answers,
  }).returning();

  // Update student stats if logged-in student
  if (studentId) {
    const [stats] = await db.select().from(studentStats).where(eq(studentStats.studentId, studentId));
    if (stats) {
      const today = new Date();
      const streakUpdate = updateStreak(stats as unknown as StudentStats, today);

      const isPerfect = score === totalQuestions;
      const newConsecutivePerfect = isPerfect ? stats.consecutivePerfect + 1 : 0;

      const statsForBadge: StudentStats = {
        ...(stats as unknown as StudentStats),
        ...streakUpdate,
        consecutivePerfect: newConsecutivePerfect,
        totalGames: stats.totalGames + 1,
      };
      const newBadges = evaluateBadges(statsForBadge, {
        score,
        totalQuestions,
        answers: answers.map((a) => ({ timeSpent: a.timeSpent ?? 0 })),
      });
      const allBadges = [...(stats.badges as Array<{ id: string; earnedAt: string }>), ...newBadges];

      await db.update(studentStats).set({
        totalGames: stats.totalGames + 1,
        totalCorrect: stats.totalCorrect + score,
        totalAnswered: stats.totalAnswered + totalQuestions,
        consecutivePerfect: newConsecutivePerfect,
        badges: allBadges,
        ...streakUpdate,
      }).where(eq(studentStats.studentId, studentId));

      // Update per-question stats
      for (const submitted of answers) {
        const q = questions.find((qq) => qq.id === submitted.questionId);
        const isCorrect = q && q.answer === submitted.answer;

        const [existing] = await db
          .select({ id: studentQuestionStats.id })
          .from(studentQuestionStats)
          .where(and(
            eq(studentQuestionStats.studentId, studentId),
            eq(studentQuestionStats.quizId, session.quizId!),
            eq(studentQuestionStats.questionId, submitted.questionId),
          ));

        if (existing) {
          await db.update(studentQuestionStats).set({
            correctCount: isCorrect ? sql`correct_count + 1` : sql`correct_count`,
            wrongCount: isCorrect ? sql`wrong_count` : sql`wrong_count + 1`,
            lastSeenAt: new Date(),
          }).where(eq(studentQuestionStats.id, existing.id));
        } else {
          await db.insert(studentQuestionStats).values({
            studentId,
            quizId: session.quizId!,
            questionId: submitted.questionId,
            correctCount: isCorrect ? 1 : 0,
            wrongCount: isCorrect ? 0 : 1,
          });
        }
      }
    }
  }

  // Auto-trigger: end session when all students who joined lobby have finished
  let podiumRedirect = false;
  if (session.status === 'active') {
    await db
      .insert(sessionProgress)
      .values({
        sessionId,
        studentName,
        currentQuestion: totalQuestions,
        score,
        totalQuestions,
        isFinished: true,
        updatedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: [sessionProgress.sessionId, sessionProgress.studentName],
        set: { isFinished: true, score, currentQuestion: totalQuestions, updatedAt: sql`now()` },
      });

    const [counts] = await db
      .select({
        total: count(),
        finished: count(sql`CASE WHEN ${sessionProgress.isFinished} = true THEN 1 END`),
      })
      .from(sessionProgress)
      .where(eq(sessionProgress.sessionId, sessionId));

    if (counts && counts.total > 0 && Number(counts.total) === Number(counts.finished)) {
      await db
        .update(sessions)
        .set({ status: 'ended' })
        .where(eq(sessions.id, sessionId));
      podiumRedirect = true;
    }
  }

  return NextResponse.json({ ...attempt, podiumRedirect }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  const studentName = searchParams.get('studentName');

  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

  if (!studentName) {
    const teacherId = await getAuthUserId();
    if (!teacherId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [session] = await db
      .select({ teacherId: sessions.teacherId })
      .from(sessions)
      .where(eq(sessions.id, sessionId));

    if (!session || session.teacherId !== teacherId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const conditions = studentName
    ? and(eq(attempts.sessionId, sessionId), eq(attempts.studentName, studentName))
    : eq(attempts.sessionId, sessionId);

  const data = await db.select().from(attempts).where(conditions).orderBy(attempts.completedAt);
  return NextResponse.json(data);
}
