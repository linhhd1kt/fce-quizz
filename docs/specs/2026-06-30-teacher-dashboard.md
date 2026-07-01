# Design: Teacher Dashboard

**Date:** 2026-06-30
**Status:** Approved

---

## Problem

Teachers need a central place to manage their quiz sets and create live game sessions. Without a dashboard, a teacher has no way to see their uploaded quizzes, launch a room for students to join, or monitor active sessions — making the app unusable for day-to-day classroom workflows.

## Requirements

1. Dashboard shows the teacher's quiz list with each quiz's title, question count, time-per-question, and source.
2. Clicking "+ Upload new" navigates to `/teacher/quizzes/new`.
3. Clicking "[Edit]" on a quiz navigates to `/teacher/quizzes/[id]`.
4. Clicking "+ Room" on a quiz calls `POST /api/sessions` and shows a notification banner containing the new room code.
5. The notification banner includes a "Copy link" button that copies the session join URL to the clipboard.
6. The Active Rooms section lists all sessions belonging to the teacher, each showing its room code and quiz title.
7. Clicking "View results" on a session navigates to `/teacher/sessions/[id]`.
8. Batch sessions in the Active Rooms section display a "Part X/Y" badge.
9. Clicking "+ Batch" creates multiple sessions via `POST /api/sessions/batch` and shows a batch notification with each part's room code.
10. Visiting `/teacher` without a valid session redirects to `/teacher/login`.
11. `GET /api/quizzes` and `GET /api/sessions` are auth-gated — an unauthenticated request returns 401.

## Out of Scope

- Real-time updates (polling or WebSocket refresh of active rooms).
- Deleting sessions or closing rooms.
- Deleting quizzes.
- Pagination of quiz or session lists.
- Student-facing join flow (`/s/[code]`).

---

## UI Layout

```
+--[FCEQuiz / Teacher]------------------------[Sign out]--+
|                                                         |
|  [--- Room created banner (visible after + Room) ---]   |
|  | ✓ Room created!                                  |   |
|  |   NEW123                    [Copy link] [Close]  |   |
|  +---------------------------------------------------+  |
|                                                         |
|  [--- Batch created banner (visible after + Batch) --]  |
|  | ✓ Batch created — 2 parts · Quiz Title         × |   |
|  |   Part 1/2  ABC123  15 questions  [Copy]        |   |
|  |   Part 2/2  DEF456  15 questions  [Copy]        |   |
|  +---------------------------------------------------+  |
|                                                         |
|  Quiz Sets                            [+ Upload new]    |
|  +----------------------------------------------------+ |
|  | FCE Practice Set 1                                 | |
|  | 30 questions · 20s/q · json                        | |
|  |                      [Edit]  [+ Room]  [+ Batch]   | |
|  +----------------------------------------------------+ |
|                                                         |
|  Active rooms                                           |
|  +----------------------------------------------------+ |
|  | XYZ789  FCE Practice Set 1               [Part 1/1]| |
|  |         2026-06-30     [Copy link] [View results]  | |
|  +----------------------------------------------------+ |
+---------------------------------------------------------+
```

---

## State Changes

### Add
- `newSessionCode: string | null` — holds the room code shown in the single-session banner after `+ Room`
- `newSessionId: string | null` — holds the session ID for navigation after `+ Room`
- `batchResult: BatchResult | null` — holds batch parts data shown after `+ Batch`
- `creatingFor: string | null` — tracks which quiz is pending a session creation (disables buttons during request)
- `copied: boolean` — transient flag to show "✓ Copied" feedback on copy buttons

### Remove
- n/a (new page, no prior state)

### Keep (unchanged)
- `quizzes: QuizRow[]` — loaded on mount, reloaded after each session creation
- `sessions: SessionRow[]` — loaded on mount, reloaded after each session creation

---

## Data / API Changes

| Endpoint | Method | Change |
|---|---|---|
| `/api/quizzes` | GET | Returns quizzes filtered by authenticated teacher; returns 401 if unauthenticated |
| `/api/sessions` | GET | Returns sessions (with joined quiz title) filtered by authenticated teacher; returns 401 if unauthenticated |
| `/api/sessions` | POST | Creates a single session for `quizId`; returns 403 if quiz does not belong to teacher |
| `/api/sessions/batch` | POST | Creates multiple sessions (one per batch part); existing endpoint, no change |

> Response shapes used by the dashboard:
> - Quiz: `{ id, title, questions: unknown[], time_per_question, source }`
> - Session: `{ id, code, isActive, createdAt, quizTitle, quizId, batchId, batchOrder }`
> - New session (POST response): `{ id, code, ... }`

---

## Logic / Formula

```
// Active rooms — batch badge
isBatch = session.batchId !== null
totalInBatch = sessions.filter(x => x.batchId === session.batchId).length
badge = isBatch ? `Part ${session.batchOrder}/${totalInBatch}` : none

// Copy link
joinUrl = `${window.location.origin}/s/${code}`
```

---

## Files Changed

| File | Change |
|---|---|
| `web/src/app/teacher/page.tsx` | Main dashboard page (quiz list, session list, create room/batch actions) |
| `web/src/app/api/quizzes/route.ts` | GET — returns teacher's quizzes; POST — creates quiz |
| `web/src/app/api/sessions/route.ts` | GET — returns teacher's sessions; POST — creates single session |
| `web/src/middleware.ts` | Redirects unauthenticated `/teacher/*` requests to `/teacher/login` |

---

## Edge Cases

- What if the teacher has no quizzes? → Shows an empty-state placeholder with an "Upload your first quiz →" link.
- What if the teacher has no active sessions? → The "Active rooms" section is not rendered at all.
- What if `POST /api/sessions` fails? → `session.code` is never set; no banner is shown (silent failure; no error UI currently).
- What if `navigator.clipboard` is unavailable (non-HTTPS or old browser)? → Falls back to `document.execCommand('copy')`.
- What if two teachers create sessions simultaneously with the same code? → Server retries up to 10 times with a new code; returns 500 if exhausted.
- What if a batch session's `batchId` appears in the session list but with only some parts loaded? → `totalInBatch` is computed from the currently loaded sessions array, so the badge may show a smaller total if the page has not refreshed since new batch parts were added.

---

## E2E Test Scenarios

| # | Scenario | Requirement |
|---|---|---|
| 1 | Dashboard loads → quiz list shows title and question count | Req 1 |
| 2 | Click "+ Upload new" → navigates to /teacher/quizzes/new | Req 2 |
| 3 | Click "+ Room" → POST /api/sessions called → room code banner appears | Req 4 |
| 4 | Active Rooms section shows session with room code and quiz title | Req 6 |
| 5 | Click "View results" → navigates to /teacher/sessions/[id] | Req 7 |
| 6 | Visit /teacher without auth → redirected to /teacher/login | Req 10 |
