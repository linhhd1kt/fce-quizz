# Feature 6: Real-time Teacher Monitoring — Design

**Date:** 2026-07-02  
**Status:** Approved  
**Depends on:** Feature 5 (Student Auth & Profile)

---

## Overview

Teacher opens a live leaderboard view while a quiz session is in progress. The leaderboard updates in real-time as students answer each question, showing rank, name, score, and animated position changes. Displayed on a projector or second screen for the whole class to see.

---

## User Stories

- As a teacher, I can open `/teacher/sessions/[id]/live` during an active session to see a live leaderboard
- As a teacher, I see each student's name, current score, progress (question X/N), and rank badge (🥇🥈🥉)
- As a teacher, I see animated rank changes as students move up or down the leaderboard
- As a teacher, I see a count of "X playing / Y finished"
- The page requires teacher login (protected by existing middleware)

---

## Architecture

```
Quiz Player (student browser)
  │
  │ POST /api/sessions/[id]/progress   (after each answer)
  ▼
session_progress table  (upsert — 1 row per student per session)
  ▲
  │ SELECT every 1.5s
SSE handler  GET /api/sessions/[id]/live  (EventSource stream)
  │
  │ text/event-stream
  ▼
Teacher browser  /teacher/sessions/[id]/live
  └─ Leaderboard UI with CSS transition animations
```

---

## Database

### New table: `session_progress`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | auto |
| `session_id` | UUID FK → sessions | ON DELETE CASCADE |
| `student_name` | TEXT | identifies student |
| `current_question` | INTEGER | 0-indexed, increments each answer |
| `score` | INTEGER | running correct count |
| `total_questions` | INTEGER | from session |
| `is_finished` | BOOLEAN | true when student submits final attempt |
| `updated_at` | TIMESTAMPTZ | for diff detection |

**Unique constraint:** `(session_id, student_name)`

No schema change to `attempts` — this table is ephemeral progress, not the final record.

---

## API

### `POST /api/sessions/[id]/progress`

Called by the quiz player after each answer.

**Auth:** None required (anonymous students don't have sessions).

**Body:**
```json
{
  "studentName": "Alice",
  "questionIndex": 4,
  "isCorrect": true,
  "totalQuestions": 15
}
```

**Logic:**
- Verify session exists and is active
- Upsert `session_progress` row: increment score if correct, set `current_question = questionIndex + 1`
- Set `is_finished = true` when `questionIndex + 1 === totalQuestions`
- Return `{ ok: true }`

### `GET /api/sessions/[id]/live`

SSE stream for the teacher leaderboard.

**Auth:** Requires teacher session (checked via `getAuthUserId()`).

**Response:** `Content-Type: text/event-stream`

**Behavior:**
- Every 1.5s: query `session_progress` for this session, ordered by score DESC, updated_at ASC
- Send `data: <JSON>\n\n` only when data changes (compare hash/timestamp)
- Close stream when client disconnects
- Send initial snapshot immediately on connect

**Event payload:**
```json
{
  "entries": [
    { "rank": 1, "studentName": "Alice", "score": 12, "currentQuestion": 13, "totalQuestions": 15, "isFinished": false }
  ],
  "playing": 8,
  "finished": 3
}
```

---

## Frontend: `/teacher/sessions/[id]/live`

**Route:** `web/src/app/teacher/sessions/[id]/live/page.tsx`

**Layout:**
- Full dark screen (`bg-slate-950`)
- Header: quiz title + session code + "8 playing / 3 finished" counter
- Leaderboard list: each row shows rank badge, student name, score/total, question progress bar
- Top 3 rows highlighted: 🥇 gold, 🥈 silver, 🥉 bronze border

**Animation:**
- Use CSS `transition: all 0.4s ease` on `order` (flexbox) or absolute position
- Track previous rank per student; when rank changes, trigger a brief highlight flash

**SSE connection:**
```typescript
const source = new EventSource(`/api/sessions/${id}/live`);
source.onmessage = (e) => setLeaderboard(JSON.parse(e.data));
```

**Reconnect:** Browser EventSource auto-reconnects on disconnect.

**Link from session detail page:** Add "▶ Live View" button on `/teacher/sessions/[id]` pointing to `/teacher/sessions/[id]/live`.

---

## Quiz Player Changes

Add a single fire-and-forget call after each answer is recorded (before moving to next question):

```typescript
// In quiz player, after recording answer locally:
fetch(`/api/sessions/${sessionId}/progress`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ studentName, questionIndex: currentIndex, isCorrect, totalQuestions }),
});
// No await — fire and forget, don't block UI
```

---

## Migration

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

---

## Out of Scope

- Teacher cannot pause/stop the session from this view
- No per-question breakdown (only total score shown)
- No anonymous student tracking by device fingerprint
- Leaderboard is teacher-only (no public URL)

---

## Testing

- Unit: `POST /api/sessions/[id]/progress` — upsert correct, score increments, is_finished flag
- E2E: open `/teacher/sessions/[id]/live`, student answers question → rank appears in leaderboard within 3s
