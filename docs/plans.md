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
| 5 | Student Auth & Profile | §7 | 🔲 Not started |
| 6 | Real-time Teacher Monitoring | §7 Sub-2 | 🔲 Not started |
| 7 | Adaptive Solo Retry | §7 Sub-3 | 🔲 Not started |
| 8 | Achievements Leaderboard | §7 Sub-4 | 🔲 Not started |

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

## Feature 5: Student Auth & Profile 🔲 Not started

### Dependency: none — implement before Sub-2, Sub-3, Sub-4

### Task 1: Database migration
**Files:** `web/db/schema.ts`, `web/db/migrations/NNNN_student_auth.sql`

- [ ] Add `students` table to schema (id, username, pin_hash, display_name, created_by, created_at, last_active_at)
- [ ] Add `student_stats` table (student_id, current_streak, longest_streak, total_games, total_correct, total_answered, last_played_date, consecutive_perfect, badges JSONB)
- [ ] Add `student_question_stats` table (student_id, quiz_id, question_id, correct_count, wrong_count, ease_factor, last_seen_at)
- [ ] Add nullable `student_id` column to `attempts` table
- [ ] Write SQL migration file and run against local DB
- [ ] Commit: `chore: add students, student_stats, student_question_stats tables; add student_id to attempts`

### Task 2: NextAuth — student credentials provider
**Files:** `web/src/auth.ts`, `web/src/types/quiz.ts`

- [ ] Add `Student`, `StudentStats`, `Badge` types to `quiz.ts`
- [ ] Extend NextAuth JWT/session types: `role: 'teacher' | 'student'`, `studentId?`, `username?`
- [ ] Add `"student-credentials"` provider: `SELECT * FROM students WHERE username = ?` → `bcrypt.compare(pin, pin_hash)`
- [ ] Ensure existing teacher credentials provider is unchanged
- [ ] Write unit test: valid PIN → session created; wrong PIN → null returned
- [ ] Commit: `feat: add student-credentials NextAuth provider`

### Task 3: Middleware update
**Files:** `web/src/middleware.ts`

- [ ] Add rule: `/student/*` requires `session.user.role === 'student'` → redirect `/student/login`
- [ ] Existing rule for `/teacher/*` unchanged
- [ ] Write E2E test: unauthenticated `/student/profile` → redirected to `/student/login`
- [ ] Commit: `feat: protect /student/* routes in middleware`

### Task 4: Student self-registration API
**Files:** `web/src/app/api/student/register/route.ts`

- [ ] `POST /api/student/register` body: `{ display_name, username, pin }`
- [ ] Validate: username 3–20 chars, lowercase, no spaces; PIN exactly 6 digits
- [ ] Check username uniqueness → 409 if taken
- [ ] `bcrypt.hash(pin, 12)` → `INSERT INTO students` → `INSERT INTO student_stats`
- [ ] Write unit test: valid input → 201; duplicate username → 409; bad PIN → 400
- [ ] Commit: `feat: add student self-registration API`

### Task 5: Student login & register pages
**Files:** `web/src/app/student/login/page.tsx`, `web/src/app/student/register/page.tsx`

- [ ] Login page: username input + 6-digit PIN input → `signIn('student-credentials')` → redirect `/student/profile`
- [ ] Login error: "Invalid username or PIN."
- [ ] Register page: display_name + username + PIN → `POST /api/student/register` → auto sign-in → redirect `/student/profile`
- [ ] E2E test: register → login → redirected to profile
- [ ] Commit: `feat: add student login and register pages`

### Task 6: Teacher student management API
**Files:** `web/src/app/api/students/route.ts`, `web/src/app/api/students/[id]/route.ts`, `web/src/app/api/students/[id]/reset-pin/route.ts`

- [ ] `GET /api/students` → list students created by authenticated teacher
- [ ] `POST /api/students` body `{ display_name }` → auto-generate username + random 6-digit PIN → INSERT → return `{ username, pin }` plaintext once
- [ ] Username generation: `display_name.toLowerCase().replace(/\s+/g, '_')` + suffix on collision
- [ ] `DELETE /api/students/[id]` → verify ownership → DELETE (cascades)
- [ ] `POST /api/students/[id]/reset-pin` → generate new PIN → bcrypt hash → UPDATE → return `{ pin }` plaintext once
- [ ] Write unit tests: create, duplicate username collision, delete, reset PIN
- [ ] Commit: `feat: add teacher student management API`

