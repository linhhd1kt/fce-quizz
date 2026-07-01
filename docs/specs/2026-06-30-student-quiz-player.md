# Design: Student Quiz Player

**Date:** 2026-06-30
**Status:** Approved

---

## Problem

Students need a simple, mobile-friendly way to join a live quiz session shared by a teacher and play through questions with a countdown timer, immediate per-question feedback, and a final score review — all without requiring an account.

## Requirements

1. Student can navigate to `/s/[code]` and see the room code, quiz title, question count, and a name input field; clicking "Join →" requires a non-empty name.
2. After joining, a 3-second countdown (3 → 2 → 1) is displayed before the first question appears.
3. Each question displays the question text, 4 colorful answer option tiles, a color-coded timer bar (green > 50 %, yellow < 50 %, red < 25 %), and a question-progress indicator (e.g., "1 / 3").
4. Selecting an answer immediately shows feedback: the correct tile is highlighted with a border, wrong tiles are dimmed, and a "Correct!" or "Wrong — Answer: X" label appears; an optional explanation is shown below.
5. The timer auto-submits the current question with no selection when it reaches 0, and feedback reflects the timeout ("Time's up! Answer: X").
6. After all questions are answered, a finish screen shows the student's score percentage and a "View results →" button.
7. Navigating to a room code that does not exist or is inactive shows the message "Room not found or closed." with a link back to home.

## Out of Scope

- Real-time leaderboard showing all students' scores simultaneously
- Teacher live-editing questions during an active quiz session
- Batch / multi-part quiz continuation flow (separate feature)
- Teacher-only session management (creating, closing sessions)
- Authentication — the student flow is fully public

---

## UI Layout

```
[Join Screen]
┌───────────────────────────────┐
│           TST001              │  ← room code badge
│       E2E Test Quiz           │  ← quiz title
│    3 questions · 30s/q        │  ← meta info
│  [ Teacher mode ]             │  ← only when teacher is logged in
│  ┌─────────────────────────┐  │
│  │   Enter your name…      │  │  ← name input (required)
│  └─────────────────────────┘  │
│  [         Join →         ]   │
└───────────────────────────────┘

[Countdown Screen]
┌───────────────────────────────┐
│           Alice               │  ← student name
│       E2E Test Quiz           │
│            ③                 │  ← large countdown digit 3→2→1
│        Get ready…             │
└───────────────────────────────┘

[Playing Screen — Question Phase]
┌───────────────────────────────┐
│  Alice                  1/3   │  ← name + progress
│ ████████████░░░░░░░░░░░░░░░░  │  ← timer bar (green/yellow/red)
│  ┌─────────────────────────┐  │
│  │        1 / 3            │  │
│  │   What is 2+2?   27s    │  │  ← question text + time left
│  └─────────────────────────┘  │
│  ┌──────────┐  ┌──────────┐   │
│  │  [1] 3   │  │  [2] 4   │   │  ← 4 colorful tiles, badge shows 1-4
│  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐   │
│  │  [3] 5   │  │  [4] 6   │   │
│  └──────────┘  └──────────┘   │
└───────────────────────────────┘

[Playing Screen — Feedback Phase]
┌───────────────────────────────┐
│  🎉 Correct!  /  😔 Wrong     │  ← feedback label
│  What is 2+2?                 │
│  ┌──────────┐  ┌──────────┐   │
│  │  [1] 3   │  │ ✓ [2] 4  │   │  ← correct outlined; wrong dimmed
│  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐   │
│  │  [3] 5   │  │  [4] 6   │   │
│  └──────────┘  └──────────┘   │
│  [ explanation text ]         │
│       [    Next →    ]        │
└───────────────────────────────┘

[Finish Screen]
┌───────────────────────────────┐
│              🎉               │
│          Completed!           │
│      Alice · 67%              │
│  [     View results →     ]   │
└───────────────────────────────┘

[Error Screen]
┌───────────────────────────────┐
│   Room not found or closed.   │
│         ← Home                │
└───────────────────────────────┘
```

