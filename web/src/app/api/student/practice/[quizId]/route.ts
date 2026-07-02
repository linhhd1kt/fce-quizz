import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { quizzes, studentQuestionStats } from '@/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { sm2 } from '@/lib/sm2';
import type { MultipleChoiceQuestion } from '@/types/quiz';

async function requireStudent() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== 'student') return null;
  return session.user.id as string;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const studentId = await requireStudent();
  if (!studentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { quizId } = await params;

  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, quizId));
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

  const allQuestions = quiz.questions as MultipleChoiceQuestion[];
  const questionIds = allQuestions.map((q) => q.id);

  const stats = questionIds.length > 0
    ? await db.select().from(studentQuestionStats).where(
        and(
          eq(studentQuestionStats.studentId, studentId),
          eq(studentQuestionStats.quizId, quizId),
          inArray(studentQuestionStats.questionId, questionIds)
        )
      )
    : [];

  const statsMap = new Map(stats.map((s) => [s.questionId, s]));
  const now = new Date();

  const dueQuestions = allQuestions.filter((q) => {
    const s = statsMap.get(q.id);
    if (!s) return true;
    if (!s.nextReviewAt) return true;
    return s.nextReviewAt <= now;
  });

  if (dueQuestions.length === 0) {
    const withReviews = stats.filter((s) => s.nextReviewAt);
    const nextReviewAt = withReviews.length > 0
      ? withReviews.reduce(
          (min, s) => (s.nextReviewAt! < min ? s.nextReviewAt! : min),
          withReviews[0].nextReviewAt!
        )
      : null;

    return NextResponse.json({
      quizTitle: quiz.title,
      questions: [],
      dueCount: 0,
      nextReviewAt: nextReviewAt?.toISOString() ?? null,
    });
  }

  const questions = dueQuestions.map((q) => {
    const s = statsMap.get(q.id);
    return {
      id: q.id,
      text: q.text,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation ?? null,
      easeFactor: s?.easeFactor ?? 2.5,
      repetitions: s?.repetitions ?? 0,
    };
  });

  return NextResponse.json({ quizTitle: quiz.title, questions, dueCount: questions.length, nextReviewAt: null });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const studentId = await requireStudent();
  if (!studentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { quizId } = await params;
  const body = await req.json().catch(() => ({}));
  const { answers } = body as { answers?: Array<{ questionId: string; isCorrect: boolean }> };

  if (!Array.isArray(answers) || answers.length === 0) {
    return NextResponse.json({ error: 'answers required' }, { status: 400 });
  }

  const questionIds = answers.map((a) => a.questionId);
  const existingStats = questionIds.length > 0
    ? await db.select().from(studentQuestionStats).where(
        and(
          eq(studentQuestionStats.studentId, studentId),
          eq(studentQuestionStats.quizId, quizId),
          inArray(studentQuestionStats.questionId, questionIds)
        )
      )
    : [];

  const statsMap = new Map(existingStats.map((s) => [s.questionId, s]));

  for (const answer of answers) {
    const existing = statsMap.get(answer.questionId);
    const input = {
      repetitions: existing?.repetitions ?? 0,
      easeFactor: existing?.easeFactor ?? 2.5,
    };
    const result = sm2(input, answer.isCorrect);

    await db
      .insert(studentQuestionStats)
      .values({
        studentId,
        quizId,
        questionId: answer.questionId,
        correctCount: answer.isCorrect ? 1 : 0,
        wrongCount: answer.isCorrect ? 0 : 1,
        easeFactor: result.newEaseFactor,
        repetitions: result.newRepetitions,
        nextReviewAt: result.nextReviewAt,
        lastSeenAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: [studentQuestionStats.studentId, studentQuestionStats.quizId, studentQuestionStats.questionId],
        set: {
          correctCount: answer.isCorrect
            ? sql`student_question_stats.correct_count + 1`
            : sql`student_question_stats.correct_count`,
          wrongCount: answer.isCorrect
            ? sql`student_question_stats.wrong_count`
            : sql`student_question_stats.wrong_count + 1`,
          easeFactor: result.newEaseFactor,
          repetitions: result.newRepetitions,
          nextReviewAt: result.nextReviewAt,
          lastSeenAt: sql`now()`,
        },
      });
  }

  return NextResponse.json({ ok: true, updatedCount: answers.length });
}
