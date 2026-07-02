# Real-time Teacher Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live leaderboard at `/teacher/sessions/[id]/live` that updates in real-time via SSE as students answer each question.

**Architecture:** Students fire-and-forget a `POST /api/sessions/[id]/progress` after each answer, which upserts a `session_progress` row. An SSE handler (`GET /api/sessions/[id]/live`) polls this table every 1.5s and streams changes to the teacher's browser.

**Tech Stack:** Next.js App Router, Drizzle ORM, Postgres, SSE (native EventSource), Vitest, Playwright

## Global Constraints

- No `await` on fire-and-forget fetch in quiz player — must not block UI
- SSE auth: teacher session required (check via `auth()` → role must be `'teacher'`)
- DB polling interval: 1.5 seconds
- Leaderboard ordering: score DESC, updated_at ASC (tie-break: who answered first)
- `session_progress` is ephemeral — not final record, no changes to `attempts` table
- Unique constraint: `(session_id, student_name)` — upsert pattern
- Auth helper: use `getAuthUserId()` from `@/lib/server-auth` for teacher routes
- CSS animations: `transition: all 0.4s ease` on leaderboard rows

---

### Task 1: DB Migration — `session_progress` table

**Files:**
- Modify: `web/src/db/schema.ts`
- Create: `web/db/migrations/0005_session_progress.sql`

**Interfaces:**
- Produces: `sessionProgress` Drizzle table export, used by Task 2 + Task 3

- [ ] **Step 1: Add `sessionProgress` table to schema**

In `web/src/db/schema.ts`, append after the existing tables:

```typescript
export const sessionProgress = pgTable(
  'session_progress',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }).notNull(),
    studentName: text('student_name').notNull(),
    currentQuestion: integer('current_question').notNull().default(0),
    score: integer('score').notNull().default(0),
    totalQuestions: integer('total_questions').notNull().default(0),
    isFinished: boolean('is_finished').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`now()`),
  },
  (t) => [unique().on(t.sessionId, t.studentName)]
);
```

- [ ] **Step 2: Write migration SQL**

Create `web/db/migrations/0005_session_progress.sql`:

```sql
CREATE TABLE IF NOT EXISTS session_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  current_question INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  is_finished BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, student_name)
);
```

- [ ] **Step 3: Run migration against DB**

```bash
# SSH tunnel must be running:
# ssh -i ~/.ssh/digitalocean -L 15432:db.yratipheadkbytqywvtm.supabase.co:5432 root@139.162.42.158 -N -f

cd web
psql "postgresql://postgres:<DB_PASSWORD>@localhost:15432/postgres" -f ../db/migrations/0005_session_progress.sql
```

Expected: `CREATE TABLE`

- [ ] **Step 4: Commit**

```bash
git add web/src/db/schema.ts web/db/migrations/0005_session_progress.sql
git commit -m "chore: add session_progress table for real-time monitoring"
```

---

### Task 2: POST `/api/sessions/[id]/progress` — Upsert progress endpoint

**Files:**
- Create: `web/src/app/api/sessions/[id]/progress/route.ts`
- Create: `web/src/app/api/sessions/[id]/progress/route.test.ts`

**Interfaces:**
- Consumes: `sessionProgress` from `@/db/schema`; `db` from `@/db/client`; `sessions` table
- Body: `{ studentName: string, questionIndex: number, isCorrect: boolean, totalQuestions: number }`
- Returns: `{ ok: true }` on success, `400` on missing fields, `404` if session not found/inactive

- [ ] **Step 1: Write failing tests**

