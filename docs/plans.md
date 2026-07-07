# FCEQuiz — Master Implementation Plan

> Update checkboxes in this file after each commit. When a new spec section is added to `docs/specs.md`, append a new feature block here following the same structure.

---

## Progress Overview

| # | Feature | Spec | Status |
|---|---------|------|--------|
| 1 | Teacher Auth | §3 | ✅ Done |
| 2 | Teacher Dashboard | §4 | ✅ Done |
| 3 | PDF Upload & Quiz Creation | §5 | ✅ Done |
| 4 | Student Quiz Player | §6 | ✅ Done |
| 5 | Student Auth & Profile | §7 | ✅ Done |
| 6 | Real-time Teacher Monitoring | §7 Sub-2 | ✅ Done |
| 7 | Adaptive Solo Retry | §7 Sub-3 | ✅ Done |
| 8 | Achievements Leaderboard | §7 Sub-4 | ✅ Done |
| 9 | /join page, Lobby & Podium | §11 | ✅ Done |
| 10 | Wayground Redesign: Player Grid, Teacher Lobby, Podium 3D | §12 | ✅ Done |
| 11 | Wayground Teacher + Student Dashboard Redesign | §13 | 🚧 In progress |

---

## Implementation Rules

- **Order:** write failing test → implement → verify passes → commit
- **Commit format:** `feat:` / `fix:` / `test:` / `chore:` (Conventional Commits)
- **One commit per task** — small and focused
- **Update this file** after each task: tick the checkbox, commit alongside the code

---

## Feature 1: Teacher Auth ✅ Done

- [x] Login form at `/teacher/login` — email + password, NextAuth credentials provider
- [x] Register form at `/teacher/register` — name, email, password (min 8 chars)
- [x] Register API `POST /api/auth/register` — validation, duplicate check, bcrypt hash
- [x] Error messages: wrong credentials, password too short, email taken
- [x] Sign out button in dashboard header → redirect `/teacher/login`
- [x] Middleware: unauthenticated `/teacher/*` → redirect `/teacher/login`
- [x] E2E tests: login, register, wrong password, duplicate email, sign out

---

## Feature 2: Teacher Dashboard ✅ Done

- [x] Quiz list: title, question count, time/q, source
- [x] "+ Upload new" → `/teacher/quizzes/new`
- [x] "+ Room" → `POST /api/sessions` → banner with room code + Copy link
- [x] "+ Batch" → `POST /api/sessions/batch` → batch banner with all codes
- [x] Active Rooms list: code, quiz title, Part X/Y badge for batch sessions
- [x] "View results" → `/teacher/sessions/[id]`
- [x] `GET /api/quizzes` and `GET /api/sessions` gated to authenticated teacher
- [x] E2E tests: dashboard load, create room, view results, auth redirect

---

## Feature 3: PDF Upload & Quiz Creation ✅ Done

- [x] Delete `/upload` and `/import` pages, remove all navigation links
- [x] PDF-only drop zone on `/teacher/quizzes/new` (reject non-PDF with error)
- [x] Auto-compute `targetGames = ceil(totalQuestions / 15)` on extraction
- [x] Game preview: questions grouped by game, collapsed by default
- [x] `targetGames` input: change rerenders groups instantly (client-side)
- [x] Extend `POST /api/sessions/batch` to accept `targetGames` param
- [x] `chunkByTargetGames()` utility: even distribution with remainder spread
- [x] Inline question editor: read/edit toggle per question card
- [x] Edit mode: textarea for question text, text input per option, radio for correct answer, textarea for explanation
- [x] "Save & Create N Batch" button: `POST /api/quizzes` → `POST /api/sessions/batch` → show codes inline
- [x] E2E tests: PDF mock upload, extraction preview, inline edit, save & batch

---

## Feature 4: Student Quiz Player ✅ Done

- [x] `/s/[code]` join screen: room code, quiz title, question count, name input
- [x] 3-second countdown before first question
- [x] Question screen: text, 4 colored tiles, timer bar, progress indicator
- [x] Answer feedback: correct tile outlined, wrong dimmed, explanation shown
- [x] Timer auto-submit at 0 → "Time's up!" feedback
- [x] `POST /api/attempts` on last question; finish screen with score %
- [x] Invalid/inactive code → "Room not found or closed." error
- [x] E2E tests: join, countdown, play, feedback, timeout, finish, invalid code

---

## Feature 5: Student Auth & Profile ✅ Done

### Dependency: none — implement before Sub-2, Sub-3, Sub-4

### Task 1: Database migration
**Files:** `web/db/schema.ts`, `web/db/migrations/NNNN_student_auth.sql`

- [x] Add `students` table to schema (id, username, pin_hash, display_name, created_by, created_at, last_active_at)
- [x] Add `student_stats` table (student_id, current_streak, longest_streak, total_games, total_correct, total_answered, last_played_date, consecutive_perfect, badges JSONB)
- [x] Add `student_question_stats` table (student_id, quiz_id, question_id, correct_count, wrong_count, ease_factor, last_seen_at)
- [x] Add nullable `student_id` column to `attempts` table
- [x] Write SQL migration file and run against local DB
- [x] Commit: `chore: add students, student_stats, student_question_stats tables; add student_id to attempts`

### Task 2: NextAuth — student credentials provider
**Files:** `web/src/auth.ts`, `web/src/types/quiz.ts`

- [x] Add `Student`, `StudentStats`, `Badge` types to `quiz.ts`
- [x] Extend NextAuth JWT/session types: `role: 'teacher' | 'student'`, `studentId?`, `username?`
- [x] Add `"student-credentials"` provider: `SELECT * FROM students WHERE username = ?` → `bcrypt.compare(pin, pin_hash)`
- [x] Ensure existing teacher credentials provider is unchanged
- [x] Write unit test: valid PIN → session created; wrong PIN → null returned
- [x] Commit: `feat: add student-credentials NextAuth provider`

### Task 3: Middleware update
**Files:** `web/src/middleware.ts`

- [x] Add rule: `/student/*` requires `session.user.role === 'student'` → redirect `/student/login`
- [x] Existing rule for `/teacher/*` unchanged
- [x] Write E2E test: unauthenticated `/student/profile` → redirected to `/student/login`
- [x] Commit: `feat: protect /student/* routes in middleware`

### Task 4: Student self-registration API
**Files:** `web/src/app/api/student/register/route.ts`

- [x] `POST /api/student/register` body: `{ display_name, username, pin }`
- [x] Validate: username 3–20 chars, lowercase, no spaces; PIN exactly 6 digits
- [x] Check username uniqueness → 409 if taken
- [x] `bcrypt.hash(pin, 12)` → `INSERT INTO students` → `INSERT INTO student_stats`
- [x] Write unit test: valid input → 201; duplicate username → 409; bad PIN → 400
- [x] Commit: `feat: add student self-registration API`

### Task 5: Student login & register pages
**Files:** `web/src/app/student/login/page.tsx`, `web/src/app/student/register/page.tsx`

- [x] Login page: username input + 6-digit PIN input → `signIn('student-credentials')` → redirect `/student/profile`
- [x] Login error: "Invalid username or PIN."
- [x] Register page: display_name + username + PIN → `POST /api/student/register` → auto sign-in → redirect `/student/profile`
- [x] E2E test: register → login → redirected to profile
- [x] Commit: `feat: add student login and register pages`

### Task 6: Teacher student management API
**Files:** `web/src/app/api/students/route.ts`, `web/src/app/api/students/[id]/route.ts`, `web/src/app/api/students/[id]/reset-pin/route.ts`

- [x] `GET /api/students` → list students created by authenticated teacher
- [x] `POST /api/students` body `{ display_name }` → auto-generate username + random 6-digit PIN → INSERT → return `{ username, pin }` plaintext once
- [x] Username generation: `display_name.toLowerCase().replace(/\s+/g, '_')` + suffix on collision
- [x] `DELETE /api/students/[id]` → verify ownership → DELETE (cascades)
- [x] `POST /api/students/[id]/reset-pin` → generate new PIN → bcrypt hash → UPDATE → return `{ pin }` plaintext once
- [x] Write unit tests: create, duplicate username collision, delete, reset PIN
- [x] Commit: `feat: add teacher student management API`

### Task 7: Teacher students management page
**Files:** `web/src/app/teacher/students/page.tsx`

- [x] Table: username, display_name, PIN column (shown once on create/reset then `——`), Reset button, Delete button
- [x] "+ Add Student" inline form: display_name input + Add button → row appears with PIN visible
- [x] Reset PIN: replaces PIN in row with new one, hides after next render
- [x] Delete: removes row immediately, calls `DELETE /api/students/[id]`
- [x] E2E test: add student → PIN shown → delete student
- [x] Commit: `feat: add teacher student management page`

### Task 8: Streak logic
**Files:** `web/src/lib/streak.ts`

- [x] `updateStreak(stats: StudentStats, today: Date): Partial<StudentStats>`
  - `last_played_date` = yesterday → `current_streak + 1`
  - `last_played_date` = today → no change
  - gap ≥ 2 days → `current_streak = 1`
  - update `longest_streak` if `current_streak > longest_streak`
- [x] Write unit tests: yesterday, today, 2-day gap, first play
- [x] Commit: `feat: add streak update logic`

### Task 9: Badge evaluation logic
**Files:** `web/src/lib/badges.ts`

- [x] `evaluateBadges(stats: StudentStats, attempt: Attempt): Badge[]` — returns new badges earned (no duplicates with existing)
- [x] Conditions: `first_play` (total_games = 1), `first_win` (score = 100 AND first time), `on_fire` (current_streak ≥ 7), `speed_demon` (any answer < 5s), `sharpshooter` (consecutive_perfect ≥ 5), `dedicated` (total_games ≥ 30)
- [x] Write unit test for each badge condition
- [x] Commit: `feat: add badge evaluation logic`

### Task 10: Update attempts route to link student + update stats
**Files:** `web/src/app/api/attempts/route.ts`

- [x] If `session.user.role === 'student'`: set `student_id` on attempt insert
- [x] After insert: call `updateStreak()` + `evaluateBadges()` → atomic UPDATE to `student_stats`
- [x] Update `student_question_stats`: increment `correct_count` or `wrong_count` per answer
- [x] Anonymous attempts (`student_id = null`) unchanged
- [x] Write unit test: student attempt → stats updated; anon attempt → stats unchanged
- [x] Commit: `feat: link student_id to attempts and update student stats on submit`

### Task 11: Student profile page
**Files:** `web/src/app/student/profile/page.tsx`

- [x] Header: display_name, @username, current streak
- [x] Stats section: total_games, avg score %, total_correct/total_answered
- [x] Badges section: earned badges with emoji + label
- [x] Quiz history: last 20 attempts (quiz title, score %, relative time)
- [x] All data from `GET /api/student/profile` (or fetch on page server component)
- [x] E2E test: play game as student → profile shows updated stats + first_play badge
- [x] Commit: `feat: add student profile page`

### Task 12: NavBar update + E2E regression
**Files:** `web/src/components/NavBar.tsx`

- [x] When `session.user.role === 'student'`: show "My Profile" link → `/student/profile`
- [x] When `role === 'teacher'`: show "Students" link → `/teacher/students` (if not already)
- [x] Run full E2E suite — verify no regressions in teacher auth, dashboard, quiz player
- [x] Commit: `feat: add student profile link to NavBar`

---

## Feature 6: Real-time Teacher Monitoring ✅ Done

> Spec: `docs/specs/2026-07-02-realtime-monitoring-design.md` | Full plan: `docs/plans/2026-07-02-realtime-monitoring.md`

### Task 1: DB migration — `session_progress` table
- [x] Add `sessionProgress` table to `web/src/db/schema.ts`
- [x] Write `web/db/migrations/0005_session_progress.sql` and run against DB
- [x] Commit: `chore: add session_progress table for real-time monitoring`

### Task 2: `POST /api/sessions/[id]/progress`
- [x] Upsert endpoint: validate body, check session active, increment score on correct
- [x] Set `is_finished = true` when `questionIndex + 1 >= totalQuestions`
- [x] Unit tests: missing fields → 400, inactive session → 404, happy path → ok
- [x] Commit: `feat: add POST /api/sessions/[id]/progress endpoint`

### Task 3: `GET /api/sessions/[id]/live` SSE endpoint
- [x] SSE stream, teacher auth required, 1.5s poll, sends snapshot on connect
- [x] Close stream on client disconnect
- [x] Commit: `feat: add GET /api/sessions/[id]/live SSE endpoint`

### Task 4: Quiz player — fire-and-forget progress call
- [x] Add `fetch(...)` (no await) in `submitAnswer` after each answer
- [x] Commit: `feat: add fire-and-forget progress call in quiz player`

### Task 5: `/teacher/sessions/[id]/live` leaderboard page
- [x] Full-screen dark layout: quiz title, playing/finished counter, ranked rows
- [x] Rank badges 🥇🥈🥉, progress bar per student, CSS transitions
- [x] Flash animation on rank change
- [x] E2E tests: page loads, unauthenticated redirect, link exists on detail page
- [x] Commit: `feat: add live leaderboard page for teacher monitoring`

### Task 6: Session detail — "▶ Live View" link + docs update
- [x] Add `Link` to `/teacher/sessions/${id}/live` in header of session detail page
- [x] Tick checkboxes in this file, commit: `feat: add live view link to session detail page`

---

## Feature 7: Adaptive Solo Retry ✅ Done

> Spec: `docs/specs/2026-07-02-adaptive-solo-retry-design.md` | Plan: `docs/plans/2026-07-02-adaptive-solo-retry.md`

- [x] DB migration: add `repetitions`, `next_review_at` to `student_question_stats` + unique constraint
- [x] SM-2 algorithm in `web/src/lib/sm2.ts` with unit tests
- [x] `GET /api/student/practice/[quizId]` — due questions
- [x] `POST /api/student/practice/[quizId]` — batch SM-2 update
- [x] `GET /api/student/practice-summary` — per-quiz due counts
- [x] `/student/practice/[quizId]` practice page
- [x] Profile page "Luyện tập" section

---

