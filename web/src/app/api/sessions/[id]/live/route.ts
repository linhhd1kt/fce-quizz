import { auth } from '@/auth';
import { db } from '@/db/client';
import { sessionProgress, sessions, quizzes } from '@/db/schema';
import { eq, desc, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== 'teacher') {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = await params;

  const encoder = new TextEncoder();
  let lastHash = '';
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      async function tick() {
        if (closed) return;

        const rows = await db
          .select()
          .from(sessionProgress)
          .where(eq(sessionProgress.sessionId, id))
          .orderBy(desc(sessionProgress.score), asc(sessionProgress.updatedAt));

        const [sessionRow] = await db
          .select({ quizTitle: quizzes.title })
          .from(sessions)
          .leftJoin(quizzes, eq(sessions.quizId, quizzes.id))
          .where(eq(sessions.id, id));

        const entries = rows.map((r, idx) => ({
          rank: idx + 1,
          studentName: r.studentName,
          score: r.score,
          currentQuestion: r.currentQuestion,
          totalQuestions: r.totalQuestions,
          isFinished: r.isFinished,
        }));

        const playing = rows.filter((r) => !r.isFinished).length;
        const finished = rows.filter((r) => r.isFinished).length;
        const payload = JSON.stringify({
          entries,
          playing,
          finished,
          quizTitle: sessionRow?.quizTitle ?? null,
        });

        if (payload !== lastHash) {
          lastHash = payload;
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        }
      }

      await tick();
      const interval = setInterval(async () => {
        if (closed) { clearInterval(interval); return; }
        try { await tick(); } catch { closed = true; clearInterval(interval); }
      }, 1500);
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
