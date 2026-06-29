# Design: Save & Create Batch Games

**Date:** 2026-06-29
**Status:** Approved

## Problem

After extracting a PDF with ~50 questions, the teacher must:
1. Save quiz to DB
2. Navigate to dashboard
3. Manually click "+ Batch" and input a batch size

This is 3 steps. The goal is to reduce to 1 click: **"Lưu & Tạo Batch"**.

## Requirements

- One-click: save quiz + create batch sessions
- Auto-split: teacher inputs `targetGames` (default 4), system calculates questions/game
- Split formula: `batchSize = ceil(totalQuestions / targetGames)`, distribute remainder evenly
- Show results inline on the same page (no redirect)
- Display each game's room code + question count
- Existing "Save to library →" button and dashboard "+ Batch" unchanged

## Split Logic

Two modes with separate chunking algorithms:

**Mode A — `targetGames` (new):** evenly-distributed split
```
base      = floor(total / targetGames)   // minimum per game
remainder = total % targetGames          // first N games get +1

Example: 50 questions, targetGames=4
  base=12, remainder=2
  → Game 1: 13, Game 2: 13, Game 3: 12, Game 4: 12
```

**Mode B — `batchSize` (existing):** greedy fill (unchanged)
```
Example: 50 questions, batchSize=13
  → Game 1: 13, Game 2: 13, Game 3: 13, Game 4: 11
```

Edge cases:
- `targetGames > total`: `base=0`, first `total` games get 1 question, rest are empty → skip empty chunks
- `total = 0`: return 400 before reaching split logic
- `targetGames = 0`: treat as `targetGames = 1` (guard against division by zero)

## API Change

**`POST /api/sessions/batch`** — add optional `targetGames` param:

```typescript
// Request body
{ quizId: string, batchSize?: number, targetGames?: number }

// Resolution priority:
// 1. targetGames → size = ceil(total / targetGames)
// 2. batchSize   → size = clamp(batchSize, 5, 50)
// 3. default     → size = 15
```

No breaking change — existing callers using `batchSize` continue to work.

## UI Change

**File:** `web/src/app/teacher/quizzes/new/page.tsx`

### New state
```typescript
const [targetGames, setTargetGames] = useState(4);
const [batchResult, setBatchResult] = useState<BatchResult | null>(null);

type BatchResult = {
  batchId: string;
  quizTitle: string;
  parts: { id: string; code: string; batchOrder: number; questionCount: number }[];
};
```

### New function `handleSaveAndBatch`
```
1. setStatus('saving')
2. POST /api/quizzes → get quizId
3. POST /api/sessions/batch { quizId, targetGames }
4. setBatchResult(data)
5. setStatus('success')
   (no router.replace — stay on page to show codes)
```

### Button placement
In the success banner (line 184), add a second button next to "Save to library →":

```
[Save to library →]   [Lưu & Tạo X batch →]
```

Where X = targetGames (shown dynamically).

Add a small inline input for `targetGames` near the button (default 4, range 2–10).

### Result section (shown after batch creation)
Rendered below the preview when `batchResult` is set:

```
✓ Đã tạo 4 game từ 50 câu — "Tuyển tập đề Nguyễn Huệ"

  Game 1  KH3X9A  13 câu  [Copy]
  Game 2  MB7Y2P  13 câu  [Copy]
  Game 3  NR4Z6Q  12 câu  [Copy]
  Game 4  WC8D1T  12 câu  [Copy]

[← Về dashboard]
```

Each row: copy button copies the room code to clipboard.

## Files Changed

| File | Change |
|---|---|
| `web/src/app/api/sessions/batch/route.ts` | Add `targetGames` param, calculate `batchSize` from it |
| `web/src/app/teacher/quizzes/new/page.tsx` | Add button, state, handler, result section |

## Out of Scope

- Modifying the dashboard "+ Batch" button (unchanged)
- Changing the "Split into parts" toggle (creates separate quiz records — different feature)
- Email/share batch links