## Feature 8: Achievements Leaderboard ✅ Done

> Spec: `docs/specs/2026-07-02-achievements-leaderboard-design.md` | Plan: `docs/plans/2026-07-02-achievements-leaderboard.md`

- [x] `GET /api/student/leaderboard` — top 10 by total correct
- [x] `/student/leaderboard` leaderboard page
- [x] Profile page link to leaderboard

---

## Feature 9: /join page, Lobby & Podium ✅ Done

> Spec: §11 in `docs/specs.md`

### Global constraints for this feature
- All UI text, button labels, toast messages, error messages: English only
- Session status values: `'waiting'` | `'active'` | `'ended'` (lowercase strings)
- Student lobby poll interval: 2 s — teacher dashboard poll interval: 3 s
- Auto-trigger guard: skip if `session_progress` has 0 rows for the session
- No new npm dependencies — use existing Drizzle, Next.js, sonner

---

### Task 1: DB migration — add `sessions.status` column

**Files:**
- Create: `web/db/migrations/<next>_session_status.sql`
- Modify: `web/src/db/schema.ts`

- [x] Check the next available migration number:
  ```bash
  ls web/db/migrations/
  ```
  Use the next sequential number (e.g., if last file is `0010_...sql`, use `0011`).

- [x] Write `web/db/migrations/<next>_session_status.sql`:
  ```sql
  ALTER TABLE sessions ADD COLUMN status text NOT NULL DEFAULT 'waiting';
  -- All existing sessions were already in active play; mark them active.
  UPDATE sessions SET status = 'active';
  ```

- [x] Run the migration (requires SSH tunnel on port 15432):
  ```bash
  ssh -i ~/.ssh/digitalocean -L 15432:db.supabase.co:5432 root@139.162.42.158 -N -f
  # Password is in web/.env.local as DATABASE_URL
  psql "postgresql://postgres:<password>@localhost:15432/postgres" \
    -f web/db/migrations/<next>_session_status.sql
  ```

- [x] Add `status` field to sessions table in `web/src/db/schema.ts`.
  Find the sessions table. After the `batchOrder` line, add:
  ```typescript
  status: text('status').notNull().default('waiting'),
  ```
  Full sessions table after change:
  ```typescript
  export const sessions = pgTable('sessions', {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    quizId: uuid('quiz_id').references(() => quizzes.id, { onDelete: 'cascade' }),
    teacherId: text('teacher_id').references(() => authUsers.id, { onDelete: 'cascade' }),
    code: text('code').unique().notNull(),
    isActive: boolean('is_active').default(true),
    questionsSubset: jsonb('questions_subset'),
    batchId: uuid('batch_id'),
    batchOrder: integer('batch_order'),
    status: text('status').notNull().default('waiting'),
    createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`),
  });
  ```

- [x] Verify migration:
  ```bash
  psql "postgresql://postgres:<password>@localhost:15432/postgres" \
    -c "SELECT status, COUNT(*) FROM sessions GROUP BY status;"
  # Expected: one row — active | N
  ```

- [x] Commit:
  ```bash
  git add web/db/migrations/<next>_session_status.sql web/src/db/schema.ts
  git commit -m "chore: add sessions.status column with migration"
  ```

---

### Task 2: API — session lookup endpoint + fix by-code route

**Files:**
- Create: `web/src/app/api/sessions/lookup/route.ts`
- Modify: `web/src/app/api/sessions/by-code/[code]/route.ts`

- [x] Create `web/src/app/api/sessions/lookup/route.ts`:
  ```typescript
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
  ```

- [x] Modify `web/src/app/api/sessions/by-code/[code]/route.ts`.
  Two changes: add `status` to the SELECT, and remove the `!row.isActive` guard (client now handles all statuses).
  Full file after change:
  ```typescript
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
        status: sessions.status,
        questionsSubset: sessions.questionsSubset,
        batchId: sessions.batchId,
        batchOrder: sessions.batchOrder,
        quizzes,
      })
      .from(sessions)
      .leftJoin(quizzes, eq(sessions.quizId, quizzes.id))
      .where(ilike(sessions.code, code));

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(row);
  }
  ```

- [x] Verify with dev server:
  ```bash
  cd web && node_modules/.bin/next dev
  # In another terminal:
  curl "http://localhost:3000/api/sessions/lookup?code=<any-code>"
  # Expected: { "id": "...", "status": "active", "quizTitle": "...", "timePerQuestion": 45 }
  ```

- [x] Commit:
  ```bash
  git add web/src/app/api/sessions/lookup/route.ts \
          web/src/app/api/sessions/by-code/[code]/route.ts
  git commit -m "feat: add session lookup endpoint and include status in by-code response"
  ```

---

### Task 3: API — lobby join endpoint

**Files:**
- Create: `web/src/app/api/lobby/join/route.ts`

`POST /api/lobby/join` with body `{ code: string; studentName: string }` → `{ ok: true; sessionId: string; status: string }`

- [x] Create `web/src/app/api/lobby/join/route.ts`:
  ```typescript
  import { NextRequest, NextResponse } from 'next/server';
  import { db } from '@/db/client';
  import { sessions, sessionProgress } from '@/db/schema';
  import { ilike, sql } from 'drizzle-orm';

  export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    const { code, studentName } = body as { code?: string; studentName?: string };

    if (!code || !studentName) {
      return NextResponse.json({ error: 'code and studentName required' }, { status: 400 });
    }

    const [session] = await db
      .select({ id: sessions.id, status: sessions.status })
      .from(sessions)
      .where(ilike(sessions.code, code));

    if (!session || session.status === 'ended') {
      return NextResponse.json({ error: 'Session not found or ended' }, { status: 404 });
    }

    await db
      .insert(sessionProgress)
      .values({
        sessionId: session.id,
        studentName,
        currentQuestion: 0,
        score: 0,
        totalQuestions: 0,
        isFinished: false,
        updatedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: [sessionProgress.sessionId, sessionProgress.studentName],
        set: { updatedAt: sql`now()` },
      });

    return NextResponse.json({ ok: true, sessionId: session.id, status: session.status });
  }
  ```

- [x] Test manually:
  ```bash
  curl -X POST http://localhost:3000/api/lobby/join \
    -H 'Content-Type: application/json' \
    -d '{"code":"<existing-code>","studentName":"Test Student"}'
  # Expected: { "ok": true, "sessionId": "...", "status": "active" }
  ```

- [x] Commit:
  ```bash
  git add web/src/app/api/lobby/join/route.ts
  git commit -m "feat: add POST /api/lobby/join endpoint"
  ```

---

### Task 4: API — PATCH session status (teacher start/end)

**Files:**
- Modify: `web/src/app/api/sessions/[id]/route.ts`

`PATCH /api/sessions/[id]` with body `{ status: 'active' | 'ended' }` → `{ id: string; status: string }` (teacher auth required)

- [x] Add PATCH handler to `web/src/app/api/sessions/[id]/route.ts`, after the DELETE function:
  ```typescript
  export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const teacherId = await getAuthUserId();
    if (!teacherId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const body = await req.json().catch(() => ({}));
    const { status } = body as { status?: string };

    if (status !== 'active' && status !== 'ended') {
      return NextResponse.json({ error: 'status must be active or ended' }, { status: 400 });
    }

    const [updated] = await db
      .update(sessions)
      .set({ status })
      .where(and(eq(sessions.id, id), eq(sessions.teacherId, teacherId)))
      .returning({ id: sessions.id, status: sessions.status });

    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  }
  ```
  The file already imports `{ sessions, quizzes, attempts }`, `{ eq, and }`, and `getAuthUserId` — no new imports needed.

- [x] Commit:
  ```bash
  git add web/src/app/api/sessions/[id]/route.ts
  git commit -m "feat: add PATCH /api/sessions/[id] to update session status"
  ```

---

### Task 5: API — sessions list with status, lobbyCount, finishedCount

**Files:**
- Modify: `web/src/app/api/sessions/route.ts`

- [x] Add `sql` to the drizzle-orm import in `web/src/app/api/sessions/route.ts`:
  ```typescript
  import { eq, sql } from 'drizzle-orm';
  ```

- [x] Replace the GET handler's select query with:
  ```typescript
  export async function GET() {
    const teacherId = await getAuthUserId();
    if (!teacherId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const data = await db
      .select({
        id: sessions.id,
        code: sessions.code,
        status: sessions.status,
        isActive: sessions.isActive,
        createdAt: sessions.createdAt,
        quizTitle: quizzes.title,
        quizId: sessions.quizId,
        batchId: sessions.batchId,
        batchOrder: sessions.batchOrder,
        lobbyCount: sql<number>`(SELECT COUNT(*) FROM session_progress WHERE session_id = ${sessions.id})::int`,
        finishedCount: sql<number>`(SELECT COUNT(*) FROM session_progress WHERE session_id = ${sessions.id} AND is_finished = true)::int`,
      })
      .from(sessions)
      .leftJoin(quizzes, eq(sessions.quizId, quizzes.id))
      .where(eq(sessions.teacherId, teacherId))
      .orderBy(sessions.createdAt);
    return NextResponse.json(data);
  }
  ```

- [x] Verify:
  ```bash
  curl http://localhost:3000/api/sessions -H 'Cookie: <session-cookie>'
  # Each session object now has: status, lobbyCount, finishedCount
  ```

- [x] Commit:
  ```bash
  git add web/src/app/api/sessions/route.ts
  git commit -m "feat: enrich sessions list with status, lobbyCount, finishedCount"
  ```

---

### Task 6: API — podium endpoint

**Files:**
- Create: `web/src/app/api/sessions/[id]/podium/route.ts`

`GET /api/sessions/[id]/podium` (public, no auth) → `{ sessionStatus: string; entries: [{ rank, studentName, score, totalQuestions, timeSpentMs }] }`

- [x] Create `web/src/app/api/sessions/[id]/podium/route.ts`:
  ```typescript
  import { NextRequest, NextResponse } from 'next/server';
  import { db } from '@/db/client';
  import { attempts, sessions } from '@/db/schema';
  import { eq, desc, asc } from 'drizzle-orm';

  export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const [session] = await db
      .select({ id: sessions.id, status: sessions.status })
      .from(sessions)
      .where(eq(sessions.id, id));

    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const results = await db
      .select({
        studentName: attempts.studentName,
        score: attempts.score,
        totalQuestions: attempts.totalQuestions,
        timeSpentMs: attempts.timeSpentMs,
      })
      .from(attempts)
      .where(eq(attempts.sessionId, id))
      .orderBy(desc(attempts.score), asc(attempts.timeSpentMs));

    return NextResponse.json({
      sessionStatus: session.status,
      entries: results.map((r, idx) => ({
        rank: idx + 1,
        studentName: r.studentName,
        score: r.score,
        totalQuestions: r.totalQuestions,
        timeSpentMs: r.timeSpentMs,
      })),
    });
  }
  ```

- [x] Commit:
  ```bash
  git add web/src/app/api/sessions/[id]/podium/route.ts
  git commit -m "feat: add GET /api/sessions/[id]/podium endpoint"
  ```

---

### Task 7: API — fix isActive checks + auto-trigger when all finish

**Files:**
- Modify: `web/src/app/api/sessions/[id]/progress/route.ts`
- Modify: `web/src/app/api/attempts/route.ts`

#### progress route — change isActive guard

- [x] In `web/src/app/api/sessions/[id]/progress/route.ts`, replace the session fetch and guard.
  Find:
  ```typescript
  const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
  if (!session?.isActive) {
    return NextResponse.json({ error: 'Session not found or inactive' }, { status: 404 });
  }
  ```
  Replace with:
  ```typescript
  const [session] = await db
    .select({ id: sessions.id, status: sessions.status })
    .from(sessions)
    .where(eq(sessions.id, id));
  if (!session || session.status === 'ended') {
    return NextResponse.json({ error: 'Session not found or inactive' }, { status: 404 });
  }
  ```

- [x] Commit:
  ```bash
  git add web/src/app/api/sessions/[id]/progress/route.ts
  git commit -m "fix: check session.status instead of isActive in progress route"
  ```

#### attempts route — change guard + add auto-trigger

- [x] In `web/src/app/api/attempts/route.ts`, add `sessionProgress` and `count` to imports.
  Find:
  ```typescript
  import { attempts, sessions, quizzes, studentStats, studentQuestionStats } from '@/db/schema';
  import { eq, and, sql } from 'drizzle-orm';
  ```
  Replace with:
  ```typescript
  import { attempts, sessions, quizzes, studentStats, studentQuestionStats, sessionProgress } from '@/db/schema';
  import { eq, and, sql, count } from 'drizzle-orm';
  ```

- [x] Update the session fetch and guard in the POST handler.
  Find:
  ```typescript
  const [session] = await db
    .select({ id: sessions.id, quizId: sessions.quizId, isActive: sessions.isActive, questionsSubset: sessions.questionsSubset })
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  if (!session || !session.isActive || !session.quizId) {
    return NextResponse.json({ error: 'Session not found or inactive.' }, { status: 404 });
  }
  ```
  Replace with:
  ```typescript
  const [session] = await db
    .select({ id: sessions.id, quizId: sessions.quizId, status: sessions.status, questionsSubset: sessions.questionsSubset })
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  if (!session || session.status === 'ended' || !session.quizId) {
    return NextResponse.json({ error: 'Session not found or inactive.' }, { status: 404 });
  }
  ```

- [x] Add auto-trigger logic at the END of the POST handler, replacing the final return line.
  Find:
  ```typescript
  return NextResponse.json(attempt, { status: 201 });
  ```
  Replace with:
  ```typescript
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
  ```

- [x] Commit:
  ```bash
  git add web/src/app/api/attempts/route.ts
  git commit -m "feat: auto-trigger session ended when all students finish"
  ```

---

### Task 8: Frontend — /join page

**Files:**
- Create: `web/src/app/join/page.tsx`

- [x] Create `web/src/app/join/page.tsx`:
  ```typescript
  'use client';

  import { useState } from 'react';
  import { useRouter } from 'next/navigation';

  export default function JoinPage() {
    const router = useRouter();
    const [code, setCode] = useState('');

    function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      const trimmed = code.trim().toUpperCase();
      if (!trimmed) return;
      router.push(`/s/${trimmed}`);
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-1">
            <h1 className="text-white text-3xl font-black">FCEQuiz</h1>
            <p className="text-slate-400 text-sm">Enter your room code to join</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              required
              autoFocus
              autoComplete="off"
              placeholder="Room code…"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full text-center text-white text-2xl font-black tracking-widest bg-white/5 border-2 border-white/20 focus:border-white/60 rounded-2xl px-6 py-4 outline-none transition-colors placeholder-white/20 uppercase"
            />
            <button
              type="submit"
              disabled={!code.trim()}
              className="w-full py-4 rounded-2xl text-white font-black text-xl transition hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#e86020', boxShadow: 'rgba(232,96,32,0.4) 0 4px 20px' }}
            >
              Join →
            </button>
          </form>
        </div>
      </div>
    );
  }
  ```

- [x] Test in browser: navigate to `http://localhost:3000/join`, enter a room code → verify redirect to `/s/<CODE>`.

