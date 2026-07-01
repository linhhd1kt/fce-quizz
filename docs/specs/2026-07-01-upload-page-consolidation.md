# Upload Page Consolidation & Inline Question Editor

## Goal

Consolidate two redundant upload pages into one teacher-only page, remove JSON import, and add full inline question review/editing after PDF extraction.

## Background

The app currently has two upload paths:
- `/upload` — public page, saves to localStorage, shows only 5 questions
- `/teacher/quizzes/new` — teacher-only, saves to DB, shows all questions in game chunks

Only teachers create quizzes. The public `/upload` page and the standalone `/import` (JSON) page are dead weight.

---

## Scope

### 1. Delete Obsolete Pages

| File | Action |
|------|--------|
| `src/app/upload/page.tsx` | Delete |
| `src/app/import/page.tsx` | Delete |

Any navigation links pointing to `/upload` or `/import` must be removed at the same time.

### 2. PDF-Only Drop Zone (`/teacher/quizzes/new`)

Remove all JSON import functionality:
- Delete `handleJson()` function
- Delete `jsonRef` ref and hidden JSON `<input>`
- Remove `"Import JSON? Select JSON file"` text block (lines 191–196)
- Drop zone `accept` attribute: `.pdf,application/pdf` only
- Drop handler: if file is not `.pdf` → show error "Only PDF files accepted."
- Drop zone hint text: `"Drag PDF here, or click to select"`

### 3. Inline Question Review & Edit

After extraction, game chunks display as before (collapsible). When a chunk is expanded, each question card supports inline editing.

#### State additions

```typescript
// Set of question IDs currently in edit mode
const [editingIds, setEditingIds] = useState<Set<string>>(new Set());

// Update one or more fields of a question by id
function updateQuestion(id: string, patch: Partial<MultipleChoiceQuestion>) {
  setQuiz(prev => {
    if (!prev) return prev;
    return {
      ...prev,
      questions: prev.questions.map(q => q.id === id ? { ...q, ...patch } : q),
    };
  });
}

function toggleEdit(id: string) {
  setEditingIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
}
```

State resets (`editingIds` cleared) whenever a new quiz is loaded via `initQuiz()`.

#### Read mode (default)

```
┌──────────────────────────────────────────────────────┐
│ 3. What does "abrupt" mean?                    [✎]   │
│                                                       │
│ ┌─────────────────┐  ┌─────────────────┐             │
│ │ A. sudden  ✓    │  │ B. careful      │             │  ← correct option: emerald border
│ └─────────────────┘  └─────────────────┘             │
│ ┌─────────────────┐  ┌─────────────────┐             │
│ │ C. slow         │  │ D. polite       │             │
│ └─────────────────┘  └─────────────────┘             │
│                                                       │
│ 💡 "Abrupt" describes something happening suddenly…  │  ← shown only if explanation exists
└──────────────────────────────────────────────────────┘
```

- `[✎]` button in top-right corner enters edit mode for this question
- Correct option has `bg-emerald-950 border-emerald-800 text-emerald-300` (same as existing preview style)
- Explanation shown below options if `q.explanation` is non-empty

#### Edit mode (after clicking `[✎]`)

```
┌──────────────────────────────────────────────────────┐
│ Question text                                         │
│ ┌────────────────────────────────────────────────┐   │
│ │ What does "abrupt" mean?                       │   │  ← textarea, 2 rows
│ └────────────────────────────────────────────────┘   │
│                                                       │
│ Options                         Correct               │
│ ┌────────────────────────────┐  ○  A. sudden          │
│ │ sudden                     │                        │
│ └────────────────────────────┘  ●  A ← selected       │
│ ┌────────────────────────────┐  ○  B. careful         │
│ │ careful                    │                        │
│ └────────────────────────────┘                        │
│ … (C, D same pattern)                                 │
│                                                       │
│ Explanation                                           │
│ ┌────────────────────────────────────────────────┐   │
│ │ "Abrupt" describes something happening…        │   │  ← textarea, 2 rows
│ └────────────────────────────────────────────────┘   │
│                                                [✓ Done]│
└──────────────────────────────────────────────────────┘
```

- Each option row: `<input type="text">` + radio button to mark as correct answer
- When radio is selected, `updateQuestion(id, { answer: options[i] })`
- `[✓ Done]` calls `toggleEdit(id)` to collapse back to read mode
- All changes update `quiz.questions` in React state only — no API call yet
- "Lưu & Tạo batch" sends the (possibly edited) `quiz.questions` to DB as before

---

## Files Changed

| File | Change |
|------|--------|
| `src/app/upload/page.tsx` | Delete |
| `src/app/import/page.tsx` | Delete |
| `src/app/teacher/quizzes/new/page.tsx` | Remove JSON import; add `editingIds`, `updateQuestion`, `toggleEdit`; inline edit UI per question card |

No new files. No API changes. No DB schema changes.

---

## Out of Scope

- Reordering questions
- Adding/removing questions
- Bulk edit
- Auto-save drafts
- Undo/redo