### Task 7: Teacher students management page
**Files:** `web/src/app/teacher/students/page.tsx`

- [ ] Table: username, display_name, PIN column (shown once on create/reset then `——`), Reset button, Delete button
- [ ] "+ Add Student" inline form: display_name input + Add button → row appears with PIN visible
- [ ] Reset PIN: replaces PIN in row with new one, hides after next render
- [ ] Delete: removes row immediately, calls `DELETE /api/students/[id]`
- [ ] E2E test: add student → PIN shown → delete student
- [ ] Commit: `feat: add teacher student management page`

### Task 8: Streak logic
**Files:** `web/src/lib/streak.ts`

- [ ] `updateStreak(stats: StudentStats, today: Date): Partial<StudentStats>`
  - `last_played_date` = yesterday → `current_streak + 1`
  - `last_played_date` = today → no change
  - gap ≥ 2 days → `current_streak = 1`
  - update `longest_streak` if `current_streak > longest_streak`
- [ ] Write unit tests: yesterday, today, 2-day gap, first play
- [ ] Commit: `feat: add streak update logic`

### Task 9: Badge evaluation logic
**Files:** `web/src/lib/badges.ts`

- [ ] `evaluateBadges(stats: StudentStats, attempt: Attempt): Badge[]` — returns new badges earned (no duplicates with existing)
- [ ] Conditions: `first_play` (total_games = 1), `first_win` (score = 100 AND first time), `on_fire` (current_streak ≥ 7), `speed_demon` (any answer < 5s), `sharpshooter` (consecutive_perfect ≥ 5), `dedicated` (total_games ≥ 30)
- [ ] Write unit test for each badge condition
- [ ] Commit: `feat: add badge evaluation logic`

### Task 10: Update attempts route to link student + update stats
**Files:** `web/src/app/api/attempts/route.ts`

- [ ] If `session.user.role === 'student'`: set `student_id` on attempt insert
- [ ] After insert: call `updateStreak()` + `evaluateBadges()` → atomic UPDATE to `student_stats`
- [ ] Update `student_question_stats`: increment `correct_count` or `wrong_count` per answer
- [ ] Anonymous attempts (`student_id = null`) unchanged
- [ ] Write unit test: student attempt → stats updated; anon attempt → stats unchanged
- [ ] Commit: `feat: link student_id to attempts and update student stats on submit`

### Task 11: Student profile page
**Files:** `web/src/app/student/profile/page.tsx`

- [ ] Header: display_name, @username, current streak
- [ ] Stats section: total_games, avg score %, total_correct/total_answered
- [ ] Badges section: earned badges with emoji + label
- [ ] Quiz history: last 20 attempts (quiz title, score %, relative time)
- [ ] All data from `GET /api/student/profile` (or fetch on page server component)
- [ ] E2E test: play game as student → profile shows updated stats + first_play badge
- [ ] Commit: `feat: add student profile page`

### Task 12: NavBar update + E2E regression
**Files:** `web/src/components/NavBar.tsx`

- [ ] When `session.user.role === 'student'`: show "My Profile" link → `/student/profile`
- [ ] When `role === 'teacher'`: show "Students" link → `/teacher/students` (if not already)
- [ ] Run full E2E suite — verify no regressions in teacher auth, dashboard, quiz player
- [ ] Commit: `feat: add student profile link to NavBar`

---

## Feature 6: Real-time Teacher Monitoring 🔲 Not started

> Depends on Feature 5. Spec to be written before planning tasks.

- [ ] Spec written in `docs/specs.md` §8
- [ ] Tasks planned in this file

---

## Feature 7: Adaptive Solo Retry 🔲 Not started

> Depends on Feature 5. Uses `student_question_stats.ease_factor` already in DB.

- [ ] Spec written in `docs/specs.md` §9
- [ ] Tasks planned in this file

---

## Feature 8: Achievements Leaderboard 🔲 Not started

> Depends on Feature 5.

- [ ] Spec written in `docs/specs.md` §10
- [ ] Tasks planned in this file