---

## State Changes

### Add
- `screen: 'join' | 'countdown' | 'playing' | 'finished' | 'results'` — top-level UI phase
- `play.phase: 'question' | 'feedback'` — within playing, whether an answer has been submitted
- `play.timeLeft: number` — seconds remaining for the current question, counts down from `time_per_question`
- `play.selected: string | null` — option text selected by student; null means timeout
- `play.answers: UserAnswer[]` — accumulates answers for final scoring
- `loadError: string` — non-empty when room code lookup fails

### Remove
- (none — this is an existing feature, spec documents it)

### Keep (unchanged)
- `quiz`, `sessionId`, `studentName` — loaded once from API on page mount

---

## Data / API Changes

| Endpoint | Method | Change |
|---|---|---|
| `/api/sessions/by-code/[code]` | GET | Read-only — returns `{ id, code, isActive, questionsSubset, batchId, batchOrder, quizzes }` |
| `/api/attempts` | POST | Called once after the last question — body: `{ sessionId, quizId, studentName, score, totalQuestions, timeSpentMs, answers }` |

> No schema changes. Both endpoints already exist.

---

## Logic / Formula

```
score% = calculateScore(answers)
       = Math.round((correctCount / totalQuestions) * 100)

Timer auto-submit:
  Every 1s setInterval decrements play.timeLeft
  When timeLeft reaches 0 → submitAnswer(null)
  → UserAnswer.correct = false, UserAnswer.selected = ''

Countdown:
  Every 1s setInterval: countdown-- (starts at 3)
  When countdown <= 1 → clearInterval + setScreen('playing')

Tile colors (round-robin by index):
  0 → olive-green   (#8db600)
  1 → purple        (#8a4fd0)
  2 → orange        (#e86020)
  3 → teal          (#00c9a7)
```

---

## Files Changed

| File | Change |
|---|---|
| `web/src/app/s/[code]/page.tsx` | Main student quiz player (existing — spec documents current behavior) |
| `web/src/app/api/sessions/by-code/[code]/route.ts` | Session lookup API (existing) |
| `web/src/app/api/attempts/route.ts` | Attempt submission API (existing) |

---

## Edge Cases

- **Invalid/inactive room code** → `loadError` set to "Room not found or closed.", error UI rendered, no join form shown.
- **Empty name** → `handleJoin` returns early; the native `required` attribute also prevents form submission.
- **Timer reaches 0** → `submitAnswer(null)` fires; `play.selected = null`; feedback shows timeout message with correct answer; "Next →" button is shown.
- **Last question** → The "Next →" button label changes to "Finish 🎉"; clicking calls `POST /api/attempts` and switches to 'finished' screen.
- **Batch session** → If the session has a `batchId`, a "Continue — Part X/Y →" button appears on the finish screen before "View results →".
- **Teacher viewing** → `isTeacher = true` when a teacher session exists; "Teacher mode" badge shown on join screen; edit (✎) button appears on feedback tiles; behavior is otherwise identical.

---

## E2E Test Scenarios

| # | Scenario | Requirement |
|---|---|---|
| 1 | Navigate to /s/TST001 (mocked) → see quiz title "E2E Test Quiz", room code badge, name input, and "Join →" button | Req 1 |
| 2 | Enter "Alice", click "Join →" → countdown screen appears showing digit 3; after 1s shows 2; after another 1s shows 1 | Req 2 |
| 3 | After countdown completes (3s total) → playing screen shows first question text and 4 answer option tiles | Req 3 |
| 4 | Click correct answer on q1 → "🎉 Correct!" feedback label appears; correct tile is visually distinguished | Req 4 |
| 5 | Advance fake clock past question timer (30s) without clicking → "Time's up!" feedback appears | Req 5 |
| 6 | Answer q1 correctly, click "Next →" → second question ("What color is the sky?") appears | Req 6 (partial) |
| 7 | Navigate to /s/BADCODE (mocked 404) → "Room not found or closed." error is visible | Req 7 |
