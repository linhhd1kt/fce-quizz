# Student Auth & Profile — Design Spec

**Date:** 2026-07-02  
**Status:** Approved  
**Sub-project:** 1 of 4 (prerequisite for real-time monitoring, adaptive retry, achievements)

---

## Goal

Add persistent student accounts (username + 6-digit PIN) so students can log in, accumulate learning history, earn badges, and maintain streaks across sessions. Teachers can create accounts for students who don't self-register.

---

## Out of Scope (future sub-projects)

- Real-time teacher monitoring (Sub-2)
- Adaptive solo retry with spaced repetition (Sub-3)
- Achievements leaderboard across classes (Sub-4)
- Class/group management (multiple classes per teacher)
- Student messaging or chat

---

## Database Schema

### New table: `students`

```sql
CREATE TABLE students (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT UNIQUE NOT NULL,          -- 3–20 chars, lowercase, no spaces
  pin_hash      TEXT NOT NULL,                  -- bcrypt of 6-digit PIN
  display_name  TEXT NOT NULL,
  created_by    UUID REFERENCES auth_users(id), -- NULL if self-registered
  created_at    TIMESTAMPTZ DEFAULT now(),
  last_active_at TIMESTAMPTZ
);
```

### New table: `student_stats` (1-to-1 with students)

```sql
CREATE TABLE student_stats (
  student_id       UUID PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  current_streak   INT DEFAULT 0,
  longest_streak   INT DEFAULT 0,
  total_games      INT DEFAULT 0,
  total_correct    INT DEFAULT 0,
  total_answered   INT DEFAULT 0,
  last_played_date    DATE,
  consecutive_perfect INT DEFAULT 0,   -- running count of consecutive 100% scores; reset on non-perfect
  badges              JSONB DEFAULT '[]'  -- [{ id: string, earned_at: timestamptz }]
);
```

### New table: `student_question_stats` (for Sub-3 adaptive retry — created now to avoid a second migration)

```sql
CREATE TABLE student_question_stats (
  student_id    UUID REFERENCES students(id) ON DELETE CASCADE,
  quiz_id       UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id   TEXT NOT NULL,
  correct_count INT DEFAULT 0,
  wrong_count   INT DEFAULT 0,
  ease_factor   FLOAT DEFAULT 0.5,  -- 0.0–1.0, used for spaced repetition in Sub-3
  last_seen_at  TIMESTAMPTZ,
  PRIMARY KEY (student_id, quiz_id, question_id)
);
```

### Modified table: `attempts`

Add one nullable column — fully backward-compatible with existing anonymous attempts:

```sql
ALTER TABLE attempts ADD COLUMN student_id UUID REFERENCES students(id);
```

When a logged-in student submits an attempt, `student_id` is set. Anonymous play remains `NULL`.

---

## Authentication

### Approach

Extend the existing NextAuth config (`auth.ts`) with a second Credentials provider named `"student-credentials"`. The JWT session gains a `role` field:

```typescript
// Extended session type
session.user.role: 'teacher' | 'student'
session.user.studentId?: string   // present only when role === 'student'
session.user.username?: string
```

### Student login flow

```
/student/login → username + PIN form
  → NextAuth "student-credentials" provider
  → SELECT * FROM students WHERE username = ?
  → bcrypt.compare(pin, pin_hash)
  → JWT { role: 'student', studentId, username, display_name }
  → redirect /student/profile
```

### Self-registration flow

```
/student/register → display_name + chosen username + PIN (6 digits)
  → POST /api/student/register
  → validate: username unique, PIN exactly 6 digits
  → INSERT INTO students (created_by = NULL)
  → INSERT INTO student_stats (student_id)
  → sign in automatically → redirect /student/profile
```

### Teacher-created account flow

```
Teacher → /teacher/students → click "+ Add Student" → enter display_name
  → POST /api/students { display_name }
  → server generates: username from display_name + suffix if collision
  → server generates: random 6-digit PIN
  → INSERT INTO students (created_by = teacher_id)
  → INSERT INTO student_stats
  → response: { username, pin }  — shown once to teacher, then PIN is hidden
```

---

## Middleware

- `/student/*` → requires `session.user.role === 'student'`
- `/teacher/*` → requires `session.user.role === 'teacher'` (unchanged)
- `/s/[code]` → allows all (anonymous + student + teacher); if `role === 'student'`, the attempt is linked via `student_id`

---

## New Routes & Pages

### Student-facing

| Route | Description |
|-------|-------------|
| `/student/login` | Username + PIN login form |
| `/student/register` | Self-registration: display_name, username, PIN |
| `/student/profile` | Personal profile (stats, badges, history) |

### Teacher-facing

| Route | Description |
|-------|-------------|
| `/teacher/students` | Manage class roster |

---

## Student Profile Page (`/student/profile`)

### Layout

