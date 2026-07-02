# Feature 7: Adaptive Solo Retry — Design

**Date:** 2026-07-02
**Status:** Approved
**Depends on:** Feature 5 (Student Auth & Profile)

---

## Overview

Students can practice any quiz solo using spaced repetition. The system tracks per-question difficulty via SM-2 algorithm and surfaces only "due" questions — those the student needs to review today. Entry point: `/student/practice/[quizId]`, linked from the student profile page.

---

## User Stories

- As a student, I see a "Luyện tập" section on my profile listing quizzes I've played with a badge showing how many questions are due today
- As a student, I click a quiz to open `/student/practice/[quizId]` and see "X câu cần ôn hôm nay"
- As a student, I play through all due questions one by one (same UI as quiz player)
- As a student, if I answer correctly, the question is scheduled further in the future; if wrong, it comes back tomorrow
- As a student, if nothing is due, I see the date of my next scheduled review
- The page requires student login (protected by existing middleware)

---

## Architecture

```
Student browser /student/practice/[quizId]
  │
  │ GET /api/student/practice/[quizId]   (load due questions)
  ▼
student_question_stats WHERE next_review_at IS NULL OR next_review_at <= now()
  + JOIN quiz questions to get full question data
  │
  │ (student plays through due questions)
  │
  │ POST /api/student/practice/[quizId]  (batch update SM-2)
  ▼
student_question_stats   (upsert: repetitions, ease_factor, next_review_at)
```

---

## Database

### Changes to `student_question_stats`

Add 2 columns (migration 0006):

| Column | Type | Notes |
|--------|------|-------|
| `repetitions` | INTEGER DEFAULT 0 | Consecutive correct answers; resets to 0 on wrong |
| `next_review_at` | TIMESTAMPTZ | NULL = never reviewed (always due); set by SM-2 |

No new tables.

---

## SM-2 Algorithm

**File:** `web/src/lib/sm2.ts`

Standard SM-2 with quality scale simplified to binary (correct=4, wrong=1):

```typescript
interface SM2Input {
  repetitions: number;   // consecutive correct answers
  easeFactor: number;    // starts at 2.5, min 1.3
}

interface SM2Output {
  newRepetitions: number;
  newEaseFactor: number;
  nextReviewAt: Date;
  intervalDays: number;
}

function sm2(stats: SM2Input, isCorrect: boolean): SM2Output
```

**Logic:**

If correct (quality = 4):
- `newEF = max(1.3, ef + 0.1 - (5-4)*(0.08+(5-4)*0.02))` → effectively `max(1.3, ef)` (unchanged at q=4)
- `interval`: rep=0 → 1 day; rep=1 → 6 days; rep≥2 → `round(6 * ef^(rep-1))` days
- `newRepetitions = rep + 1`
- `nextReviewAt = now + interval days`

If wrong (quality = 1):
- `newEF = max(1.3, ef + 0.1 - (5-1)*(0.08+(5-1)*0.02))` = `max(1.3, ef - 0.54)`
- `interval = 1 day`
- `newRepetitions = 0`
- `nextReviewAt = tomorrow`

**Example intervals for a well-known question (ef=2.5):**
- rep=0 → 1 day
- rep=1 → 6 days
- rep=2 → 15 days
- rep=3 → 37 days
- rep=4 → 93 days

---

## API

### `GET /api/student/practice/[quizId]`

Load due questions for a quiz.

**Auth:** Requires student session (`session.user.role === 'student'`).

**Logic:**
1. Verify quiz exists
2. Query `student_question_stats` for this student+quiz where `next_review_at IS NULL OR next_review_at <= now()`
3. Join with quiz questions to get full question text + options + answer
4. If 0 due: also return `nextReviewAt` (earliest `next_review_at` across all questions for this quiz)

**Response:**
```json
{
  "quizTitle": "FCE Practice Set 1",
  "questions": [
    {
      "id": "q-uuid",
      "text": "...",
      "options": ["A", "B", "C", "D"],
      "answer": "B",
      "explanation": "...",
      "easeFactor": 2.1,
      "repetitions": 2
    }
  ],
  "dueCount": 5,
  "nextReviewAt": null
}
```

If `dueCount === 0`, `questions` is empty and `nextReviewAt` is an ISO date string.

### `POST /api/student/practice/[quizId]`

Batch update SM-2 after practice session.

**Auth:** Requires student session.

**Body:**
```json
{
  "answers": [
    { "questionId": "q-uuid", "isCorrect": true },
    { "questionId": "q-uuid-2", "isCorrect": false }
  ]
}
```

**Logic:**
- For each answer: call `sm2()` with current stats → upsert `student_question_stats`
- If no existing row: insert with `easeFactor: 2.5, repetitions: 0` as starting point
- Return `{ ok: true, updatedCount: N }`

---

## Frontend

### Practice page — `/student/practice/[quizId]`

**Route:** `web/src/app/student/practice/[quizId]/page.tsx`

**States:**
1. **Loading** — fetching due questions
2. **Nothing due** — "Không có gì để ôn hôm nay 🎉" + "Lần ôn tiếp: [date]" + link back to profile
3. **Ready** — "X câu cần ôn" + Start button
4. **Playing** — reuse quiz player component logic (question → feedback → next)
5. **Finished** — score summary + "Lần ôn tiếp trong ~X ngày"

**UI:** Same dark theme as quiz player (`bg-slate-950`). No room code, no countdown, no timer bar (practice is untimed).

**Submission:** On last question answered → `POST /api/student/practice/[quizId]` → show finished screen.

### Profile page update — `/student/profile`

Add "Luyện tập" section below badges. For each distinct quiz in student's attempt history:
- Quiz title
- Due count badge (e.g. `3 due`) — from `student_question_stats WHERE next_review_at <= now()`
- Link to `/student/practice/[quizId]`

**New API call:** `GET /api/student/practice-summary` — returns `[{ quizId, quizTitle, dueCount }]` for all quizzes student has attempted. Called from profile page alongside existing `/api/student/profile`.

---

## Migration

```sql
ALTER TABLE student_question_stats
  ADD COLUMN IF NOT EXISTS repetitions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMPTZ;
```

---

## Out of Scope

- No timer on practice questions (untimed)
- No leaderboard for practice scores
- No teacher view of student practice progress
- No custom deck / question selection
- Practice does not update `student_stats` streaks or badges (those are for session-based play only)

---

## Testing

- Unit: `sm2()` — correct answer increases interval; wrong resets repetitions and schedules tomorrow; EF floor at 1.3
- Unit: `GET /api/student/practice/[quizId]` — returns only due questions; 0 due returns nextReviewAt
- Unit: `POST /api/student/practice/[quizId]` — upserts SM-2 values correctly
- E2E: student plays practice session → questions marked reviewed → next session shows updated due count