- [x] Commit:
  ```bash
  git add web/src/app/join/page.tsx
  git commit -m "feat: add /join page for students to enter room code"
  ```

---

### Task 9: Frontend — /s/[code] lobby state

**Files:**
- Modify: `web/src/app/s/[code]/page.tsx`

- [x] Update the `Screen` type (line ~24):
  ```typescript
  type Screen = 'join' | 'lobby' | 'countdown' | 'playing' | 'finished' | 'results';
  ```

- [x] Add `sessionStatus` state after the existing state declarations (around line 22):
  ```typescript
  const [sessionStatus, setSessionStatus] = useState<'waiting' | 'active' | 'ended' | null>(null);
  ```

- [x] Replace the initial `useEffect` that calls `by-code` (find the block starting with `fetch(\`/api/sessions/by-code/\${code}\`)`):
  ```typescript
  useEffect(() => {
    fetch(`/api/sessions/by-code/${code}`)
      .then((r) => r.ok ? r.json() : null)
      .then((s) => {
        if (!s) { setLoadError('Room not found or closed.'); return; }
        setSessionId(s.id);
        setSessionStatus(s.status ?? 'active');
        setQuiz(s.quizzes);
        if (s.questionsSubset) setSessionQuestions(s.questionsSubset as MultipleChoiceQuestion[]);
        if (s.batchId) {
          setBatchId(s.batchId);
          setBatchOrder(s.batchOrder);
          fetch(`/api/sessions/batch/${s.batchId}`)
            .then((r) => r.ok ? r.json() : null)
            .then((parts) => { if (parts) setBatchParts(parts); });
        }
        if (s.status === 'ended') router.push(`/s/${code}/podium`);
      });
  }, [code, router]);
  ```

- [x] Add lobby polling `useEffect` directly after the countdown `useEffect` (which ends around line 93):
  ```typescript
  useEffect(() => {
    if (screen !== 'lobby') return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/sessions/lookup?code=${code}`);
      if (!res.ok) return;
      const data = await res.json() as { status: string };
      if (data.status === 'active') {
        clearInterval(interval);
        setActiveQuestions(null);
        setPlay({ phase: 'question', questionIndex: 0, selected: null, timeLeft: timePerQ, answers: [], questionStartedAt: Date.now() });
        setScreen('countdown');
        setCountdown(3);
      } else if (data.status === 'ended') {
        clearInterval(interval);
        router.push(`/s/${code}/podium`);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [screen, code, router, timePerQ]);
  ```

- [x] Replace `handleJoin` (the full function, find it by `async function handleJoin`):
  ```typescript
  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const name = nameInput.trim();
    if (!name) return;
    setStudentName(name);
    if (sessionStatus === 'waiting') {
      await fetch('/api/lobby/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, studentName: name }),
      });
      setScreen('lobby');
    } else {
      startPlay(null);
    }
  }
  ```

- [x] Replace `nextQuestion` (the full async function):
  ```typescript
  async function nextQuestion() {
    if (!quiz) return;
    const next = play.questionIndex + 1;
    if (next >= questions.length) {
      const score = calculateScore(play.answers);
      const res = await fetch('/api/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId, quizId: quiz.id, studentName, score,
          totalQuestions: questions.length,
          timeSpentMs: play.answers.reduce((s, a) => s + a.timeSpent, 0),
          answers: play.answers,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { podiumRedirect?: boolean };
        if (data.podiumRedirect) {
          router.push(`/s/${code}/podium`);
          return;
        }
      }
      setScreen('finished');
    } else {
      setPlay((prev) => ({ ...prev, phase: 'question', questionIndex: next, selected: null, timeLeft: timePerQ, questionStartedAt: Date.now() }));
    }
  }
  ```

- [x] Add lobby screen render. Insert this block before the `// ── JOIN` comment:
  ```typescript
  // ── LOBBY ────────────────────────────────────────────────────────────────
  if (screen === 'lobby') return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-4" style={{ background: '#2d0a1e' }}>
      <GridPattern />
      <div className="relative w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold text-orange-400 bg-orange-400/10 border border-orange-400/30">
            {code.toUpperCase()}
          </span>
          <h1 className="text-white text-xl font-bold">{quiz?.title}</h1>
        </div>
        <div className="space-y-3">
          <p className="text-white font-semibold">You&apos;re in the lobby!</p>
          <p className="text-white/50 text-sm">Hi, {studentName} 👋</p>
          <p className="text-white/40 text-sm">Waiting for teacher to start the game…</p>
          <div className="flex justify-center gap-2 pt-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-orange-400"
                style={{ animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }}
              />
            ))}
          </div>
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:0.2} 50%{opacity:1} }`}</style>
    </div>
  );
  ```

- [x] Test end-to-end in browser:
  1. Create a new session from teacher dashboard — see it with "waiting" status
  2. Open `/s/<code>` in another tab — enter name, click Join → see lobby waiting screen
  3. On teacher dashboard click "▶ Start" → student tab transitions to countdown
  4. Verify quiz plays normally and finish screen appears

- [x] Commit:
  ```bash
  git add web/src/app/s/[code]/page.tsx
  git commit -m "feat: add lobby waiting state to student quiz player"
  ```

---

### Task 10: Frontend — /s/[code]/podium page

**Files:**
- Create: `web/src/app/s/[code]/podium/page.tsx`

- [x] Create `web/src/app/s/[code]/podium/page.tsx`:
  ```typescript
  'use client';

  import { useEffect, useState } from 'react';
  import { useParams } from 'next/navigation';
  import Link from 'next/link';

  interface PodiumEntry {
    rank: number;
    studentName: string;
    score: number;
    totalQuestions: number;
    timeSpentMs: number;
  }

  const MEDALS = ['🥇', '🥈', '🥉'];

  export default function PodiumPage() {
    const { code } = useParams<{ code: string }>();
    const [entries, setEntries] = useState<PodiumEntry[]>([]);
    const [quizTitle, setQuizTitle] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      fetch(`/api/sessions/lookup?code=${code}`)
        .then((r) => r.ok ? r.json() : null)
        .then(async (session) => {
          if (!session) { setLoading(false); return; }
          setQuizTitle(session.quizTitle ?? '');
          const res = await fetch(`/api/sessions/${session.id}/podium`);
          if (res.ok) {
            const data = await res.json() as { entries: PodiumEntry[] };
            setEntries(data.entries);
          }
          setLoading(false);
        });
    }, [code]);

    if (loading) return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <p className="text-slate-500 text-sm">Loading results…</p>
      </div>
    );

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-1">
            <p className="text-5xl">🏆</p>
            <h1 className="text-white text-2xl font-black mt-2">Final Results</h1>
            {quizTitle && <p className="text-slate-400 text-sm">{quizTitle}</p>}
          </div>

          {entries.length === 0 ? (
            <p className="text-center text-slate-500 text-sm">No results yet.</p>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div
                  key={entry.studentName}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
                    entry.rank === 1 ? 'bg-yellow-950/40 border border-yellow-700/50' :
                    entry.rank === 2 ? 'bg-slate-800/60 border border-slate-600/50' :
                    entry.rank === 3 ? 'bg-orange-950/30 border border-orange-800/40' :
                    'bg-slate-900 border border-slate-800'
                  }`}
                >
                  <span className="text-2xl w-8 text-center shrink-0">
                    {MEDALS[entry.rank - 1] ?? `${entry.rank}.`}
                  </span>
                  <span className="flex-1 text-white font-semibold truncate">{entry.studentName}</span>
                  <span className={`font-black text-lg shrink-0 ${
                    entry.rank === 1 ? 'text-yellow-400' :
                    entry.rank === 2 ? 'text-slate-300' :
                    entry.rank === 3 ? 'text-orange-400' :
                    'text-slate-400'
                  }`}>
                    {entry.score}/{entry.totalQuestions}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Link
              href="/"
              className="flex-1 py-3 text-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-colors"
            >
              Home
            </Link>
          </div>
        </div>
      </div>
    );
  }
  ```

- [x] Verify: navigate to `/s/<code>/podium` for a session that has attempts → ranked list appears.

- [x] Commit:
  ```bash
  git add web/src/app/s/[code]/podium/page.tsx
  git commit -m "feat: add /s/[code]/podium final results page"
  ```

---

### Task 11: Frontend — teacher dashboard (status, start/end, polling)

**Files:**
- Modify: `web/src/app/teacher/page.tsx`

- [x] Fix remaining English violations in the quiz delete confirm UI. Find in the quiz list section:
  ```typescript
  <span className="text-xs text-slate-400">Xóa tất cả rooms + dữ liệu?</span>
  ```
  Replace with:
  ```typescript
  <span className="text-xs text-slate-400">Delete quiz + all room data?</span>
  ```
  Find:
  ```typescript
  {deleting ? '…' : 'Xóa'}
  ```
  Replace (quiz delete button only):
  ```typescript
  {deleting ? '…' : 'Delete'}
  ```
  Find the Cancel button in the quiz section:
  ```typescript
  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors">
                          Huỷ
  ```
  Replace with:
  ```typescript
  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors">
                          Cancel
  ```

- [x] Update `SessionRow` interface (find it at the top of the file):
  ```typescript
  interface SessionRow {
    id: string;
    code: string;
    status: string;
    isActive: boolean;
    createdAt: string;
    quizTitle: string;
    batchId?: string | null;
    batchOrder?: number | null;
    lobbyCount: number;
    finishedCount: number;
  }
  ```

- [x] Add `handleStartGame` and `handleEndGame` after `handleDeleteSession`:
  ```typescript
  async function handleStartGame(id: string) {
    const res = await fetch(`/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    if (!res.ok) { toast.error('Failed to start game'); return; }
    await load();
  }

  async function handleEndGame(id: string) {
    const res = await fetch(`/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ended' }),
    });
    if (!res.ok) { toast.error('Failed to end game'); return; }
    await load();
  }
  ```

- [x] Add polling `useEffect` after `useEffect(() => { load(); }, [load])`:
  ```typescript
  useEffect(() => {
    const hasLiveSession = sessions.some(s => s.status === 'waiting' || s.status === 'active');
    if (!hasLiveSession) return;
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [sessions, load]);
  ```

- [x] Rename the "Active rooms" section header to "Rooms":
  ```typescript
  <h2 className="text-white font-bold text-lg">Rooms</h2>
  ```

- [x] Replace the entire `{sessions.map((s) => {` block (the session row render):
  ```typescript
  {sessions.map((s) => {
    const isBatch = !!s.batchId;
    const totalInBatch = isBatch ? sessions.filter(x => x.batchId === s.batchId).length : null;
    const status = s.status ?? 'active';
    return (
      <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-3 flex items-center gap-4">
        <span className="font-mono font-black text-lg text-orange-400 w-20 shrink-0">{s.code}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-white text-sm font-medium truncate">{s.quizTitle}</p>
            {isBatch && (
              <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-400 border border-blue-800 font-semibold">
                Part {s.batchOrder}/{totalInBatch}
              </span>
            )}
            {status === 'waiting' && (
              <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-400 border border-slate-600 font-semibold">
                waiting
              </span>
            )}
            {status === 'active' && (
              <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 border border-emerald-800 font-semibold">
                live
              </span>
            )}
            {status === 'ended' && (
              <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700 font-semibold">
                ended
              </span>
            )}
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            {status === 'waiting' && `${s.lobbyCount} in lobby · `}
            {status === 'active' && `${s.finishedCount}/${s.lobbyCount} finished · `}
            {new Date(s.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {confirmDelete?.type === 'session' && confirmDelete.id === s.id ? (
            <>
              <span className="text-xs text-slate-400">
                {isBatch ? `Delete all ${totalInBatch} parts?` : 'Delete this room?'}
              </span>
              <button onClick={() => handleDeleteSession(s.id, s.code)} disabled={deleting}
                className="px-3 py-1.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
                {deleting ? '…' : 'Delete'}
              </button>
              <button onClick={() => setConfirmDelete(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors">
                Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={() => copyLink(s.code)} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                Copy link
              </button>
              {status === 'waiting' && (
                <button onClick={() => handleStartGame(s.id)}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-colors">
                  ▶ Start
                </button>
              )}
              {status === 'active' && (
                <button onClick={() => handleEndGame(s.id)}
                  className="px-3 py-1.5 bg-red-800 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors">
                  ⏹ End
                </button>
              )}
              {(status === 'active' || status === 'ended') && (
                <Link href={`/teacher/sessions/${s.id}`}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition-colors">
                  View results
                </Link>
              )}
              {status === 'ended' && (
                <Link href={`/s/${s.code}/podium`}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded-lg transition-colors">
                  Podium
                </Link>
              )}
              <button onClick={() => setConfirmDelete({ type: 'session', id: s.id })}
                className="px-1 text-slate-600 hover:text-red-400 text-sm transition-colors">
                🗑
              </button>
            </>
          )}
        </div>
      </div>
    );
  })}
  ```

- [x] Verify full teacher flow in browser:
  1. Dashboard loads — see sessions with status badges
  2. Create new session → appears as "waiting" with 0 in lobby
  3. Student opens `/s/<code>`, enters name → dashboard lobby count increases within 3 s
  4. Teacher clicks "▶ Start" → session switches to "live", student sees countdown
  5. Student completes quiz → result appears in View results
  6. Teacher clicks "⏹ End" (or last student triggers auto) → session shows "ended" + Podium link

- [x] Commit:
  ```bash
  git add web/src/app/teacher/page.tsx
  git commit -m "feat: add lobby controls and session status to teacher dashboard"
  ```

---

### Task 12: E2E tests + regression

**Files:**
- Create: `web/e2e/lobby-and-podium.spec.ts`

- [x] Create `web/e2e/lobby-and-podium.spec.ts`:
  ```typescript
  import { test, expect } from '@playwright/test';

  test.describe('/join page', () => {
    test('shows code input and Join button', async ({ page }) => {
      await page.goto('/join');
      await expect(page.getByPlaceholder('Room code…')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Join →' })).toBeDisabled();
    });

    test('Join button enables when code is entered', async ({ page }) => {
      await page.goto('/join');
      await page.getByPlaceholder('Room code…').fill('abc123');
      await expect(page.getByRole('button', { name: 'Join →' })).toBeEnabled();
    });

    test('input auto-uppercases', async ({ page }) => {
      await page.goto('/join');
      await page.getByPlaceholder('Room code…').fill('abc');
      await expect(page.getByPlaceholder('Room code…')).toHaveValue('ABC');
    });

    test('submitting redirects to /s/CODE', async ({ page }) => {
      await page.goto('/join');
      await page.getByPlaceholder('Room code…').fill('ABC123');
      await page.getByRole('button', { name: 'Join →' }).click();
      await expect(page).toHaveURL(/\/s\/ABC123/);
    });
  });
  ```

- [x] Run the new E2E tests (requires SSH tunnel for DB):
  ```bash
  cd web && npm run test:e2e -- --grep "/join page"
  ```

- [x] Run full E2E regression:
  ```bash
  cd web && npm run test:e2e
  ```

- [x] Commit:
  ```bash
  git add web/e2e/lobby-and-podium.spec.ts docs/plans.md
  git commit -m "test: add E2E tests for /join page; tick checkboxes"
  ```

---

### Task 13: Deploy and verify

- [x] Push to GitHub:
  ```bash
  git push origin main
  ```

- [x] Wait for GitHub Actions CI to pass.

- [x] SSH to VPS and deploy:
  ```bash
  ssh -i ~/.ssh/digitalocean root@139.162.42.158
  cd /root/fce-quiz/web
  git pull
  npm install
  npm run build
  pm2 restart fce-quiz
  ```

- [x] Run the production migration (if not already done against production DB):
  ```bash
  # On VPS, using the production DATABASE_URL from .env.local:
  psql "$DATABASE_URL" -f db/migrations/<next>_session_status.sql
  ```

- [x] Verify:
  ```bash
  pm2 logs fce-quiz --lines 50
  # Check for errors
  ```
  Open `https://<vps-domain>/join` — verify the join page loads.

- [x] Update the Progress Overview table in this file:
  Change `| 9 | /join page, Lobby & Podium | §11 | ✅ Done |` to `| 9 | /join page, Lobby & Podium | §11 | ✅ Done |`
  Change `## Feature 9: /join page, Lobby & Podium ✅ Done` to `✅ Done`

- [x] Commit:
  ```bash
  git add docs/plans.md
  git commit -m "docs: mark feature 9 as done"
  git push origin main
  ```

---

## Feature 10: Wayground Redesign — Player Grid, Teacher Lobby, Podium 3D ✅ Done

**Spec:** §12 | **Depends on:** Feature 9

### Task 1: `GET /api/sessions/[id]/players` — Player list API

**File:** Create `web/src/app/api/sessions/[id]/players/route.ts`

This is a public endpoint (no auth) that returns the list of student names currently tracked in `session_progress` for a session. Called every 2s by both student lobby and teacher lobby page.

- [x] Create the file with this content:

  ```typescript
  import { NextRequest, NextResponse } from 'next/server';
  import { db } from '@/db/client';
  import { sessionProgress } from '@/db/schema';
  import { eq } from 'drizzle-orm';

  export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    const { id } = await params;
    const rows = await db
      .selectDistinct({ studentName: sessionProgress.studentName })
      .from(sessionProgress)
      .where(eq(sessionProgress.sessionId, id));
    return NextResponse.json({ players: rows.map((r) => r.studentName) });
  }
  ```

- [x] Start dev server if not running:
  ```bash
  cd web && node_modules/.bin/next dev
  ```

- [x] Verify the route works (replace UUID with a real session id from DB):
  ```bash
  curl http://localhost:3000/api/sessions/00000000-0000-0000-0000-000000000000/players
  # Expected: {"players":[]} (or a list of names if session has players)
  ```

- [x] Commit:
  ```bash
  git add web/src/app/api/sessions/[id]/players/route.ts
  git commit -m "feat: add GET /api/sessions/[id]/players endpoint"
  ```

- [x] Tick this task's checkbox in `docs/plans.md` and commit alongside code above (or in a separate commit).

---

### Task 2: Student lobby redesign — gradient background + player grid

**File:** Modify `web/src/app/s/[code]/page.tsx`

Changes:
1. Add `players` state.
2. Add `useEffect` that polls `/api/sessions/[sessionId]/players` every 2s while on lobby screen.
3. Replace the lobby JSX with Wayground-style layout: gradient background, prominent room code, player chips, count.

- [x] Add `players` state near the other `useState` calls (around line 51). The exact insertion: after the line `const [batchParts, setBatchParts] = useState<...>`:

  ```typescript
  const [players, setPlayers] = useState<string[]>([]);
  ```

- [x] Add a `useEffect` for polling players. Place it after the existing lobby poll effect (after line ~129). The effect depends on `screen`, `sessionId`:

  ```typescript
  useEffect(() => {
    if (screen !== 'lobby' || !sessionId) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/sessions/${sessionId}/players`);
      if (res.ok) {
        const data = await res.json() as { players: string[] };
        setPlayers(data.players);
      }
    }, 2000);
    // Fetch immediately on mount too
    fetch(`/api/sessions/${sessionId}/players`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setPlayers(data.players); });
    return () => clearInterval(interval);
  }, [screen, sessionId]);
  ```

- [x] Replace the entire lobby JSX block (lines 285–313, starting `// ── LOBBY` and ending before `// ── JOIN`). The new lobby:

  ```tsx
  // ── LOBBY ────────────────────────────────────────────────────────────────
  if (screen === 'lobby') return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-4 bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950">
      <div className="w-full max-w-md space-y-6 text-center">
        {/* Room code — prominent */}
        <div className="inline-block px-5 py-2 rounded-2xl bg-orange-500/20 border border-orange-500/40">
          <span className="font-mono text-4xl font-black text-orange-400 tracking-widest">
            {code.toUpperCase()}
          </span>
        </div>

        {/* Quiz title */}
        <p className="text-white/60 text-sm">{quiz?.title}</p>

        {/* Greeting */}
        <div className="space-y-1">
          <h1 className="text-white text-2xl font-bold">You&apos;re in the lobby!</h1>
          <p className="text-white/50 text-sm">Hi, {studentName} 👋</p>
        </div>

        {/* Player grid */}
        {players.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {players.map((p) => (
              <span
                key={p}
                className="rounded-full px-3 py-1 bg-white/10 border border-white/20 text-sm text-white"
              >
                {p}
              </span>
            ))}
          </div>
        )}

        {/* Count */}
        <p className="text-white/40 text-sm">
          {players.length} player{players.length !== 1 ? 's' : ''} joined
        </p>

        {/* Animated dots */}
        <div className="flex justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-orange-400"
              style={{ animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:0.2} 50%{opacity:1} }`}</style>
    </div>
  );
  ```

- [x] Open browser at `http://localhost:3000/s/TESTCODE` and enter a name when session status is `waiting`. Verify:
  - Background is dark gradient (not solid dark red `#2d0a1e`)
  - Room code shows large in orange monospace
  - Player chips appear after 2s (check with a real waiting session or mock)
  - Animated dots still pulse

