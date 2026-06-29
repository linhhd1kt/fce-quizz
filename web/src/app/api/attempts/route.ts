import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { attempts, sessions, quizzes } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthUserId } from '@/lib/server-auth';

interface SubmittedAnswer { questionId: string; answer: string; }
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

  // Validate session exists and is active
  const [session] = await db
    .select({ id: sessions.id, quizId: sessions.quizId, isActive: sessions.isActive, questionsSubset: sessions.questionsSubset })
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  if (!session || !session.isActive) {
    return NextResponse.json({ error: 'Session not found or inactive.' }, { status: 404 });
  }

  // Fetch quiz to compute score server-side
  const [quiz] = await db
    .select({ questions: quizzes.questions })
    .from(quizzes)
    .where(eq(quizzes.id, session.quizId));

  if (!quiz) {
    return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });
  }

  // Use session subset if present, otherwise full quiz questions
  const questions = (session.questionsSubset ?? quiz.questions) as Question[];
  const totalQuestions = questions.length;

  // Compute score server-side — never trust client-supplied score
  const score = answers.reduce((acc, submitted) => {
    const q = questions.find((qq) => qq.id === submitted.questionId);
    return acc + (q && q.answer === submitted.answer ? 1 : 0);
  }, 0);

  const [attempt] = await db.insert(attempts).values({
    sessionId,
    quizId: session.quizId,
    studentName,
    score,
    totalQuestions,
    timeSpentMs: timeSpentMs ?? 0,
    answers,
  }).returning();

  return NextResponse.json(attempt, { status: 201 });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  const studentName = searchParams.get('studentName');

  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

  // Teacher view: requires auth and session ownership
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
