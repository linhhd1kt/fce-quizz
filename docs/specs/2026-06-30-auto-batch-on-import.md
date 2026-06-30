# Design: Auto-Batch on PDF Import

**Date:** 2026-06-30
**Status:** Approved

## Problem

Current flow requires 2 steps after extracting a PDF:
1. Click "Save to library →" (or "Lưu & Tạo N batch →")
2. Separately configure batch size

Teachers want to see the game split **immediately** after extraction, adjust if needed, then create with one click.

## Requirements

- After PDF extraction, automatically compute `targetGames` and show questions grouped by game
- Teacher can change `targetGames` → groups re-render instantly (client-side, no API call)
- Groups are collapsed by default; teacher can expand/collapse each game
- Single action button: "Lưu & Tạo N batch →"
- Remove "Save to library →" button (no save-without-batch flow)
- Remove "Split into parts" toggle (separate feature, unrelated)
- Room codes displayed inline after batch creation (unchanged)

## Auto-Calculation Formula

```
targetGames = Math.ceil(totalQuestions / 15)
```

Examples:
- 50 questions → 4 games (13, 13, 12, 12)
- 30 questions → 2 games (15, 15)
- 17 questions → 2 games (9, 8)
- 14 questions → 1 game (14)

`targetGames` is then editable (range: 1–20), with real-time re-grouping.

## UI Layout

### After extraction (before batch creation)

```
✓ Found 50 questions — "Tuyển tập Nguyễn Huệ"

Chia thành [4] games (~13 câu/game)

▶ Game 1 (13 câu)    ← collapsed by default, click to expand
▶ Game 2 (13 câu)
▶ Game 3 (12 câu)
▶ Game 4 (12 câu)

[Lưu & Tạo 4 batch →]
```

### Game expanded

```
▼ Game 1 (13 câu)
   1. Câu hỏi A...
   2. Câu hỏi B...
   ...  (all 13 questions)
▶ Game 2 (13 câu)
```

### After batch creation (unchanged from current)

```
✓ Đã tạo 4 game từ 50 câu — "Tuyển tập Nguyễn Huệ"

  Game 1  KH3X9A  13 câu  [Copy]
  Game 2  MB7Y2P  13 câu  [Copy]
  Game 3  NR4Z6Q  12 câu  [Copy]
  Game 4  WC8D1T  12 câu  [Copy]

[← Về dashboard]
```

## State Changes

### Remove
- `splitEnabled: boolean`
- `splitSize: number`

### Keep (unchanged)
- `targetGames: number` — now auto-initialized from question count
- `batchResult: BatchResult | null`
- `copying: string | null`

### Add
- `expandedGames: Set<number>` — set of `batchOrder` values currently expanded (default: empty set = all collapsed)

## Chunking Logic

Reuse existing `chunkByTargetGames` from `@/lib/chunk-by-target-games.ts` — imported directly in the component for client-side preview grouping. No API call needed for preview.

```typescript
// When quiz loads or targetGames changes:
const gameChunks = chunkByTargetGames(quiz.questions, targetGames);
// gameChunks[i] = array of questions for game i+1
```

## Functions Changed

### `handleSaveToDb` → removed
No longer needed. Only `handleSaveAndBatch` remains as the save action.

### `handleSaveAndBatch` — unchanged
Same POST /api/quizzes → POST /api/sessions/batch flow. No change to API calls.

### New: `toggleGame(batchOrder: number)`
```typescript
function toggleGame(order: number) {
  setExpandedGames(prev => {
    const next = new Set(prev);
    next.has(order) ? next.delete(order) : next.add(order);
    return next;
  });
}
```

## targetGames Auto-Init

When `setQuiz(data)` is called after extraction, also set:
```typescript
setTargetGames(Math.max(1, Math.ceil(data.questions.length / 15)));
setExpandedGames(new Set());
```

## Files Changed

| File | Change |
|---|---|
| `web/src/app/teacher/quizzes/new/page.tsx` | Remove splitEnabled/splitSize/handleSaveToDb, add expandedGames state, auto-init targetGames, replace flat preview with grouped collapsed view |

## Out of Scope

- Changing the batch API (no API changes needed)
- Adding a "save without batch" flow
- Persisting expanded/collapsed state across page reloads
- Editing individual questions before saving