- [x] Commit:
  ```bash
  git add web/src/app/s/[code]/page.tsx
  git commit -m "feat: redesign student lobby with gradient bg and player grid"
  ```

- [x] Tick checkbox in `docs/plans.md` and include in commit above.

---

### Task 3: Podium 3D redesign — blocks, confetti, reveal, score%

**File:** Replace `web/src/app/s/[code]/podium/page.tsx` entirely.

Key design:
- Gradient background (`from-slate-950 via-violet-950 to-slate-950`)
- 3D CSS podium: 2nd (h-24, slate) | 1st (h-32, yellow) | 3rd (h-20, amber) — left to right
- CSS-only confetti: 40 `<div>` elements, `@keyframes fall`
- Reveal animation: 3rd appears at `animationDelay: 0.5s`, 2nd at `1.2s`, 1st at `2.0s` (all slide up from `translateY(40px)`)
- Score format: `18 / 20 • 90%`
- Buttons: "▶ Play again" (→ `/s/${code}`) and "Home" (→ `/`)
- 4th+ players: simple list below podium

- [x] Replace the full content of `web/src/app/s/[code]/podium/page.tsx` with:

  ```tsx
  'use client';

  import { useEffect, useState } from 'react';
  import { useParams, useRouter } from 'next/navigation';
  import Link from 'next/link';

  interface PodiumEntry {
    rank: number;
    studentName: string;
    score: number;
    totalQuestions: number;
    timeSpentMs: number;
  }

  const CONFETTI_COLORS = ['#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#3b82f6', '#f97316'];

  function Confetti() {
    const pieces = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: `${i * 2.5}%`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: `${(i * 0.08).toFixed(2)}s`,
      duration: `${3 + (i % 3)}s`,
      width: `${6 + (i % 5)}px`,
      height: `${12 + (i % 7)}px`,
    }));
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {pieces.map((p) => (
          <div
            key={p.id}
            className="absolute top-0"
            style={{
              left: p.left,
              width: p.width,
              height: p.height,
              background: p.color,
              borderRadius: '2px',
              animationName: 'fall',
              animationDuration: p.duration,
              animationDelay: p.delay,
              animationTimingFunction: 'linear',
              animationFillMode: 'both',
              animationIterationCount: '1',
            }}
          />
        ))}
        <style>{`@keyframes fall { 0% { transform: translateY(-20px) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }`}</style>
      </div>
    );
  }

  const PODIUM_CONFIG = {
    1: { height: 'h-32', bg: 'bg-yellow-500', medal: '🥇', textSize: 'text-lg' },
    2: { height: 'h-24', bg: 'bg-slate-400', medal: '🥈', textSize: 'text-base' },
    3: { height: 'h-20', bg: 'bg-amber-700', medal: '🥉', textSize: 'text-base' },
  } as const;

  function PodiumBlock({ entry, animDelay }: { entry: PodiumEntry; animDelay: string }) {
    const rank = entry.rank as 1 | 2 | 3;
    const cfg = PODIUM_CONFIG[rank];
    const pct = Math.round((entry.score / entry.totalQuestions) * 100);
    return (
      <div
        className="flex flex-col items-center"
        style={{
          animationName: 'slideUp',
          animationDuration: '0.6s',
          animationDelay: animDelay,
          animationTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)',
          animationFillMode: 'both',
        }}
      >
        <span className="text-3xl mb-1">{cfg.medal}</span>
        <p className={`text-white font-bold mb-1 text-center w-24 truncate ${cfg.textSize}`}>{entry.studentName}</p>
        <p className="text-white/50 text-xs mb-2">
          {entry.score} / {entry.totalQuestions} • {pct}%
        </p>
        <div className={`w-24 sm:w-28 ${cfg.height} ${cfg.bg} rounded-t-xl flex items-center justify-center shadow-lg`}>
          <span className="text-white/30 text-4xl font-black">{rank}</span>
        </div>
      </div>
    );
  }

  export default function PodiumPage() {
    const { code } = useParams<{ code: string }>();
    const router = useRouter();
    const [entries, setEntries] = useState<PodiumEntry[]>([]);
    const [quizTitle, setQuizTitle] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      fetch(`/api/sessions/lookup?code=${code}`)
        .then((r) => r.ok ? r.json() : null)
        .then(async (session) => {
          if (!session) { setLoading(false); return; }
          setQuizTitle(session.quizTitle ?? '');
          const res = await fetch(`/api/sessions/${session.id}/podium`);
          if (res.ok) {
            const data = await res.json() as { entries: PodiumEntry[] };
            setEntries(data.entries);
          }
          setLoading(false);
        });
    }, [code]);

    if (loading) return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950">
        <p className="text-slate-500 text-sm">Loading results…</p>
      </div>
    );

    const top3 = entries.filter((e) => e.rank <= 3);
    const rest = entries.filter((e) => e.rank > 3);
    const byRank = (r: number) => top3.find((e) => e.rank === r);

    const REVEAL_DELAYS: Record<number, string> = { 3: '0.5s', 2: '1.2s', 1: '2.0s' };

    return (
      <div className="min-h-screen relative flex flex-col items-center justify-center px-4 py-8 bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950 overflow-hidden">
        <Confetti />

        <div className="relative z-10 w-full max-w-xl space-y-8 text-center">
          <div>
            <h1 className="text-white text-3xl font-black">Final Results</h1>
            {quizTitle && <p className="text-white/40 text-sm mt-1">{quizTitle}</p>}
          </div>

          {entries.length === 0 ? (
            <p className="text-slate-500 text-sm">No results yet.</p>
          ) : (
            <>
              {/* Podium: 2nd | 1st | 3rd */}
              <div className="flex items-end justify-center gap-4">
                {byRank(2) && <PodiumBlock entry={byRank(2)!} animDelay={REVEAL_DELAYS[2]} />}
                {byRank(1) && <PodiumBlock entry={byRank(1)!} animDelay={REVEAL_DELAYS[1]} />}
                {byRank(3) && <PodiumBlock entry={byRank(3)!} animDelay={REVEAL_DELAYS[3]} />}
              </div>

              {/* 4th+ */}
              {rest.length > 0 && (
                <div className="space-y-1.5">
                  {rest.map((entry) => {
                    const pct = Math.round((entry.score / entry.totalQuestions) * 100);
                    return (
                      <div key={entry.studentName} className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5">
                        <span className="text-slate-500 text-sm w-6 text-right shrink-0">{entry.rank}.</span>
                        <span className="flex-1 text-white/70 text-sm truncate text-left">{entry.studentName}</span>
                        <span className="text-slate-400 text-sm shrink-0">{entry.score} / {entry.totalQuestions} • {pct}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => router.push(`/s/${code}`)}
              className="flex-1 py-3.5 rounded-2xl text-white font-black text-base transition hover:brightness-110 active:scale-95"
              style={{ background: '#e86020', boxShadow: 'rgba(232,96,32,0.4) 0 4px 20px' }}
            >
              ▶ Play again
            </button>
            <Link
              href="/"
              className="px-6 py-3.5 rounded-2xl text-slate-300 font-semibold text-base bg-white/10 hover:bg-white/20 transition-colors"
            >
              Home
            </Link>
          </div>
        </div>

        <style>{`
          @keyframes slideUp {
            from { transform: translateY(40px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }
  ```

- [x] Open `http://localhost:3000/s/SOMECODE/podium` (use a real ended session code from DB or the teacher dashboard). Verify:
  - Dark violet gradient background
  - Confetti pieces fall from top
  - 2nd block on left (silver, shorter), 1st in center (gold, tallest), 3rd on right (bronze)
  - Blocks slide up with staggered delay
  - Score shows `X / Y • Z%` format
  - "▶ Play again" button is visible
  - "Home" link is visible

- [x] Commit:
  ```bash
  git add web/src/app/s/[code]/podium/page.tsx
  git commit -m "feat: redesign podium with 3D blocks, confetti, and score percentage"
  ```

- [x] Tick checkbox in `docs/plans.md` and include in commit.

---

### Task 4: Teacher lobby page — fullscreen projector view

**File:** Create `web/src/app/teacher/sessions/[id]/lobby/page.tsx`

This page is for the teacher to project on a classroom screen. It shows the room code large, the player list live, and a Start Game button. Teacher auth is enforced by the existing Next.js middleware (`/teacher/*` is protected).

- [x] Create directory and file:
  ```bash
  mkdir -p web/src/app/teacher/sessions/\[id\]/lobby
  ```

- [x] Create `web/src/app/teacher/sessions/[id]/lobby/page.tsx`:

  ```tsx
  'use client';

  import { useEffect, useState, useCallback } from 'react';
  import { useParams, useRouter } from 'next/navigation';

  interface SessionInfo {
    id: string;
    code: string;
    quiz: { title: string } | null;
  }

  export default function TeacherLobbyPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [session, setSession] = useState<SessionInfo | null>(null);
    const [players, setPlayers] = useState<string[]>([]);
    const [starting, setStarting] = useState(false);

    // Fetch session info once (teacher-authenticated)
    useEffect(() => {
      fetch(`/api/sessions/${id}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data: { session: SessionInfo } | null) => {
          if (data?.session) setSession(data.session);
        });
    }, [id]);

    // Poll player list every 2s
    const fetchPlayers = useCallback(async () => {
      const res = await fetch(`/api/sessions/${id}/players`);
      if (res.ok) {
        const data = await res.json() as { players: string[] };
        setPlayers(data.players);
      }
    }, [id]);

    useEffect(() => {
      fetchPlayers();
      const interval = setInterval(fetchPlayers, 2000);
      return () => clearInterval(interval);
    }, [fetchPlayers]);

    async function handleStart() {
      setStarting(true);
      await fetch(`/api/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });
      router.push('/teacher');
    }

    const code = session?.code ?? '';
    const title = session?.quiz?.title ?? '';

    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center px-6 bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950">
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 text-white/40 hover:text-white text-sm transition-colors"
        >
          ← Back
        </button>

        <div className="w-full max-w-3xl space-y-10 text-center">
          {title && <p className="text-white/60 text-lg font-medium">{title}</p>}

          {/* Room code — large */}
          <div>
            <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Room Code</p>
            <div className="inline-block px-10 py-5 rounded-2xl bg-white/5 border-2 border-white/10">
              <span className="font-mono text-7xl sm:text-8xl font-black text-orange-400 tracking-widest">
                {code.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Player count */}
          <p className="text-white/60 text-xl">
            {players.length} player{players.length !== 1 ? 's' : ''} joined
          </p>

          {/* Player grid */}
          {players.length > 0 && (
            <div className="flex flex-wrap justify-center gap-3">
              {players.map((p) => (
                <span
                  key={p}
                  className="rounded-full px-4 py-2 bg-white/10 border border-white/20 text-white text-base font-medium"
                >
                  {p}
                </span>
              ))}
            </div>
          )}

          {/* Start button */}
          <button
            onClick={handleStart}
            disabled={starting || players.length === 0}
            className="px-12 py-4 rounded-2xl text-white text-xl font-black transition disabled:opacity-40 hover:brightness-110 active:scale-95"
            style={{ background: '#e86020', boxShadow: 'rgba(232,96,32,0.4) 0 4px 24px' }}
          >
            {starting ? 'Starting…' : '▶ Start Game'}
          </button>
        </div>
      </div>
    );
  }
  ```

- [x] Verify the page loads at `http://localhost:3000/teacher/sessions/<real-session-id>/lobby` (use a real session id from dashboard). Confirm:
  - Gradient background shown
  - Room code displayed in large orange monospace
  - Player count updates every 2s
  - "▶ Start Game" button is visible (disabled when 0 players)
  - "← Back" button works

- [x] Commit:
  ```bash
  git add web/src/app/teacher/sessions/\[id\]/lobby/page.tsx
  git commit -m "feat: add teacher lobby fullscreen page with live player list"
  ```

- [x] Tick checkbox in `docs/plans.md` and include in commit.

---

### Task 5: Teacher dashboard — "👁 Lobby" link for waiting sessions

**File:** Modify `web/src/app/teacher/page.tsx`

Add a "👁 Lobby" link button next to "▶ Start" for sessions with `status === 'waiting'`. The link navigates to the new `/teacher/sessions/[id]/lobby` page.

- [x] In `web/src/app/teacher/page.tsx`, find the `status === 'waiting'` block (around line 339). It currently renders:

  ```tsx
  {status === 'waiting' && (
    <button onClick={() => handleStartGame(s.id)}
      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-colors">
      ▶ Start
    </button>
  )}
  ```

  Replace it with:

  ```tsx
  {status === 'waiting' && (
    <>
      <Link
        href={`/teacher/sessions/${s.id}/lobby`}
        className="px-3 py-1.5 bg-violet-700 hover:bg-violet-600 text-white text-xs font-semibold rounded-lg transition-colors"
      >
        👁 Lobby
      </Link>
      <button
        onClick={() => handleStartGame(s.id)}
        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-colors"
      >
        ▶ Start
      </button>
    </>
  )}
  ```

- [x] Verify in browser at `http://localhost:3000/teacher` — create or find a waiting session, confirm the "👁 Lobby" link appears next to "▶ Start", and clicking it navigates to the new teacher lobby page.

- [x] Commit:
  ```bash
  git add web/src/app/teacher/page.tsx
  git commit -m "feat: add Lobby link on teacher dashboard for waiting sessions"
  ```

- [x] Tick checkbox in `docs/plans.md` and include in commit.

---

### Task 6: E2E tests + deploy

**Files:**
- Modify `web/e2e/lobby-and-podium.spec.ts` — add tests for redesigned UI
- Deploy to production

#### 6a — E2E tests

- [x] Add the following test blocks to `web/e2e/lobby-and-podium.spec.ts` (append after the existing `/join page` tests):

  ```typescript
  test.describe('Teacher Lobby Page — unauthenticated', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('unauthenticated user is redirected from teacher lobby page', async ({ page }) => {
      await page.goto('/teacher/sessions/00000000-0000-0000-0000-000000000000/lobby');
      await page.waitForURL(/\/teacher\/login/, { timeout: 5000 });
    });
  });

  test.describe('Teacher Lobby Page — authenticated', () => {
    test('teacher can access lobby page for waiting session', async ({ browser }) => {
      const teacherContext = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
      const teacherPage = await teacherContext.newPage();

      await teacherPage.goto('/teacher');
      await teacherPage.waitForLoadState('networkidle');

      // Find "👁 Lobby" link (only for waiting sessions)
      const lobbyLink = teacherPage.locator('a[href*="/teacher/sessions/"][href*="/lobby"]').first();
      const count = await lobbyLink.count();
      if (count === 0) {
        await teacherContext.close();
        test.skip();
        return;
      }

      await lobbyLink.click();
      // Lobby page shows the room code (monospace large text in orange)
      await expect(teacherPage.locator('text=Room Code')).toBeVisible({ timeout: 5000 });

      await teacherContext.close();
    });
  });

  test.describe('Podium Page', () => {
    test('podium page has Play again button', async ({ browser }) => {
      // Use teacher auth to find an ended session with a podium
      const teacherContext = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
      const teacherPage = await teacherContext.newPage();

      await teacherPage.goto('/teacher');
      await teacherPage.waitForLoadState('networkidle');

      // Find "Podium" link (only for ended sessions)
      const podiumLink = teacherPage.locator('a[href*="/s/"][href*="/podium"]').first();
      const count = await podiumLink.count();
      if (count === 0) {
        await teacherContext.close();
        test.skip();
        return;
      }

      const href = await podiumLink.getAttribute('href').catch(() => null);
      if (!href) {
        await teacherContext.close();
        test.skip();
        return;
      }

      // Open podium as public (no auth needed)
      const publicContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const podiumPage = await publicContext.newPage();
      await podiumPage.goto(href);

      await expect(podiumPage.locator('text=Play again')).toBeVisible({ timeout: 8000 });

      await teacherContext.close();
      await publicContext.close();
    });
  });
  ```

- [x] Run only the lobby-and-podium spec to verify tests pass:
  ```bash
  cd web && E2E_EMAIL="e2e-test@fce-quiz.local" E2E_PASSWORD="e2e-test-2026" \
    /Users/halinh/.nvm/versions/node/v20.16.0/bin/node \
    node_modules/.bin/playwright test e2e/lobby-and-podium.spec.ts
  ```
  Expected: all tests pass (podium test skips if no ended session exists, that's fine).

- [x] Run full E2E regression to catch any regressions:
  ```bash
  cd web && E2E_EMAIL="e2e-test@fce-quiz.local" E2E_PASSWORD="e2e-test-2026" \
    /Users/halinh/.nvm/versions/node/v20.16.0/bin/node \
    node_modules/.bin/playwright test
  ```
  Expected: no failures.

- [x] Commit:
  ```bash
  git add web/e2e/lobby-and-podium.spec.ts docs/plans.md
  git commit -m "test: add E2E tests for teacher lobby redirect and podium Play again"
  ```

#### 6b — Deploy

- [x] Push to GitHub:
  ```bash
  git push origin main
  ```

- [x] Wait for GitHub Actions CI to pass (check at https://github.com).

- [x] SSH to VPS and deploy:
  ```bash
  ssh -i ~/.ssh/digitalocean root@139.162.42.158
  cd /root/fce-quiz/web
  git pull
  npm install
  npm run build
  pm2 restart fce-quiz
  ```

- [x] Verify:
  ```bash
  pm2 logs fce-quiz --lines 50
  ```
  Open production URL — check teacher dashboard, lobby page, and podium page.

- [x] Update progress table in `docs/plans.md`:
  Change `| 10 | Wayground Redesign ... | §12 | ⬜ Planned |` to `| 10 | Wayground Redesign ... | §12 | ✅ Done |`
  Also update the heading to `✅ Done`.

- [x] Commit:
  ```bash
  git add docs/plans.md
  git commit -m "docs: mark feature 10 as done"
  git push origin main
  ```


---

## Feature 11: Wayground Teacher + Student Dashboard Redesign (§13) 🚧

**Spec:** §13 | **Depends on:** Features 2, 4, 5, 6, 9, 10

**Architecture:** Add a 72px TeacherSidebar + 240px QuizzesPanel (on `/teacher/quizzes/*` only) shell inside `teacher/layout.tsx`. Extract quiz list → `quizzes/page.tsx` and session list → `sessions/page.tsx` from the old monolith `teacher/page.tsx`. Mirror the same approach for student with `StudentSidebar` + `student/layout.tsx`. Dark/light theme via `useTheme.ts` hook + Tailwind v4 `@variant dark`.

---

### Task 11.1: Theme system — dark variant + useTheme hook + root layout anti-flash

**Files:**
- Modify: `web/src/app/globals.css`
- Create: `web/src/hooks/useTheme.ts`
- Modify: `web/src/app/layout.tsx`

- [x] **Step 1: Add Tailwind v4 dark-mode class variant to globals.css**

  Open `web/src/app/globals.css`. After the first line `@import "tailwindcss";`, add:
  ```css
  @variant dark (&:where(.dark, .dark *));
  ```
  This makes all `dark:*` utility classes activate when any ancestor has class `dark` (equivalent to `darkMode: 'class'` in Tailwind v3).

- [x] **Step 2: Create `web/src/hooks/useTheme.ts`**

  ```typescript
  'use client';
  import { useState, useEffect } from 'react';

  export function useTheme(): { theme: 'light' | 'dark'; toggleTheme: () => void } {
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');

    useEffect(() => {
      const stored = localStorage.getItem('fce-theme');
      const resolved: 'light' | 'dark' = stored === 'light' ? 'light' : 'dark';
      setTheme(resolved);
      if (resolved === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }, []);

    const toggleTheme = () => {
      const next: 'light' | 'dark' = theme === 'dark' ? 'light' : 'dark';
      setTheme(next);
      localStorage.setItem('fce-theme', next);
      document.documentElement.classList.toggle('dark', next === 'dark');
    };

    return { theme, toggleTheme };
  }
  ```

- [x] **Step 3: Update `web/src/app/layout.tsx`**

  Replace the entire file with:
  ```tsx
  import type { Metadata } from 'next';
  import { Geist } from 'next/font/google';
  import './globals.css';
  import Providers from '@/components/Providers';
  import NavBar from '@/components/NavBar';

  const geist = Geist({ subsets: ['latin'] });

  export const metadata: Metadata = {
    title: 'FCE Quiz',
    description: 'Practice B2 First for Schools exam questions',
  };

  export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
      <html lang="en">
        <head>
          {/* Anti-flash: apply dark class before React hydrates. Default: dark. */}
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){var t=localStorage.getItem('fce-theme');if(t!=='light')document.documentElement.classList.add('dark');})()`
            }}
          />
        </head>
        <body className={`${geist.className} bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100 min-h-screen`}>
          <Providers>
            <NavBar />
            <main>{children}</main>
          </Providers>
        </body>
      </html>
    );
  }
  ```

- [x] **Step 4: Verify in browser**

  Run `cd web && node_modules/.bin/next dev`. Open `http://localhost:3000`. The page should look the same as before (dark background), because the anti-flash script defaults to dark mode. Open DevTools → Elements: `<html>` should have class `dark`.