Create `web/src/app/api/sessions/[id]/progress/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/db/client', () => ({ db: { select: vi.fn(), insert: vi.fn() } }));
vi.mock('@/db/schema', () => ({
  sessions: {},
  sessionProgress: {},
}));

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockOnConflict = vi.fn().mockReturnValue({ setWhere: vi.fn().mockResolvedValue(undefined) });

beforeEach(() => {
  vi.resetAllMocks();
  const { db } = await import('@/db/client');
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ id: 'sess-1', isActive: true }]),
    }),
  });
  (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoUpdate: mockOnConflict,
    }),
  });
});

describe('POST /api/sessions/[id]/progress', () => {
  it('returns 400 when studentName is missing', async () => {
    const { POST } = await import('./route');
    const req = new Request('http://localhost/api/sessions/sess-1/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionIndex: 0, isCorrect: true, totalQuestions: 10 }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'sess-1' }) });
    expect(res.status).toBe(400);
  });

  it('returns 404 when session is inactive', async () => {
    const { db } = await import('@/db/client');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 'sess-1', isActive: false }]),
      }),
    });
    const { POST } = await import('./route');
    const req = new Request('http://localhost/api/sessions/sess-1/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentName: 'Alice', questionIndex: 0, isCorrect: true, totalQuestions: 10 }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'sess-1' }) });
    expect(res.status).toBe(404);
  });

  it('upserts progress and returns ok:true', async () => {
    const { POST } = await import('./route');
    const req = new Request('http://localhost/api/sessions/sess-1/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentName: 'Alice', questionIndex: 4, isCorrect: true, totalQuestions: 15 }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'sess-1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd web && npm test -- progress/route.test.ts
```

Expected: FAIL (module not found)

- [ ] **Step 3: Implement the route**

Create `web/src/app/api/sessions/[id]/progress/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { sessions, sessionProgress } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { studentName, questionIndex, isCorrect, totalQuestions } = body;

  if (!studentName || questionIndex === undefined || isCorrect === undefined || !totalQuestions) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
  if (!session?.isActive) {
    return NextResponse.json({ error: 'Session not found or inactive' }, { status: 404 });
  }

  const isFinished = questionIndex + 1 >= totalQuestions;
  const newScore = isCorrect ? 1 : 0;

  await db
    .insert(sessionProgress)
    .values({
      sessionId: id,
      studentName,
      currentQuestion: questionIndex + 1,
      score: newScore,
      totalQuestions,
      isFinished,
      updatedAt: sql`now()`,
    })
    .onConflictDoUpdate({
      target: [sessionProgress.sessionId, sessionProgress.studentName],
      set: {
        currentQuestion: questionIndex + 1,
        score: sql`session_progress.score + ${newScore}`,
        totalQuestions,
        isFinished,
        updatedAt: sql`now()`,
      },
    });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd web && npm test -- progress/route.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add web/src/app/api/sessions/[id]/progress/
git commit -m "feat: add POST /api/sessions/[id]/progress endpoint"
```

---

### Task 3: GET `/api/sessions/[id]/live` — SSE stream endpoint

**Files:**
- Create: `web/src/app/api/sessions/[id]/live/route.ts`

**Interfaces:**
- Consumes: `sessionProgress`, `sessions`, `quizzes` from `@/db/schema`; `getAuthUserId` from `@/lib/server-auth`; `auth` from `@/auth`
- Streams: `data: <JSON>\n\n` every 1.5s when data changes
- Event payload: `{ entries: [...], playing: number, finished: number }`

Note: SSE routes cannot be unit-tested easily (streaming responses). Manual testing via E2E in Task 5.

- [ ] **Step 1: Create the SSE route**

Create `web/src/app/api/sessions/[id]/live/route.ts`:

```typescript
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
        const payload = JSON.stringify({ entries, playing, finished, quizTitle: sessionRow?.quizTitle ?? null });

        const hash = payload;
        if (hash !== lastHash) {
          lastHash = hash;
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
```

- [ ] **Step 2: Commit**

```bash
git add web/src/app/api/sessions/[id]/live/route.ts
git commit -m "feat: add GET /api/sessions/[id]/live SSE endpoint"
```

---

### Task 4: Quiz player — fire-and-forget progress call

**Files:**
- Modify: `web/src/app/s/[code]/page.tsx`

**Interfaces:**
- Consumes: existing `sessionId`, `studentName`, `play.questionIndex`, `play.answers` state
- Side-effect only: fires POST to `/api/sessions/[sessionId]/progress` — no await

The progress call goes in `submitAnswer` immediately after recording the answer. This is the point where we know `questionIndex`, `isCorrect`, and `totalQuestions`.

