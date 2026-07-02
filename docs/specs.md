# FCEQuiz — Master Specification

**Last updated:** 2026-07-02  
**Status:** Living document — update alongside every code change

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Database Schema](#2-database-schema)
3. [Teacher Authentication](#3-teacher-authentication)
4. [Teacher Dashboard](#4-teacher-dashboard)
5. [PDF Upload & Quiz Creation](#5-pdf-upload--quiz-creation)
6. [Student Quiz Player](#6-student-quiz-player)
7. [Student Auth & Profile](#7-student-auth--profile)
8. [Middleware & Route Protection](#8-middleware--route-protection)

---

## 1. System Architecture

```mermaid
graph TB
    subgraph Client
        Home["/ Home"]
        Nav["NavBar"]
        StudentPlay["/s/code Play"]
        TeacherDash["/teacher Dashboard"]
        TeacherUpload["/teacher/quizzes/new Upload"]
        StudentLogin["/student/login"]
        StudentProfile["/student/profile"]
        TeacherStudents["/teacher/students"]
    end

    subgraph API["API Routes"]
        AuthAPI["/api/auth NextAuth"]
        QuizzesAPI["/api/quizzes"]
        SessionsAPI["/api/sessions"]
        BatchAPI["/api/sessions/batch"]
        AttemptsAPI["/api/attempts"]
        ExtractAPI["/api/extract-quiz"]
        StudentsAPI["/api/students"]
    end

    subgraph DB["Supabase Postgres"]
        authUsers["auth_users"]
        quizzes["quizzes"]
        sessions["sessions"]
        attempts["attempts"]
        students["students"]
        studentStats["student_stats"]
        studentQStats["student_question_stats"]
    end

    subgraph External
        PDF["Gemini AI"]
    end

    Home --> StudentPlay
    Nav --> TeacherDash
    Nav --> StudentProfile
    TeacherDash --> TeacherUpload
    TeacherDash --> TeacherStudents

    TeacherUpload --> ExtractAPI --> PDF
    TeacherUpload --> QuizzesAPI
    TeacherUpload --> BatchAPI
    TeacherDash --> SessionsAPI
    StudentPlay --> AttemptsAPI
    StudentLogin --> AuthAPI
    StudentProfile --> AttemptsAPI
    TeacherStudents --> StudentsAPI

    AuthAPI --> authUsers
    QuizzesAPI --> quizzes
    SessionsAPI --> sessions
    BatchAPI --> sessions
    AttemptsAPI --> attempts
    StudentsAPI --> students
    StudentsAPI --> studentStats
    AttemptsAPI --> studentStats
    AttemptsAPI --> studentQStats
```

---

## 2. Database Schema

```mermaid
erDiagram
    auth_users {
        uuid id PK
        text name
        text email
        text password_hash
        timestamptz created_at
    }

    quizzes {
        uuid id PK
        uuid teacher_id FK
        text title
        jsonb questions
        int time_per_question
        text source
        timestamptz created_at
    }

    sessions {
        uuid id PK
        uuid quiz_id FK
        uuid teacher_id FK
        text code
        bool is_active
        uuid batch_id
        int batch_order
        timestamptz created_at
    }

    attempts {
        uuid id PK
        uuid session_id FK
        uuid quiz_id FK
        uuid student_id FK
        text student_name
        int score
        int total_questions
        int time_spent_ms
        jsonb answers
        timestamptz created_at
    }

    students {
        uuid id PK
        text username
        text pin_hash
        text display_name
        uuid created_by FK
        timestamptz created_at
        timestamptz last_active_at
    }

    student_stats {
        uuid student_id PK
        int current_streak
        int longest_streak
        int total_games
        int total_correct
        int total_answered
        date last_played_date
        int consecutive_perfect
        jsonb badges
    }

    student_question_stats {
        uuid student_id PK
        uuid quiz_id PK
        text question_id PK
        int correct_count
        int wrong_count
        float ease_factor
        timestamptz last_seen_at
    }

    auth_users ||--o{ quizzes : "creates"
    auth_users ||--o{ sessions : "owns"
    auth_users ||--o{ students : "created_by"
    quizzes ||--o{ sessions : "used in"
    sessions ||--o{ attempts : "has"
    students ||--o{ attempts : "submits"
    students ||--|| student_stats : "has"
    students ||--o{ student_question_stats : "has"
    quizzes ||--o{ student_question_stats : "tracks"
```

### SQL — New tables (migration)

```sql
CREATE TABLE students (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username       TEXT UNIQUE NOT NULL,   -- 3–20 chars, lowercase, no spaces
  pin_hash       TEXT NOT NULL,           -- bcrypt of 6-digit PIN
  display_name   TEXT NOT NULL,
  created_by     UUID REFERENCES auth_users(id),  -- NULL = self-registered
  created_at     TIMESTAMPTZ DEFAULT now(),
  last_active_at TIMESTAMPTZ
);

CREATE TABLE student_stats (
  student_id          UUID PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  current_streak      INT DEFAULT 0,
  longest_streak      INT DEFAULT 0,
  total_games         INT DEFAULT 0,
  total_correct       INT DEFAULT 0,
  total_answered      INT DEFAULT 0,
  last_played_date    DATE,
  consecutive_perfect INT DEFAULT 0,
  badges              JSONB DEFAULT '[]'
);

CREATE TABLE student_question_stats (
  student_id    UUID REFERENCES students(id) ON DELETE CASCADE,
  quiz_id       UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id   TEXT NOT NULL,
  correct_count INT DEFAULT 0,
  wrong_count   INT DEFAULT 0,
  ease_factor   FLOAT DEFAULT 0.5,
  last_seen_at  TIMESTAMPTZ,
  PRIMARY KEY (student_id, quiz_id, question_id)
);

ALTER TABLE attempts ADD COLUMN student_id UUID REFERENCES students(id);
```

---

## 3. Teacher Authentication

### Requirements

1. Login at `/teacher/login` with email + password → redirect to `/teacher`.
2. Wrong credentials → "Invalid email or password." (no redirect).
3. Register at `/teacher/register` with name, email, password (min 8 chars) → redirect to `/teacher/login`.
4. Password < 8 chars → "Invalid data."
5. Duplicate email → "Email already in use."
6. Sign out → session cleared → redirect to `/teacher/login`.

### Flow

```mermaid
flowchart TD
    A([Teacher at /teacher/login]) --> B{Has session?}
    B -- yes --> C["Dashboard: /teacher"]
    B -- no --> D["Enter email + password"]
    D --> E{Credentials valid?}
    E -- no --> F["Error: Invalid email or password."]
    F --> D
    E -- yes --> G["Create session, role=teacher"]
    G --> C

    H([Teacher at /teacher/register]) --> I["Enter name + email + password"]
    I --> J{Valid?}
    J -- "password under 8" --> K["Error: Invalid data."]
    J -- "email taken" --> L["Error: Email already in use."]
    K --> I
    L --> I
    J -- ok --> M["bcrypt hash + INSERT auth_users"]
    M --> N["Redirect /teacher/login"]

    C --> O["Click Sign out"]
    O --> P["signOut, clear session"]
    P --> N
```

### API

| Endpoint | Method | Body | Returns |
|----------|--------|------|---------|
| `/api/auth/register` | POST | `{ name, email, password }` | 201 `{ ok: true }` / 400 / 409 |
| `/api/auth/callback/credentials` | POST | NextAuth built-in | session JWT |

### Files

| File | Purpose |
|------|---------|
| `web/src/app/teacher/login/page.tsx` | Login form |
| `web/src/app/teacher/register/page.tsx` | Registration form |
| `web/src/app/api/auth/register/route.ts` | Register API |
| `web/src/auth.ts` | NextAuth config — credentials provider |

---

## 4. Teacher Dashboard

### Requirements

1. Quiz list: title, question count, time/q, source.
2. "+ Upload new" → `/teacher/quizzes/new`.
3. "[Edit]" → `/teacher/quizzes/[id]`.
4. "+ Room" → `POST /api/sessions` → banner with room code.
5. Banner has "Copy link" button.
6. Active Rooms: lists all teacher's sessions with code + quiz title.
7. "View results" → `/teacher/sessions/[id]`.
8. Batch sessions show "Part X/Y" badge.
9. "+ Batch" → `POST /api/sessions/batch` → batch notification banner.
10. Unauthenticated `/teacher` → redirect to `/teacher/login`.

### Flow

```mermaid
flowchart TD
    A([Request to /teacher]) --> B{Teacher session?}
    B -- no --> C["Redirect /teacher/login"]
    B -- yes --> D["Load quizzes + sessions"]
    D --> E["Dashboard rendered"]

    E --> F{User action?}
    F -- "+ Upload new" --> G["Navigate to /teacher/quizzes/new"]
    F -- "Edit" --> H["Navigate to /teacher/quizzes/id"]
    F -- "+ Room" --> I["POST /api/sessions"]
    F -- "+ Batch" --> J["POST /api/sessions/batch"]
    F -- "View results" --> K["Navigate to /teacher/sessions/id"]

    I --> L["Banner: room code + Copy link"]
    J --> M["Batch banner: codes + Copy per part"]
    L --> E
    M --> E
```

### Batch badge logic

```
isBatch = session.batchId !== null
totalInBatch = sessions.filter(x => x.batchId === session.batchId).length
badge = isBatch ? `Part ${session.batchOrder}/${totalInBatch}` : none
```

### Files

| File | Purpose |
|------|---------|
| `web/src/app/teacher/page.tsx` | Dashboard page |
| `web/src/app/api/quizzes/route.ts` | GET teacher's quizzes |
| `web/src/app/api/sessions/route.ts` | GET/POST sessions |
| `web/src/app/api/sessions/batch/route.ts` | POST batch sessions |

---

## 5. PDF Upload & Quiz Creation

This covers three overlapping features: upload page consolidation, save-and-batch, and auto-batch on PDF import.

### Requirements

**Upload page:**
1. `/teacher/quizzes/new` is the only upload page (public `/upload` and `/import` pages deleted).
2. Drop zone accepts PDF only (`accept=".pdf,application/pdf"`). Non-PDF → "Only PDF files accepted."
3. Drop zone hint: "Drag PDF here, or click to select".

**Extraction & preview:**
4. After extraction, auto-compute `targetGames = Math.ceil(totalQuestions / 15)`.
5. Questions displayed grouped by game (collapsed by default).
6. Teacher can change `targetGames` → groups re-render instantly (client-side).

**Inline question editor:**
7. Expanding a game chunk reveals question cards in read mode.
8. `[✎]` button on each card enters edit mode for that question.
9. Edit mode: textarea for question text, text inputs for options, radio to select correct answer, textarea for explanation.
10. `[✓ Done]` exits edit mode; changes persist in React state.
11. All edits are in-memory; they are saved to DB only when "Save & Create Batch" is clicked.

**Save & batch:**
12. "Save & Create N Batch" saves quiz to DB then creates N sessions.
13. Results shown inline: each part's code + question count.

### Flow

```mermaid
flowchart TD
    A([Teacher at /teacher/quizzes/new]) --> B["Drop file"]
    B --> C{Is PDF?}
    C -- no --> D["Error: Only PDF files accepted."]
    D --> B
    C -- yes --> E["POST /api/extract-quiz via Gemini AI"]
    E --> F["Set quiz state, auto-compute targetGames"]
    F --> G["Show grouped preview, all collapsed"]

    G --> H{User action?}
    H -- "expand game" --> I["Show question cards in read mode"]
    H -- "change targetGames" --> J["Re-chunk client-side, re-render"]
    J --> G
    H -- "Edit button on question" --> K["Edit mode: textarea + radio inputs"]
    K -- "Done button" --> L["Update quiz in React state only"]
    L --> I

    H -- "Save and Create Batch" --> M["POST /api/quizzes with edited questions"]
    M --> N["POST /api/sessions/batch with targetGames"]
    N --> O["Show result: room code per part"]
```

### Split formula

**targetGames mode (used here):**
```
base      = floor(total / targetGames)
remainder = total % targetGames
→ first `remainder` games get (base+1) questions, rest get base

Example: 50q, targetGames=4 → 13, 13, 12, 12
```

**batchSize mode (existing dashboard "+ Batch"):** unchanged.

### Auto-init on extraction

```typescript
setTargetGames(Math.max(1, Math.ceil(data.questions.length / 15)));
setExpandedGames(new Set());   // all collapsed
setEditingIds(new Set());      // no question in edit mode
```

### Inline editor state

```typescript
const [editingIds, setEditingIds] = useState<Set<string>>(new Set());

function updateQuestion(id: string, patch: Partial<MultipleChoiceQuestion>) {
  setQuiz(prev => ({
    ...prev!,
    questions: prev!.questions.map(q => q.id === id ? { ...q, ...patch } : q),
  }));
}

function toggleEdit(id: string) {
  setEditingIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
}
```

### API

| Endpoint | Method | Body | Returns |
|----------|--------|------|---------|
| `/api/extract-quiz` | POST | `FormData { file: PDF }` | `{ title, questions[] }` |
| `/api/quizzes` | POST | `{ title, questions, time_per_question }` | `{ id }` |
| `/api/sessions/batch` | POST | `{ quizId, targetGames?, batchSize? }` | `BatchResult` |

`targetGames` takes priority over `batchSize`. Both are optional; default `batchSize=15`.

### Files

| File | Purpose |
|------|---------|
| `web/src/app/teacher/quizzes/new/page.tsx` | PDF drop, extraction, preview, inline editor, save&batch |
| `web/src/app/api/extract-quiz/route.ts` | PDF extraction via Gemini |
| `web/src/app/api/quizzes/route.ts` | Save quiz to DB |
| `web/src/app/api/sessions/batch/route.ts` | Create batch sessions |
| `web/src/lib/chunk-by-target-games.ts` | Split logic (client-side preview + server-side) |

**Deleted files:**
- `web/src/app/upload/page.tsx`
- `web/src/app/import/page.tsx`

---

## 6. Student Quiz Player

### Requirements

1. `/s/[code]` shows room code, quiz title, question count, name input; "Join →" requires non-empty name.
2. 3-second countdown (3→2→1) before first question.
3. Each question: text, 4 colored tiles, timer bar (green→yellow→red), progress indicator.
4. Selecting an answer → immediate feedback: correct tile outlined, wrong dimmed, "Correct!" or "Wrong — Answer: X".
5. Timer auto-submits at 0 → "Time's up! Answer: X".
6. Finish screen: score % + "View results →".
7. Invalid/inactive code → "Room not found or closed." + link home.

### Flow

```mermaid
flowchart TD
    A([Navigate to /s/code]) --> B["GET /api/sessions/by-code"]
    B --> C{Found and active?}
    C -- no --> D["Error: Room not found or closed."]
    C -- yes --> E["Join screen: enter name"]
    E --> F["Click Join"]
    F --> G{Name non-empty?}
    G -- no --> E
    G -- yes --> H["Countdown: 3, 2, 1"]
    H --> I["Question screen"]

    I --> J{Timer or answer}
    J -- "Answer selected" --> K["Feedback: correct or wrong"]
    J -- "Timer = 0" --> L["Feedback: Time's up!"]
    K --> M{Last question?}
    L --> M
    M -- no --> N["Next question"]
    N --> I
    M -- yes --> O["POST /api/attempts"]
    O --> P["Finish screen: score%"]
    P --> R["Navigate: /results/attemptId"]
```

### Score formula

```
score% = Math.round((correctCount / totalQuestions) * 100)
```

### Tile colors (round-robin by index)

| Index | Color |
|-------|-------|
| 0 | Olive-green `#8db600` |
| 1 | Purple `#8a4fd0` |
| 2 | Orange `#e86020` |
| 3 | Teal `#00c9a7` |

### Linked attempt (students)

When a logged-in student plays, `POST /api/attempts` includes `student_id` from the session JWT. Anonymous play leaves `student_id = NULL`.

### Files

| File | Purpose |
|------|---------|
| `web/src/app/s/[code]/page.tsx` | Student quiz player |
| `web/src/app/api/sessions/by-code/[code]/route.ts` | Session lookup |
| `web/src/app/api/attempts/route.ts` | Submit attempt (links student_id if logged in) |

---

## 7. Student Auth & Profile

**Sub-project 1 of 4.** Sub-2 (real-time monitoring), Sub-3 (adaptive retry), Sub-4 (achievements leaderboard) are out of scope.

### Requirements

**Registration & Login:**
1. Students can self-register at `/student/register`: display_name + chosen username + 6-digit PIN.
2. Students can log in at `/student/login` with username + PIN.
3. Teachers can create accounts at `/teacher/students`: only `display_name` required; username + PIN auto-generated.
4. Teacher can reset a student's PIN (shows new PIN once, then hidden).
5. Teacher can delete a student (cascades all data).

**Profile:**
6. `/student/profile` shows stats, badges, and last 20 quiz attempts.
7. Streak increments if last played was yesterday; resets if gap ≥ 2 days; no change if already played today.
8. Badges awarded server-side after each attempt (no duplicates).

### Flow — Student registration & login

```mermaid
flowchart TD
    A([Student at /student/login]) --> B["Enter username + PIN"]
    B --> C["NextAuth student-credentials provider"]
    C --> D{PIN matches?}
    D -- no --> E["Error: Invalid username or PIN."]
    E --> B
    D -- yes --> F["Create JWT: role=student, studentId, username"]
    F --> G["Redirect /student/profile"]

    H([Student at /student/register]) --> I["Enter display_name, username, PIN"]
    I --> J{username unique AND PIN 6 digits?}
    J -- no --> K["Error: Username taken or PIN invalid"]
    K --> I
    J -- yes --> L["INSERT students + student_stats, auto sign-in"]
    L --> G

    M([Teacher at /teacher/students]) --> N["Click Add Student, enter display_name"]
    N --> O["POST /api/students, auto-generate username + PIN"]
    O --> P["INSERT students + student_stats"]
    P --> Q["Show PIN once, then hide"]
```

### Flow — Attempt → stats update

```mermaid
flowchart TD
    A(["POST /api/attempts"]) --> B{student_id set?}
    B -- no --> C["Save attempt only, anon play"]
    B -- yes --> D["UPDATE student_stats: total_games++, total_correct+="]
    D --> E{score = 100%?}
    E -- yes --> F["consecutive_perfect++"]
    E -- no --> G["consecutive_perfect = 0"]
    F --> H["Check streak: last_played_date vs today UTC+0"]
    G --> H
    H --> I{Gap?}
    I -- yesterday --> J["current_streak++"]
    I -- today --> K["no change"]
    I -- "2 or more days" --> L["current_streak = 1"]
    J --> M["Update longest_streak if needed"]
    K --> M
    L --> M
    M --> N["Evaluate badges"]
    N --> O["Append new badges to student_stats.badges"]
    O --> P["UPDATE student_question_stats per question"]
```

### Badges

| ID | Badge | Condition |
|----|-------|-----------|
| `first_play` | 🎮 First Play | First attempt submitted |
| `first_win` | 🏆 First Win | First 100% score |
| `on_fire` | 🔥 On Fire | 7-day streak |
| `speed_demon` | ⚡ Speed Demon | Correct answer in < 5 seconds |
| `sharpshooter` | 🎯 Sharpshooter | 5 perfect scores in a row |
| `dedicated` | 📚 Dedicated | 30 total games played |

### Authentication config

```typescript
// src/auth.ts — session shape
session.user.role: 'teacher' | 'student'
session.user.studentId?: string   // present only when role === 'student'
session.user.username?: string
```

### Teacher student management API

| Method | Endpoint | Body | Returns |
|--------|----------|------|---------|
| `GET` | `/api/students` | — | Student[] for this teacher |
| `POST` | `/api/students` | `{ display_name }` | `{ username, pin }` (plaintext once) |
| `DELETE` | `/api/students/[id]` | — | 204 |
| `POST` | `/api/students/[id]/reset-pin` | — | `{ pin }` (plaintext once) |

### Username generation

```
base = display_name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
username = base         (if unique)
         = base_2 / base_3 ...  (on collision)
```

### Files

| File | Purpose |
|------|---------|
| `web/src/auth.ts` | Add student-credentials provider; extend JWT/session types |
| `web/src/middleware.ts` | Protect `/student/*` routes |
| `web/src/types/quiz.ts` | Add `Student`, `StudentStats`, `Badge` types |
| `web/src/app/student/login/page.tsx` | Username + PIN login form |
| `web/src/app/student/register/page.tsx` | Self-registration form |
| `web/src/app/student/profile/page.tsx` | Profile: stats, badges, history |
| `web/src/app/teacher/students/page.tsx` | Class roster management |
| `web/src/app/api/students/route.ts` | GET list, POST create |
| `web/src/app/api/students/[id]/route.ts` | DELETE student |
| `web/src/app/api/students/[id]/reset-pin/route.ts` | POST reset PIN |
| `web/src/app/api/student/register/route.ts` | Self-registration |
| `web/src/app/api/attempts/route.ts` | Link student_id; update stats + badges |
| `web/src/lib/badges.ts` | Badge evaluation logic |
| `web/src/lib/streak.ts` | Streak update logic |
| `web/src/components/NavBar.tsx` | Student profile link when role=student |
| `web/db/schema.ts` | Add students/stats tables; add student_id to attempts |
| `web/db/migrations/NNNN_student_auth.sql` | SQL migration |

---

## 8. Middleware & Route Protection

```mermaid
flowchart TD
    REQ([Incoming request]) --> A{Path?}

    A -- "/teacher/*" --> B{role = teacher?}
    B -- yes --> C["Allow"]
    B -- no --> D["Redirect /teacher/login"]

    A -- "/student/*" --> E{role = student?}
    E -- yes --> C
    E -- no --> F["Redirect /student/login"]

    A -- "/s/code or other" --> C
```

| Route pattern | Required role | Fallback |
|---------------|---------------|----------|
| `/teacher/*` | `teacher` | Redirect `/teacher/login` |
| `/student/*` | `student` | Redirect `/student/login` |
| `/s/[code]` | none (public) | — |
| `/api/quizzes`, `/api/sessions`, `/api/students` | `teacher` | 401 |
| `/api/attempts` | none | — (student_id from JWT if present) |

---

## E2E Test Coverage

| Scenario | Spec section |
|----------|-------------|
| Teacher login / register / sign out | §3 |
| Dashboard quiz list, "+ Room", "+ Batch", "View results" | §4 |
| PDF upload → extraction → preview → save & batch | §5 |
| Inline question edit (read/edit toggle) | §5 |
| Student join → countdown → play → feedback → finish | §6 |
| Invalid room code error | §6 |
| Student self-register → login → play → profile stats | §7 |
| Teacher creates student → student logs in with PIN | §7 |
| Teacher resets PIN → student logs in with new PIN | §7 |
| Streak increments day-over-day (page.clock) | §7 |
| Badge awarded: first_play, first_win | §7 |