- [x] **Step 5: Commit**
  ```bash
  git add web/src/app/globals.css web/src/hooks/useTheme.ts web/src/app/layout.tsx
  git commit -m "feat: add dark/light theme system with useTheme hook and anti-flash script"
  ```

---

### Task 11.2: TeacherSidebar component

**Files:**
- Create: `web/src/components/teacher/TeacherSidebar.tsx`

- [x] **Step 1: Create the directory and file**

  Create `web/src/components/teacher/TeacherSidebar.tsx`:
  ```tsx
  'use client';

  import Link from 'next/link';
  import { usePathname } from 'next/navigation';
  import { signOut, useSession } from 'next-auth/react';
  import { useTheme } from '@/hooks/useTheme';

  function BookIcon() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    );
  }
  function MonitorIcon() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    );
  }
  function UsersIcon() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    );
  }
  function SunIcon() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      </svg>
    );
  }
  function MoonIcon() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    );
  }
  function LogOutIcon() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
    );
  }

  const NAV_ITEMS = [
    { href: '/teacher/quizzes', label: 'Quizzes', Icon: BookIcon },
    { href: '/teacher/sessions', label: 'Sessions', Icon: MonitorIcon },
    { href: '/teacher/students', label: 'Students', Icon: UsersIcon },
  ];

  export default function TeacherSidebar() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const { theme, toggleTheme } = useTheme();
    const initials = (session?.user?.name ?? 'T')[0]?.toUpperCase() ?? 'T';

    return (
      <aside className="w-[72px] shrink-0 h-full border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col items-center py-3 gap-1">
        {/* Logo */}
        <Link
          href="/teacher/quizzes"
          className="w-10 h-10 flex items-center justify-center text-blue-600 dark:text-blue-400 font-black text-base mb-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="FCEQuiz"
        >
          FQ
        </Link>

        {/* Nav */}
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`w-12 h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon />
              <span className="text-[9px] font-medium leading-none">{label}</span>
            </Link>
          );
        })}

        <div className="flex-1" />

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="w-12 h-12 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>

        {/* Sign out */}
        <button
          onClick={() => signOut({ redirectTo: '/teacher/login' })}
          title="Sign out"
          className="w-12 h-12 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <LogOutIcon />
        </button>

        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center mt-1 shrink-0"
          title={session?.user?.name ?? ''}
        >
          {initials}
        </div>
      </aside>
    );
  }
  ```

- [x] **Step 2: Commit**
  ```bash
  git add web/src/components/teacher/TeacherSidebar.tsx
  git commit -m "feat: add TeacherSidebar component with nav, theme toggle, sign out"
  ```

---

### Task 11.3: QuizzesPanel component

**Files:**
- Create: `web/src/components/teacher/QuizzesPanel.tsx`

- [x] **Step 1: Create `web/src/components/teacher/QuizzesPanel.tsx`**

  ```tsx
  'use client';

  import Link from 'next/link';
  import { usePathname, useSearchParams } from 'next/navigation';
  import { useEffect, useState } from 'react';

  const MAX_QUIZZES = 20;

  export default function QuizzesPanel() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const filter = searchParams.get('filter');
    const [quizCount, setQuizCount] = useState(0);

    useEffect(() => {
      fetch('/api/quizzes')
        .then((r) => r.json())
        .then((d: unknown) => { if (Array.isArray(d)) setQuizCount(d.length); })
        .catch(() => {});
    }, [pathname]);

    const progress = Math.min((quizCount / MAX_QUIZZES) * 100, 100);
    const isRecent = filter === 'recent';

    return (
      <aside className="w-[240px] shrink-0 h-full border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col py-4">
        <p className="px-4 text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Quizzes</p>

        <Link
          href="/teacher/quizzes"
          className={`mx-2 px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
            !isRecent
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-medium'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'
          }`}
        >
          <span>✏️</span>
          <span>All <span className="text-slate-400 dark:text-slate-500">({quizCount})</span></span>
        </Link>

        <Link
          href="/teacher/quizzes?filter=recent"
          className={`mx-2 px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
            isRecent
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-medium'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'
          }`}
        >
          <span>🕐</span>
          <span>Recently used</span>
        </Link>

        <div className="flex-1" />

        <div className="px-4 space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">{quizCount} / {MAX_QUIZZES} quizzes</p>
          <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </aside>
    );
  }
  ```

- [x] **Step 2: Commit**
  ```bash
  git add web/src/components/teacher/QuizzesPanel.tsx
  git commit -m "feat: add QuizzesPanel second-panel component"
  ```

---

### Task 11.4: Teacher layout — rebuild as Wayground shell

**Files:**
- Modify: `web/src/app/teacher/layout.tsx`

- [x] **Step 1: Replace `web/src/app/teacher/layout.tsx` entirely**

  ```tsx
  'use client';

  import { usePathname } from 'next/navigation';
  import { Toaster } from 'sonner';
  import { Suspense } from 'react';
  import TeacherSidebar from '@/components/teacher/TeacherSidebar';
  import QuizzesPanel from '@/components/teacher/QuizzesPanel';

  export default function TeacherLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isPublic = pathname === '/teacher/login' || pathname === '/teacher/register';
    const showQuizzesPanel = pathname.startsWith('/teacher/quizzes');

    if (isPublic) {
      return (
        <>
          {children}
          <Toaster richColors position="top-right" />
        </>
      );
    }

    return (
      <div className="h-screen overflow-hidden flex bg-slate-50 dark:bg-slate-950">
        <TeacherSidebar />
        {showQuizzesPanel && (
          <Suspense>
            <QuizzesPanel />
          </Suspense>
        )}
        <main className="flex-1 overflow-y-auto min-w-0">
          {children}
        </main>
        <Toaster richColors position="top-right" />
      </div>
    );
  }
  ```

  > `Suspense` around `QuizzesPanel` is required because it uses `useSearchParams()`.

- [x] **Step 2: Verify dev server starts without errors**

  ```bash
  cd web && node_modules/.bin/next dev
  ```

  Navigate to `http://localhost:3000/teacher/login` — should show the login form without sidebar.
  Navigate to `http://localhost:3000/teacher` — should redirect to `/teacher/quizzes` (after Task 11.7). For now it loads the old teacher/page.tsx content, but with the sidebar visible on the left.