```
┌─────────────────────────────────────────────────┐
│  👤 display_name                🔥 12-day streak │
│  @username                                      │
├─────────────────┬───────────────────────────────┤
│  STATS          │  BADGES                       │
│  42 games       │  🎮 First Play                │
│  87% avg score  │  🏆 First Win                 │
│  364/420 ✓      │  🔥 On Fire                   │
├─────────────────┴───────────────────────────────┤
│  QUIZ HISTORY                                   │
│  FCE Practice Set 1 · 85% · 2 hours ago         │
│  FCE Practice Set 2 · 72% · yesterday           │
└─────────────────────────────────────────────────┘
```

### Streak logic

- After each attempt: compare `last_played_date` with today (UTC+7)
  - `last_played_date` = yesterday → `current_streak += 1`
  - `last_played_date` = today → no change (already counted)
  - gap ≥ 2 days → `current_streak = 1`
- Update `longest_streak` if `current_streak > longest_streak`
- Update `student_stats` atomically with attempt insert

### Badges (initial set — expandable)

| ID | Badge | Condition |
|----|-------|-----------|
| `first_play` | 🎮 First Play | First attempt submitted |
| `first_win` | 🏆 First Win | First 100% score |
| `on_fire` | 🔥 On Fire | 7-day streak |
| `speed_demon` | ⚡ Speed Demon | Correct answer in < 5 seconds |
| `sharpshooter` | 🎯 Sharpshooter | 5 perfect scores (100%) in a row |
| `dedicated` | 📚 Dedicated | 30 total games played |

Badge evaluation runs server-side after each attempt. Earned badges are appended to `student_stats.badges` (no duplicates).

### Class comparison

Shown only after completing a multiplayer session:
- "You ranked 3rd out of 24 in this game"
- Computed from `attempts` WHERE `session_id = ?` ORDER BY `score DESC`

### Quiz history

- Query: `SELECT * FROM attempts WHERE student_id = ? ORDER BY created_at DESC LIMIT 20`
- Display: quiz title, score %, relative time

---

## Teacher Student Management (`/teacher/students`)

### UI

```
┌────────────────────────────────────────────────────┐
│  Students                          [+ Add Student] │
├───────────┬──────────────┬─────────┬───────────────┤
│ Username  │ Display Name │ PIN     │ Actions        │
├───────────┼──────────────┼─────────┼───────────────┤
│ alice_ng  │ Alice Ng     │ 482910  │ [Reset] [✕]   │
│ bob_tran  │ Bob Tran     │ ——      │ [Reset] [✕]   │
└───────────┴──────────────┴─────────┴───────────────┘
```

PIN column: shown immediately after creation or reset, then replaced with `——`.

**+ Add Student** opens an inline form: just `display_name` field + "Add" button. Username auto-generated from display_name (lowercase, spaces→underscore, suffix added on collision). 6-digit PIN auto-generated. Row appears immediately with PIN visible.

**Reset PIN**: generates new PIN, shows it once in the row.

**Delete (✕)**: removes student and all their data (cascade).

### API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/students` | List students created by this teacher |
| `POST` | `/api/students` | Create student { display_name } |
| `DELETE` | `/api/students/[id]` | Delete student |
| `POST` | `/api/students/[id]/reset-pin` | Generate new PIN, return plaintext once |

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `db/schema.ts` | Add `students`, `student_stats`, `student_question_stats` tables; add `student_id` to `attempts` |
| `db/migrations/NNNN_student_auth.sql` | SQL migration file |
| `src/auth.ts` | Add `"student-credentials"` provider; extend JWT/session types |
| `src/middleware.ts` | Add `/student/*` route protection |
| `src/types/quiz.ts` | Add `Student`, `StudentStats`, `Badge` types |
| `src/app/student/login/page.tsx` | New: username + PIN form |
| `src/app/student/register/page.tsx` | New: self-registration form |
| `src/app/student/profile/page.tsx` | New: profile page |
| `src/app/teacher/students/page.tsx` | New: class roster management |
| `src/app/api/students/route.ts` | New: GET list, POST create |
| `src/app/api/students/[id]/route.ts` | New: DELETE |
| `src/app/api/students/[id]/reset-pin/route.ts` | New: POST reset PIN |
| `src/app/api/student/register/route.ts` | New: self-registration |
| `src/app/api/attempts/route.ts` | Modify: link `student_id` when session role = student |
| `src/lib/badges.ts` | New: badge evaluation logic |
| `src/lib/streak.ts` | New: streak update logic |
| `src/components/NavBar.tsx` | Add student profile link when `role === 'student'` |

---

## Testing

- E2E: student self-register → login → play game → profile shows updated stats
- E2E: teacher creates student → student logs in with generated PIN → plays game
- E2E: teacher resets PIN → student logs in with new PIN
- E2E: streak increments day-over-day (use `page.clock` to control date)
- E2E: badge awarded after first play, first 100% score
- Unit: `generateUsername()` collision handling
- Unit: streak logic (yesterday, today, gap)
- Unit: badge evaluation for each badge condition