- [ ] **Step 1: Add fire-and-forget call to `submitAnswer`**

In `web/src/app/s/[code]/page.tsx`, find the `submitAnswer` function (around line 117). After `setPlay(...)`, add the progress call:

```typescript
const submitAnswer = useCallback((selected: string | null) => {
  if (!quiz) return;
  if (timerRef.current) clearInterval(timerRef.current);
  const q = questions[play.questionIndex];
  const answer: UserAnswer = {
    questionId: q.id,
    selected: selected ?? '',
    correct: selected === q.answer,
    timeSpent: Date.now() - play.questionStartedAt,
  };
  setPlay((prev) => ({ ...prev, phase: 'feedback', selected, answers: [...prev.answers, answer] }));

  // Fire-and-forget: report progress for live leaderboard
  if (sessionId) {
    fetch(`/api/sessions/${sessionId}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentName,
        questionIndex: play.questionIndex,
        isCorrect: selected === q.answer,
        totalQuestions: questions.length,
      }),
    });
  }
}, [quiz, questions, play.questionIndex, play.questionStartedAt, sessionId, studentName]);
```

Note: `studentName` comes from the existing state variable already present in the component.

- [ ] **Step 2: Verify quiz player still works**

```bash
cd web && node_modules/.bin/next build 2>&1 | tail -5
```

Expected: build succeeds, no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add web/src/app/s/[code]/page.tsx
git commit -m "feat: add fire-and-forget progress call in quiz player"
```

---

### Task 5: `/teacher/sessions/[id]/live` — Leaderboard UI + E2E test

**Files:**
- Create: `web/src/app/teacher/sessions/[id]/live/page.tsx`
- Create: `web/e2e/live-leaderboard.spec.ts`

**Interfaces:**
- Consumes: SSE from `GET /api/sessions/[id]/live`
- Event payload type: `{ entries: LeaderboardEntry[], playing: number, finished: number, quizTitle: string | null }`

- [ ] **Step 1: Create the leaderboard page**

Create `web/src/app/teacher/sessions/[id]/live/page.tsx`:

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface LeaderboardEntry {
  rank: number;
  studentName: string;
  score: number;
  currentQuestion: number;
  totalQuestions: number;
  isFinished: boolean;
}

interface LiveData {
  entries: LeaderboardEntry[];
  playing: number;
  finished: number;
  quizTitle: string | null;
}

const RANK_BADGE: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
const RANK_BORDER: Record<number, string> = {
  1: 'border-yellow-500',
  2: 'border-slate-400',
  3: 'border-amber-700',
};