- [x] **Step 3: Commit**
  ```bash
  git add web/src/app/teacher/layout.tsx
  git commit -m "feat: rebuild teacher layout as Wayground sidebar shell"
  ```

---

### Task 11.5: Quizzes page — extract quiz list from teacher/page.tsx

**Files:**
- Create: `web/src/app/teacher/quizzes/page.tsx`

- [x] **Step 1: Create `web/src/app/teacher/quizzes/page.tsx`**

  ```tsx
  'use client';

  import { useEffect, useState, useCallback } from 'react';
  import { useSearchParams } from 'next/navigation';
  import Link from 'next/link';
  import { toast } from 'sonner';

  interface QuizRow {
    id: string;
    title: string;
    questions: unknown[];
    time_per_question: number;
    source?: string;
  }

  interface SessionRow {
    id: string;
    quizId: string;
  }

  interface BatchResult {
    batchId: string;
    quizTitle: string;
    parts: { id: string; code: string; batchOrder: number; questionCount: number }[];
  }

  export default function QuizzesPage() {
    const searchParams = useSearchParams();
    const filter = searchParams.get('filter');

    const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
    const [sessions, setSessions] = useState<SessionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [creatingFor, setCreatingFor] = useState<string | null>(null);
    const [newSessionCode, setNewSessionCode] = useState<string | null>(null);
    const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
    const [copied, setCopied] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    const load = useCallback(async () => {
      const [qRes, sRes] = await Promise.all([
        fetch('/api/quizzes').then((r) => r.json()),
        fetch('/api/sessions').then((r) => r.json()),
      ]);
      setQuizzes(Array.isArray(qRes) ? qRes : []);
      setSessions(Array.isArray(sRes) ? sRes : []);
      setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const quizIdsWithSessions = new Set(sessions.map((s) => s.quizId));

    const filtered = quizzes.filter((q) => {
      const matchesSearch = q.title.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter !== 'recent' || quizIdsWithSessions.has(q.id);
      return matchesSearch && matchesFilter;
    });

    async function handleCreate(quizId: string) {
      setCreatingFor(quizId);
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId }),
      });
      if (res.ok) {
        const s = await res.json() as { code: string };
        setNewSessionCode(s.code);
        setBatchResult(null);
        await load();
      }
      setCreatingFor(null);
    }

    async function handleCreateBatch(quizId: string) {
      setCreatingFor(quizId + ':batch');
      const res = await fetch('/api/sessions/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId }),
      });
      if (res.ok) {
        const result = await res.json() as BatchResult;
        setBatchResult(result);
        setNewSessionCode(null);
        await load();
      }
      setCreatingFor(null);
    }

    async function handleDelete(id: string, title: string) {
      setDeleting(true);
      const res = await fetch(`/api/quizzes/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        toast.error(`Failed to delete "${title}": ${body.error ?? res.status}`);
      } else {
        toast.success(`Deleted "${title}"`);
        await load();
      }
      setConfirmDelete(null);
      setDeleting(false);
    }

    function copyLink(code: string) {
      const url = `${window.location.origin}/s/${code}`;
      navigator.clipboard?.writeText(url).catch(() => {
        const el = document.createElement('textarea');
        el.value = url;
        el.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }

    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-500 text-sm">Loading…</p>
        </div>
      );
    }

    const createdCount = quizzes.length;

    return (
      <div className="px-6 py-6 max-w-4xl mx-auto space-y-6">
        {/* New session banner */}
        {newSessionCode && (
          <div className="bg-emerald-950 border border-emerald-700 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-emerald-400 font-bold text-sm">✓ Room created!</p>
              <p className="text-white font-mono text-3xl font-black mt-1 tracking-widest">{newSessionCode}</p>
              <p className="text-emerald-600 text-xs mt-1">{window.location.origin}/s/{newSessionCode}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => copyLink(newSessionCode)}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm rounded-xl font-semibold transition-colors"
              >
                {copied ? '✓ Copied' : 'Copy link'}
              </button>
              <button
                onClick={() => setNewSessionCode(null)}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Batch banner */}
        {batchResult && (
          <div className="bg-blue-950 border border-blue-700 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-blue-400 font-bold text-sm">
                ✓ Batch created — {batchResult.parts.length} parts · {batchResult.quizTitle}
              </p>
              <button onClick={() => setBatchResult(null)} className="text-slate-500 hover:text-slate-300 text-xl leading-none">×</button>
            </div>
            <div className="space-y-2">
              {batchResult.parts.map((part) => (
                <div key={part.id} className="flex items-center gap-3 bg-blue-900/30 rounded-xl px-4 py-2.5">
                  <span className="text-blue-300 text-xs font-semibold w-14 shrink-0">Part {part.batchOrder}/{batchResult.parts.length}</span>
                  <span className="font-mono font-black text-white text-lg tracking-widest w-20">{part.code}</span>
                  <span className="text-slate-400 text-xs flex-1">{part.questionCount} questions</span>
                  <button onClick={() => copyLink(part.code)} className="text-xs text-blue-400 hover:text-blue-200 transition-colors">
                    Copy
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search + Add quiz */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search by quiz name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <Link
            href="/teacher/quizzes/new"
            className="shrink-0 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            + Add quiz
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
          <button className="text-sm font-semibold text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 pb-3 -mb-3">
            Created ({createdCount})
          </button>
          <button className="text-sm text-slate-400 dark:text-slate-600">Draft (0)</button>
          <button className="text-sm text-slate-400 dark:text-slate-600">Archived (0)</button>
        </div>

        {/* Quiz list */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
            <p className="text-slate-500 text-sm">{search ? 'No quizzes match your search.' : 'No quiz sets yet.'}</p>
            {!search && (
              <Link href="/teacher/quizzes/new" className="text-blue-400 hover:underline text-sm">
                Upload your first quiz →
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((quiz) => (
              <div key={quiz.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 dark:text-white font-semibold truncate">{quiz.title}</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {quiz.questions.length} questions · {quiz.time_per_question}s/q{quiz.source ? ` · ${quiz.source}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {confirmDelete === quiz.id ? (
                    <>
                      <span className="text-xs text-slate-400">Delete quiz + all room data?</span>
                      <button
                        onClick={() => handleDelete(quiz.id, quiz.title)}
                        disabled={deleting}
                        className="px-3 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                      >
                        {deleting ? '…' : 'Delete'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setConfirmDelete(quiz.id)}
                        className="px-2 py-2 text-slate-400 hover:text-red-400 text-sm transition-colors"
                      >
                        🗑
                      </button>
                      <Link
                        href={`/teacher/quizzes/${quiz.id}`}
                        className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl transition-colors"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleCreate(quiz.id)}
                        disabled={!!creatingFor}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                      >
                        {creatingFor === quiz.id ? '…' : '▶ Start'}
                      </button>
                      <button
                        onClick={() => handleCreateBatch(quiz.id)}
                        disabled={!!creatingFor}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                      >
                        {creatingFor === quiz.id + ':batch' ? '…' : '+ Batch'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  ```

- [x] **Step 2: Verify in browser**

  Navigate to `http://localhost:3000/teacher/quizzes`. Confirm:
  - Search input works (type a letter, list filters)
  - "Created (N)" tab shows correct count
  - Quiz cards show with Edit + ▶ Start + Batch buttons
  - Clicking "▶ Start" creates a room and shows the banner

- [x] **Step 3: Commit**
  ```bash
  git add web/src/app/teacher/quizzes/page.tsx
  git commit -m "feat: add teacher quizzes page with search and tabs"
  ```

---

### Task 11.6: Sessions page — extract session list from teacher/page.tsx

**Files:**
- Create: `web/src/app/teacher/sessions/page.tsx`

- [x] **Step 1: Create `web/src/app/teacher/sessions/page.tsx`**

  ```tsx
  'use client';

  import { useEffect, useState, useCallback } from 'react';
  import Link from 'next/link';
  import { toast } from 'sonner';

  interface SessionRow {
    id: string;
    code: string;
    status: string;
    quizTitle: string;
    quizId: string;
    batchId?: string | null;
    batchOrder?: number | null;
    lobbyCount: number;
    finishedCount: number;
    createdAt: string;
  }

  type FilterTab = 'all' | 'waiting' | 'active' | 'ended';

  export default function SessionsPage() {
    const [sessions, setSessions] = useState<SessionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<FilterTab>('all');
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    const load = useCallback(async () => {
      const res = await fetch('/api/sessions');
      const data = await res.json() as SessionRow[];
      setSessions(Array.isArray(data) ? data : []);
      setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    // Auto-refresh when active/waiting sessions exist
    useEffect(() => {
      const hasLive = sessions.some((s) => s.status === 'waiting' || s.status === 'active');
      if (!hasLive) return;
      const id = setInterval(load, 3000);
      return () => clearInterval(id);
    }, [sessions, load]);

    async function handleStart(id: string) {
      const res = await fetch(`/api/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });
      if (!res.ok) { toast.error('Failed to start game'); return; }
      await load();
    }

    async function handleEnd(id: string) {
      const res = await fetch(`/api/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ended' }),
      });
      if (!res.ok) { toast.error('Failed to end game'); return; }
      await load();
    }

    async function handleDelete(id: string, code: string) {
      setDeleting(true);
      const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        toast.error(`Failed to delete room ${code}: ${body.error ?? res.status}`);
      } else {
        toast.success(`Deleted room ${code}`);
        await load();
      }
      setConfirmDelete(null);
      setDeleting(false);
    }

    function copyLink(code: string) {
      const url = `${window.location.origin}/s/${code}`;
      navigator.clipboard?.writeText(url).catch(() => {
        const el = document.createElement('textarea');
        el.value = url;
        el.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      });
    }

    const TABS: { key: FilterTab; label: string }[] = [
      { key: 'all', label: 'All' },
      { key: 'waiting', label: 'Waiting' },
      { key: 'active', label: 'Active' },
      { key: 'ended', label: 'Ended' },
    ];

    const displayed = tab === 'all' ? sessions : sessions.filter((s) => s.status === tab);

    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-500 text-sm">Loading…</p>
        </div>
      );
    }

    return (
      <div className="px-6 py-6 max-w-4xl mx-auto space-y-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Sessions</h1>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === key
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Session list */}
        {displayed.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <p className="text-slate-500 text-sm">No sessions{tab !== 'all' ? ` with status "${tab}"` : ''} yet.</p>
            <p className="text-xs text-slate-400 mt-2">Create a session from the Quizzes page.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayed.map((s) => {
              const isBatch = !!s.batchId;
              const totalInBatch = isBatch ? sessions.filter((x) => x.batchId === s.batchId).length : null;
              return (
                <div key={s.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-3 flex items-center gap-4">
                  <span className="font-mono font-black text-lg text-orange-400 w-20 shrink-0">{s.code}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-slate-900 dark:text-white text-sm font-medium truncate">{s.quizTitle}</p>
                      {isBatch && (
                        <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-semibold">
                          Part {s.batchOrder}/{totalInBatch}
                        </span>
                      )}
                      {s.status === 'waiting' && (
                        <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 font-semibold">
                          waiting
                        </span>
                      )}
                      {s.status === 'active' && (
                        <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-semibold">
                          live
                        </span>
                      )}
                      {s.status === 'ended' && (
                        <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 font-semibold">
                          ended
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {s.status === 'waiting' && `${s.lobbyCount} in lobby · `}
                      {s.status === 'active' && `${s.finishedCount}/${s.lobbyCount} finished · `}
                      {new Date(s.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {confirmDelete === s.id ? (
                      <>
                        <span className="text-xs text-slate-400">
                          {isBatch ? `Delete all ${totalInBatch} parts?` : 'Delete this room?'}
                        </span>
                        <button
                          onClick={() => handleDelete(s.id, s.code)}
                          disabled={deleting}
                          className="px-3 py-1.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          {deleting ? '…' : 'Delete'}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => copyLink(s.code)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                          Copy link
                        </button>
                        {s.status === 'waiting' && (
                          <>
                            <Link
                              href={`/teacher/sessions/${s.id}/lobby`}
                              className="px-3 py-1.5 bg-violet-700 hover:bg-violet-600 text-white text-xs font-semibold rounded-lg transition-colors"
                            >
                              👁 Lobby
                            </Link>
                            <button
                              onClick={() => handleStart(s.id)}
                              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-colors"
                            >
                              ▶ Start
                            </button>
                          </>
                        )}
                        {s.status === 'active' && (
                          <button
                            onClick={() => handleEnd(s.id)}
                            className="px-3 py-1.5 bg-red-800 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors"
                          >
                            ⏹ End
                          </button>
                        )}
                        {(s.status === 'active' || s.status === 'ended') && (
                          <Link
                            href={`/teacher/sessions/${s.id}`}
                            className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-white text-xs font-semibold rounded-lg transition-colors"
                          >
                            View results
                          </Link>
                        )}
                        {s.status === 'ended' && (
                          <Link
                            href={`/s/${s.code}/podium`}
                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-lg transition-colors"
                          >
                            Podium
                          </Link>
                        )}
                        <button
                          onClick={() => setConfirmDelete(s.id)}
                          className="px-1 text-slate-400 hover:text-red-400 text-sm transition-colors"
                        >
                          🗑
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
  ```

- [x] **Step 2: Verify in browser**

  Navigate to `http://localhost:3000/teacher/sessions`. Confirm:
  - Sessions list loads
  - Filter tabs work (click Waiting, Active, Ended)
  - Action buttons (Lobby, Start, End, View results, Podium, Delete) appear correctly per status

- [x] **Step 3: Commit**
  ```bash
  git add web/src/app/teacher/sessions/page.tsx
  git commit -m "feat: add teacher sessions page with filter tabs"
  ```

---

### Task 11.7: teacher/page.tsx — replace with redirect

**Files:**
- Modify: `web/src/app/teacher/page.tsx`

- [x] **Step 1: Replace `web/src/app/teacher/page.tsx` entirely**

  ```tsx
  import { redirect } from 'next/navigation';

  export default function TeacherPage() {
    redirect('/teacher/quizzes');
  }
  ```

- [x] **Step 2: Verify redirect**

  Navigate to `http://localhost:3000/teacher`. Should immediately land on `/teacher/quizzes`.

- [x] **Step 3: Commit**
  ```bash
  git add web/src/app/teacher/page.tsx
  git commit -m "feat: redirect /teacher to /teacher/quizzes"
  ```

---

### Task 11.8: Remove old sticky headers from three sub-pages

**Files:**
- Modify: `web/src/app/teacher/quizzes/new/page.tsx`
- Modify: `web/src/app/teacher/quizzes/[id]/page.tsx`
- Modify: `web/src/app/teacher/sessions/[id]/page.tsx`

#### 11.8a — quizzes/new/page.tsx

- [x] **Step 1: Remove the sticky header block**

  In `web/src/app/teacher/quizzes/new/page.tsx`, find and remove the `<header>` block. The return statement starts at `return (` followed by `<div className="min-h-screen bg-slate-950">`. Replace:

  ```tsx
  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 sticky top-0 z-10 bg-slate-950/80 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/teacher" className="text-slate-500 hover:text-slate-300 text-sm">← Dashboard</Link>
          <span className="text-slate-700">/</span>
          <span className="text-white text-sm font-semibold">Upload new quiz</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
  ```

  With:

  ```tsx
  return (
    <div className="bg-slate-50 dark:bg-slate-950">
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-slate-900 dark:text-white font-bold text-lg">Upload new quiz</h1>
  ```

- [x] **Step 2: Verify in browser**

  Navigate to `http://localhost:3000/teacher/quizzes/new`. The page renders with the sidebar on the left, no duplicate header at top. The "Upload new quiz" title appears in the main content.

- [x] **Step 3: Commit**
  ```bash
  git add web/src/app/teacher/quizzes/new/page.tsx
  git commit -m "fix: remove sticky header from quizzes/new page"
  ```

#### 11.8b — quizzes/[id]/page.tsx

- [x] **Step 1: Remove the sticky header from quiz editor**

  In `web/src/app/teacher/quizzes/[id]/page.tsx`, find the return JSX (starts at `return (`). Replace:

  ```tsx
  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 sticky top-0 z-10 bg-slate-950/80 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/teacher" className="text-slate-500 hover:text-slate-300 text-sm shrink-0">← Dashboard</Link>
            <span className="text-slate-700">/</span>
            <span className="text-white text-sm font-semibold truncate">{quiz.title}</span>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-3">
  ```

  With:

  ```tsx
  return (
    <div className="bg-slate-50 dark:bg-slate-950">
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-3">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h1 className="text-slate-900 dark:text-white font-bold text-lg truncate">{quiz.title}</h1>
          <button
            onClick={handleSave}
            disabled={saving}
            className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
          </button>
        </div>
  ```

- [x] **Step 2: Commit**
  ```bash
  git add web/src/app/teacher/quizzes/[id]/page.tsx
  git commit -m "fix: remove sticky header from quiz editor page"
  ```

#### 11.8c — sessions/[id]/page.tsx

- [x] **Step 1: Remove the sticky header from session detail page**

  In `web/src/app/teacher/sessions/[id]/page.tsx`, find the return JSX. Replace:

  ```tsx
  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 sticky top-0 z-10 bg-slate-950/80 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/teacher" className="text-slate-500 hover:text-slate-300 text-sm">← Dashboard</Link>
            <span className="text-slate-700">/</span>
            <span className="text-white text-sm font-semibold truncate max-w-xs">{session.quiz?.title}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={copyLink} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
              Copy link /s/{session.code}
            </button>
            <Link href={`/teacher/sessions/${id}/live`} className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium">
              ▶ Live View
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
  ```

  With:

  ```tsx
  return (
    <div className="bg-slate-50 dark:bg-slate-950">
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-slate-900 dark:text-white font-bold text-lg truncate">{session.quiz?.title}</h1>
          <div className="flex items-center gap-3">
            <button onClick={copyLink} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
              Copy link /s/{session.code}
            </button>
            <Link href={`/teacher/sessions/${id}/live`} className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium">
              ▶ Live View
            </Link>
          </div>
        </div>
  ```

- [x] **Step 2: Commit**
  ```bash
  git add web/src/app/teacher/sessions/[id]/page.tsx
  git commit -m "fix: remove sticky header from session detail page"
  ```

---

### Task 11.9: StudentSidebar component

**Files:**
- Create: `web/src/components/student/StudentSidebar.tsx`

- [x] **Step 1: Create `web/src/components/student/StudentSidebar.tsx`**

  ```tsx
  'use client';

  import Link from 'next/link';
  import { usePathname } from 'next/navigation';
  import { signOut, useSession } from 'next-auth/react';
  import { useTheme } from '@/hooks/useTheme';

  function UserIcon() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    );
  }
  function BookOpenIcon() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    );
  }
  function TrophyIcon() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
      </svg>
    );
  }
  function SunIcon() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      </svg>
    );
  }
  function MoonIcon() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    );
  }
  function LogOutIcon() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
    );
  }

  const NAV_ITEMS = [
    { href: '/student/profile', label: 'Profile', Icon: UserIcon },
    { href: '/student/leaderboard', label: 'Scores', Icon: TrophyIcon },
  ];

  export default function StudentSidebar() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const { theme, toggleTheme } = useTheme();
    const name = (session?.user as { username?: string } | undefined)?.username
      ?? session?.user?.name
      ?? 'S';
    const initials = name[0]?.toUpperCase() ?? 'S';

    return (
      <aside className="w-[72px] shrink-0 h-full border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col items-center py-3 gap-1">
        {/* Logo */}
        <Link
          href="/student/profile"
          className="w-10 h-10 flex items-center justify-center text-blue-600 dark:text-blue-400 font-black text-base mb-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="FCEQuiz"
        >
          FQ
        </Link>

        {/* Nav */}
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`w-12 h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon />
              <span className="text-[9px] font-medium leading-none">{label}</span>
            </Link>
          );
        })}

        <div className="flex-1" />

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="w-12 h-12 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>

        {/* Sign out */}
        <button
          onClick={() => signOut({ redirectTo: '/student/login' })}
          title="Sign out"
          className="w-12 h-12 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <LogOutIcon />
        </button>

        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center mt-1 shrink-0"
          title={name}
        >
          {initials}
        </div>
      </aside>
    );
  }
  ```

- [x] **Step 2: Commit**
  ```bash
  git add web/src/components/student/StudentSidebar.tsx
  git commit -m "feat: add StudentSidebar component"
  ```

---

### Task 11.10: Student layout

**Files:**
- Create: `web/src/app/student/layout.tsx`

- [x] **Step 1: Create `web/src/app/student/layout.tsx`**

  ```tsx
  'use client';

  import { usePathname } from 'next/navigation';
  import { Toaster } from 'sonner';
  import StudentSidebar from '@/components/student/StudentSidebar';

  export default function StudentLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isPublic = pathname === '/student/login' || pathname === '/student/register';

    if (isPublic) {
      return (
        <>
          {children}
          <Toaster richColors position="top-right" />
        </>
      );
    }

    return (
      <div className="h-screen overflow-hidden flex bg-slate-50 dark:bg-slate-950">
        <StudentSidebar />
        <main className="flex-1 overflow-y-auto min-w-0">
          {children}
        </main>
        <Toaster richColors position="top-right" />
      </div>
    );
  }
  ```

- [x] **Step 2: Remove back link from leaderboard page**

  In `web/src/app/student/leaderboard/page.tsx`, find and remove the "← Trang cá nhân" link:
  ```tsx
  // REMOVE these 4 lines (the Link element + the ← text):
  <Link href="/student/profile" className="text-sm text-slate-400 hover:text-white transition-colors">
    ← Trang cá nhân
  </Link>
  ```
  The sidebar already provides navigation to Profile — this back link is redundant.

- [x] **Step 3: Verify in browser**

  Navigate to `http://localhost:3000/student/login` → login → arrives at `/student/profile`. Profile page should show with the StudentSidebar on the left. Navigate to Leaderboard via sidebar — "← Trang cá nhân" link should be gone.

- [x] **Step 4: Commit**
  ```bash
  git add web/src/app/student/layout.tsx web/src/app/student/leaderboard/page.tsx
  git commit -m "feat: add student layout with StudentSidebar shell"
  ```

---

### Task 11.11: Hide NavBar on /student/* routes

**Files:**
- Modify: `web/src/components/NavBar.tsx`

- [x] **Step 1: Update the early-return check in NavBar**

  In `web/src/components/NavBar.tsx`, find:
  ```tsx
  if (pathname?.startsWith('/teacher')) return null;
  ```

  Replace with:
  ```tsx
  if (pathname?.startsWith('/teacher') || pathname?.startsWith('/student')) return null;
  ```

- [x] **Step 2: Verify**

  Navigate to `http://localhost:3000/student/profile` — the NavBar at the top should no longer appear. The StudentSidebar is the only navigation. Game pages like `/s/TESTCODE` should still show the NavBar.

- [x] **Step 3: Commit**
  ```bash
  git add web/src/components/NavBar.tsx
  git commit -m "fix: hide NavBar on /student/* routes"
  ```

---

### Task 11.12: E2E tests — update existing + add Wayground layout tests

**Files:**
- Create: `web/e2e/wayground-layout.spec.ts`
- Modify: `web/e2e/teacher-dashboard.spec.ts` (update URLs)

#### 11.12a — Update teacher-dashboard.spec.ts

- [x] **Step 1: Update the beforeEach URL**

  In `web/e2e/teacher-dashboard.spec.ts`, find:
  ```typescript
  await page.goto('/teacher');
  // SessionProvider polling can prevent networkidle — wait for a specific element instead
  await page.getByRole('heading', { name: 'Quiz Sets' }).waitFor({ timeout: 15_000 });
  ```

  Replace with:
  ```typescript
  await page.goto('/teacher/quizzes');
  await page.getByText('Created').waitFor({ timeout: 15_000 });
  ```

- [x] **Step 2: Update the "Quiz Sets" heading assertion**

  Find:
  ```typescript
  await expect(page.getByRole('heading', { name: 'Quiz Sets' })).toBeVisible();
  ```

  Replace with:
  ```typescript
  await expect(page.getByText('Created')).toBeVisible();
  ```

- [x] **Step 3: Update "+ Upload new" test**

  Find:
  ```typescript
  test('clicking "+ Upload new" navigates to /teacher/quizzes/new', async ({ page }) => {
    await page.getByRole('link', { name: '+ Upload new' }).click();
    await expect(page).toHaveURL(/\/teacher\/quizzes\/new/);
  ```

  Replace with:
  ```typescript
  test('clicking "+ Add quiz" navigates to /teacher/quizzes/new', async ({ page }) => {
    await page.getByRole('link', { name: '+ Add quiz' }).click();
    await expect(page).toHaveURL(/\/teacher\/quizzes\/new/);
  ```

#### 11.12b — Create wayground-layout.spec.ts

- [x] **Step 4: Create `web/e2e/wayground-layout.spec.ts`**

  ```typescript
  import { test, expect } from '@playwright/test';

  const MOCK_QUIZZES = [
    {
      id: 'q1',
      title: 'Grammar B2',
      questions: Array.from({ length: 40 }, (_, i) => ({ id: i + 1 })),
      time_per_question: 45,
      source: 'FCE.pdf',
    },
  ];

  const MOCK_SESSIONS = [
    {
      id: 's1',
      code: 'ABC123',
      status: 'waiting',
      quizTitle: 'Grammar B2',
      quizId: 'q1',
      batchId: null,
      batchOrder: null,
      lobbyCount: 3,
      finishedCount: 0,
      createdAt: '2026-07-06T00:00:00.000Z',
    },
    {
      id: 's2',
      code: 'XYZ789',
      status: 'ended',
      quizTitle: 'Grammar B2',
      quizId: 'q1',
      batchId: null,
      batchOrder: null,
      lobbyCount: 5,
      finishedCount: 5,
      createdAt: '2026-07-05T00:00:00.000Z',
    },
  ];

  async function mockApis(page: import('@playwright/test').Page) {
    await page.route('/api/quizzes', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_QUIZZES) });
      } else { await route.continue(); }
    });
    await page.route('/api/sessions', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SESSIONS) });
      } else { await route.continue(); }
    });
  }

  test.describe('Wayground layout — teacher', () => {
    test.beforeEach(async ({ page }) => {
      await mockApis(page);
      await page.goto('/teacher/quizzes');
      await page.getByText('Grammar B2').waitFor({ timeout: 15_000 });
    });

    test('sidebar is visible on quizzes page', async ({ page }) => {
      await expect(page.locator('aside').first()).toBeVisible();
    });

    test('QuizzesPanel second panel is visible on /teacher/quizzes', async ({ page }) => {
      await expect(page.getByText('Quizzes').first()).toBeVisible();
      await expect(page.getByText('All')).toBeVisible();
      await expect(page.getByText('Recently used')).toBeVisible();
    });

    test('sidebar nav: clicking Sessions hides QuizzesPanel', async ({ page }) => {
      await page.goto('/teacher/sessions');
      await mockApis(page);
      await page.waitForLoadState('networkidle');
      // On /teacher/sessions, second panel should NOT show quizzes panel header "Quizzes"
      // The aside for QuizzesPanel won't be rendered
      const panelCount = await page.locator('aside').count();
      // Only one aside (the sidebar) — no second panel
      expect(panelCount).toBe(1);
    });

    test('quiz search filters results', async ({ page }) => {
      const input = page.getByPlaceholder('Search by quiz name…');
      await input.fill('Grammar');
      await expect(page.getByText('Grammar B2')).toBeVisible();
      await input.fill('Nonexistent Quiz XYZ');
      await expect(page.getByText('No quizzes match your search.')).toBeVisible();
    });

    test('/teacher redirects to /teacher/quizzes', async ({ page }) => {
      await page.goto('/teacher');
      await expect(page).toHaveURL(/\/teacher\/quizzes/, { timeout: 5000 });
    });
  });

  test.describe('Wayground layout — sessions page', () => {
    test.beforeEach(async ({ page }) => {
      await mockApis(page);
      await page.goto('/teacher/sessions');
      await page.waitForLoadState('networkidle');
    });

    test('sessions page shows filter tabs', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Waiting' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Active' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Ended' })).toBeVisible();
    });

    test('session filter tab Waiting shows only waiting sessions', async ({ page }) => {
      await page.getByRole('button', { name: 'Waiting' }).click();
      await expect(page.getByText('ABC123')).toBeVisible();
      await expect(page.getByText('XYZ789')).not.toBeVisible();
    });

    test('session filter tab Ended shows only ended sessions', async ({ page }) => {
      await page.getByRole('button', { name: 'Ended' }).click();
      await expect(page.getByText('XYZ789')).toBeVisible();
      await expect(page.getByText('ABC123')).not.toBeVisible();
    });
  });

  test.describe('Wayground layout — theme toggle', () => {
    test('theme toggle switches dark/light class on html element', async ({ page }) => {
      await page.goto('/teacher/quizzes');
      await page.route('/api/quizzes', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      });
      await page.route('/api/sessions', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      });
      await page.waitForLoadState('networkidle');

      // Default is dark
      await expect(page.locator('html')).toHaveClass(/dark/, { timeout: 3000 });

      // Click theme toggle button (title contains "light mode" or "dark mode")
      const themeBtn = page.locator('button[title*="mode"]').first();
      await themeBtn.click();
      // Should switch to light (no dark class)
      await expect(page.locator('html')).not.toHaveClass(/dark/);

      // Toggle back
      await themeBtn.click();
      await expect(page.locator('html')).toHaveClass(/dark/);
    });
  });
  ```

- [x] **Step 5: Add student layout E2E tests to wayground-layout.spec.ts**

  Append to `web/e2e/wayground-layout.spec.ts`:
  ```typescript
  test.describe('Wayground layout — student', () => {
    test.beforeEach(async ({ page }) => {
      // Use real student auth state if available; otherwise test via URL
    });

    test('NavBar hidden on /student/* routes', async ({ page }) => {
      await page.goto('/student/login');
      await page.waitForLoadState('domcontentloaded');
      // The main NavBar (with teacher role) should NOT appear on student pages
      await expect(page.locator('nav[data-testid="navbar"]')).toHaveCount(0);
    });

    test('/student/leaderboard has no back link to Trang ca nhan', async ({ page }) => {
      // Login as student first via stored auth
      await page.context().storageState(); // uses existing student auth if set up
      await page.goto('/student/leaderboard');
      await page.waitForLoadState('domcontentloaded');
      // The "← Trang cá nhân" link should be absent
      await expect(page.getByText('← Trang cá nhân')).toHaveCount(0);
    });
  });
  ```

- [x] **Step 6: Run the new E2E tests**

  ```bash
  cd web && E2E_EMAIL="e2e-test@fce-quiz.local" E2E_PASSWORD="e2e-test-2026" \
    /Users/halinh/.nvm/versions/node/v20.16.0/bin/node \
    node_modules/.bin/playwright test e2e/wayground-layout.spec.ts
  ```
  Expected: all pass.

- [x] **Step 6: Run full regression**

  ```bash
  cd web && E2E_EMAIL="e2e-test@fce-quiz.local" E2E_PASSWORD="e2e-test-2026" \
    /Users/halinh/.nvm/versions/node/v20.16.0/bin/node \
    node_modules/.bin/playwright test
  ```
  Expected: all pass, no regressions.

- [x] **Step 7: Commit**

  ```bash
  git add web/e2e/wayground-layout.spec.ts web/e2e/teacher-dashboard.spec.ts docs/plans.md
  git commit -m "test: add E2E tests for Wayground teacher + student layout"
  ```

---

### Task 11.13: Deploy and verify

- [x] **Step 1: Push to GitHub**
  ```bash
  git push origin main
  ```

- [x] **Step 2: Wait for GitHub Actions CI to pass** (check at https://github.com).

- [x] **Step 3: SSH to VPS and deploy**
  ```bash
  ssh -i ~/.ssh/digitalocean root@139.162.42.158
  cd /root/fce-quiz/web
  git pull
  npm install
  npm run build
  pm2 restart fce-quiz
  ```

- [x] **Step 4: Verify**
  ```bash
  pm2 logs fce-quiz --lines 50
  ```
  Open production URL → teacher login → `/teacher/quizzes` shows sidebar layout.

- [x] **Step 5: Mark done and commit**
  ```bash
  git add docs/plans.md
  git commit -m "docs: mark feature 11 as done"
  git push origin main
  ```


---

## Feature 12: Wayground Student Dashboard Redesign

**Spec:** §14

- [x] **Task 12.1: StudentTopNav component**
  - Create `web/src/components/student/StudentTopNav.tsx`
  - Top nav: FCEQuiz logo + Home/Activity/Scores tabs + theme toggle + avatar sign-out

- [x] **Task 12.2: Update student layout**
  - Modify `web/src/app/student/layout.tsx`
  - Replace `StudentSidebar` with `StudentTopNav`, switch to flex-col layout

- [x] **Task 12.3: Home page**
  - Create `web/src/app/student/home/page.tsx`
  - Join code box + greeting card + recent games grid with AccuracyBar

- [x] **Task 12.4: Activity page**
  - Create `web/src/app/student/activity/page.tsx`
  - Full history + practice queue + stats + badges

- [x] **Task 12.5: Profile redirect + sidebar delete**
  - Modify `web/src/app/student/profile/page.tsx` → server redirect to /student/home
  - Delete `web/src/components/student/StudentSidebar.tsx`

- [x] **Task 12.6: E2E tests**
  - Update `web/e2e/wayground-layout.spec.ts` student section

- [x] **Task 12.7: Deploy and verify**
  - Push → GitHub Actions → SSH PM2 verify

## Feature 15: PDF → Multiple Games + Grouped Teacher View

**Spec:** §15

- [ ] **Task 15.1: Export shared extraction logic from route.ts**
  - Modify `web/src/app/api/extract-quiz/route.ts`
  - Export `detectMCQPageRanges`, add + export `extractQuestionsFromRange`

- [ ] **Task 15.2: Create detect endpoint**
  - Create `web/src/app/api/extract-quiz/detect/route.ts`

- [ ] **Task 15.3: Create batch endpoint**
  - Create `web/src/app/api/extract-quiz/batch/route.ts`

- [ ] **Task 15.4: Rewrite upload page (two-step)**
  - Modify `web/src/app/teacher/quizzes/new/page.tsx`

- [ ] **Task 15.5: Grouped quizzes page**
  - Modify `web/src/app/teacher/quizzes/page.tsx`

- [ ] **Task 15.6: E2E tests + deploy**
  - Add `web/e2e/quiz-grouping.spec.ts`
  - Push + verify