export default function LiveLeaderboardPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<LiveData | null>(null);
  const prevRanksRef = useRef<Record<string, number>>({});
  const [flashing, setFlashing] = useState<Set<string>>(new Set());

  useEffect(() => {
    const source = new EventSource(`/api/sessions/${id}/live`);
    source.onmessage = (e) => {
      const next: LiveData = JSON.parse(e.data);
      setData((prev) => {
        const newFlashing = new Set<string>();
        if (prev) {
          const prevRanks = prevRanksRef.current;
          next.entries.forEach((entry) => {
            const prevRank = prevRanks[entry.studentName];
            if (prevRank !== undefined && prevRank !== entry.rank) {
              newFlashing.add(entry.studentName);
            }
          });
        }
        prevRanksRef.current = Object.fromEntries(next.entries.map((e) => [e.studentName, e.rank]));
        if (newFlashing.size > 0) {
          setFlashing(newFlashing);
          setTimeout(() => setFlashing(new Set()), 800);
        }
        return next;
      });
    };
    return () => source.close();
  }, [id]);

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Connecting…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold truncate max-w-md">{data.quizTitle ?? 'Live Session'}</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {data.playing} playing · {data.finished} finished
          </p>
        </div>
        <Link href={`/teacher/sessions/${id}`} className="text-xs text-slate-500 hover:text-slate-300">
          ← Results
        </Link>
      </header>

      {/* Leaderboard */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 space-y-3">
        {data.entries.length === 0 ? (
          <div className="text-center py-24 text-slate-600">
            <p className="text-4xl mb-3">⏳</p>
            <p>Waiting for students…</p>
          </div>
        ) : (
          data.entries.map((entry) => {
            const progress = entry.totalQuestions > 0
              ? (entry.currentQuestion / entry.totalQuestions) * 100
              : 0;
            const isTop3 = entry.rank <= 3;
            const isFlashing = flashing.has(entry.studentName);
            return (
              <div
                key={entry.studentName}
                style={{ transition: 'all 0.4s ease' }}
                className={[
                  'flex items-center gap-4 rounded-2xl px-5 py-4 border',
                  isTop3 ? RANK_BORDER[entry.rank] : 'border-slate-800',
                  isTop3 ? 'bg-slate-900' : 'bg-slate-950',
                  isFlashing ? 'bg-blue-900/40' : '',
                ].join(' ')}
              >
                {/* Rank */}
                <div className="w-8 text-center text-xl flex-shrink-0">
                  {RANK_BADGE[entry.rank] ?? <span className="text-slate-600 text-sm font-bold">{entry.rank}</span>}
                </div>

                {/* Name + progress */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">
                    {entry.studentName}
                    {entry.isFinished && <span className="ml-2 text-xs text-emerald-400">✓ Done</span>}
                  </p>
                  <div className="mt-1 h-1.5 bg-slate-800 rounded-full overflow-hidden w-full">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${progress}%`, transition: 'width 0.6s ease' }}
                    />
                  </div>
                </div>

                {/* Score */}
                <div className="text-right flex-shrink-0">
                  <p className="text-xl font-bold text-white">{entry.score}</p>
                  <p className="text-xs text-slate-500">{entry.currentQuestion}/{entry.totalQuestions}</p>
                </div>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Write E2E test**

Create `web/e2e/live-leaderboard.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Live Leaderboard', () => {
  test('teacher can view live leaderboard page', async ({ browser }) => {
    // Open teacher context (authenticated)
    const teacherContext = await browser.newContext({ storageState: 'e2e/.auth/teacher.json' });
    const teacherPage = await teacherContext.newPage();

    // Get a session ID from dashboard
    await teacherPage.goto('/teacher');
    const firstSessionLink = teacherPage.locator('a[href*="/teacher/sessions/"]').first();
    await firstSessionLink.waitFor({ timeout: 5000 }).catch(() => null);

    const href = await firstSessionLink.getAttribute('href').catch(() => null);
    if (!href) {
      // No sessions yet — skip test
      await teacherContext.close();
      return;
    }
    const sessionId = href.split('/teacher/sessions/')[1]?.split('/')[0];

    // Navigate to live view
    await teacherPage.goto(`/teacher/sessions/${sessionId}/live`);

    // Should show leaderboard or waiting message
    await expect(
      teacherPage.locator('text=Waiting for students').or(teacherPage.locator('text=playing'))
    ).toBeVisible({ timeout: 5000 });

    await teacherContext.close();
  });

  test('unauthenticated user is redirected from live view', async ({ page }) => {
    page.goto('/teacher/sessions/00000000-0000-0000-0000-000000000000/live');
    await page.waitForURL(/\/teacher\/login/, { timeout: 5000 });
  });

  test('live view link exists on session detail page', async ({ browser }) => {
    const teacherContext = await browser.newContext({ storageState: 'e2e/.auth/teacher.json' });
    const teacherPage = await teacherContext.newPage();

    await teacherPage.goto('/teacher');
    const firstSessionLink = teacherPage.locator('a[href*="/teacher/sessions/"]').first();
    await firstSessionLink.waitFor({ timeout: 5000 }).catch(() => null);

    const href = await firstSessionLink.getAttribute('href').catch(() => null);
    if (!href) { await teacherContext.close(); return; }

    await teacherPage.goto(href);
    await expect(teacherPage.locator('text=Live View')).toBeVisible({ timeout: 5000 });

    await teacherContext.close();
  });
});
```

- [ ] **Step 3: Verify build**

```bash
cd web && node_modules/.bin/next build 2>&1 | tail -10
```

Expected: build succeeds

- [ ] **Step 4: Commit**

```bash
git add web/src/app/teacher/sessions/[id]/live/page.tsx web/e2e/live-leaderboard.spec.ts
git commit -m "feat: add live leaderboard page for teacher monitoring"
```

---

### Task 6: Session detail page — add "Live View" link + docs update

**Files:**
- Modify: `web/src/app/teacher/sessions/[id]/page.tsx`
- Modify: `docs/plans.md`

**Interfaces:**
- Consumes: `id` from `useParams`, already available
- Produces: Link to `/teacher/sessions/${id}/live`

- [ ] **Step 1: Add Live View link to session detail page**

In `web/src/app/teacher/sessions/[id]/page.tsx`, in the header next to the "Copy link" button, add a link to the live view. Find the `<button onClick={copyLink}` line (around line 52) and add the link after it:

```typescript
<div className="flex items-center gap-3">
  <button onClick={copyLink} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
    Copy link /s/{session.code}
  </button>
  <Link href={`/teacher/sessions/${id}/live`} className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium">
    ▶ Live View
  </Link>
</div>
```

Also ensure `Link` is imported from `'next/link'` at the top.

- [ ] **Step 2: Run build to verify no errors**

```bash
cd web && node_modules/.bin/next build 2>&1 | tail -10
```

Expected: build succeeds

- [ ] **Step 3: Run E2E tests**

```bash
# Start SSH tunnel first if not running
cd web && npm run test:e2e -- live-leaderboard.spec.ts
```

Expected: tests pass

- [ ] **Step 4: Update docs/plans.md**

In `docs/plans.md`, replace the Feature 6 block:

```markdown
## Feature 6: Real-time Teacher Monitoring 🔲 Not started
```

with:

```markdown
## Feature 6: Real-time Teacher Monitoring ✅ Done

### Task 1: DB migration — session_progress table
- [x] Add `sessionProgress` to schema.ts
- [x] Write and run SQL migration 0005_session_progress.sql

### Task 2: POST /api/sessions/[id]/progress
- [x] Upsert endpoint with session validation + score increment
- [x] Unit tests: missing fields, inactive session, happy path

### Task 3: GET /api/sessions/[id]/live SSE endpoint
- [x] SSE stream with 1.5s polling, auth-protected
- [x] Sends snapshot on connect, closes on disconnect

### Task 4: Quiz player fire-and-forget
- [x] Add progress call in submitAnswer (no await)

### Task 5: /teacher/sessions/[id]/live leaderboard page
- [x] Dark full-screen layout with rank badges + animated progress bars
- [x] SSE EventSource connection with rank-change flash animation
- [x] E2E tests: page loads, unauthenticated redirect, link exists

### Task 6: Session detail link + docs update
- [x] Add "▶ Live View" button on session detail page
- [x] Update docs/plans.md
```

- [ ] **Step 5: Commit everything**

```bash
git add web/src/app/teacher/sessions/[id]/page.tsx docs/plans.md
git commit -m "feat: add live view link to session detail page"
```

---

## Self-Review

**Spec coverage check:**
- ✅ `session_progress` table — Task 1
- ✅ `POST /api/sessions/[id]/progress` upsert logic — Task 2
- ✅ score increments on correct, `is_finished` when done — Task 2 implementation
- ✅ `GET /api/sessions/[id]/live` SSE, 1.5s poll, auth required — Task 3
- ✅ Sends initial snapshot on connect — Task 3 implementation (`await tick()` before interval)
- ✅ Close stream on disconnect — Task 3 (`cancel()` sets `closed = true`)
- ✅ Event payload: entries, playing, finished — Task 3
- ✅ Quiz player fire-and-forget call — Task 4
- ✅ Full-screen dark leaderboard — Task 5
- ✅ Header: quiz title + playing/finished counter — Task 5
- ✅ Rank badges 🥇🥈🥉 — Task 5
- ✅ CSS transitions on rows — Task 5
- ✅ Rank-change flash animation — Task 5
- ✅ Progress bar per student — Task 5
- ✅ "▶ Live View" link on session detail — Task 6
- ✅ Teacher auth required for SSE — Task 3
- ✅ E2E: live page loads, unauthenticated redirect, link exists — Task 5
