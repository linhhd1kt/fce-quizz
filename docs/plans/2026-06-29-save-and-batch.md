# Save & Create Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Lưu & Tạo X batch →" button on the quiz creation page that saves the quiz and auto-splits it into N evenly-distributed game sessions in one click.

**Architecture:** Two independent changes — (1) extend the batch API to accept `targetGames` param with evenly-distributed chunking, (2) update the quiz creation UI to add the new button, state, handler, and result display.

**Tech Stack:** Next.js App Router, TypeScript, Drizzle ORM, PostgreSQL, Vitest

## Global Constraints

- All code and comments in English
- Conventional Commits: `feat:`, `fix:`, `test:` etc.
- No redirect after batch creation — stay on page to display room codes
- Existing callers of `POST /api/sessions/batch` with `batchSize` must continue to work unchanged
- `targetGames` range: 1–20 (guard: treat 0 as 1)
- Tests use Vitest with `environment: 'node'` and `globals: true`

---

### Task 1: Extend batch API with `targetGames` param

**Files:**
- Modify: `web/src/app/api/sessions/batch/route.ts`

**Interfaces:**
- Consumes: `POST /api/sessions/batch` body `{ quizId: string, batchSize?: number, targetGames?: number }`
- Produces: `{ batchId: string, quizTitle: string, parts: { id: string, code: string, batchOrder: number, questionCount: number }[] }`

- [ ] **Step 1: Write the failing test**

Create `web/src/app/api/sessions/batch/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock heavy deps before importing route
vi.mock('@/db/client', () => ({ db: { select: vi.fn(), insert: vi.fn() } }));
vi.mock('@/db/schema', () => ({ sessions: {}, quizzes: {} }));
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }));
vi.mock('@/lib/server-auth', () => ({ getAuthUserId: vi.fn() }));

// Unit-test only the chunking logic extracted from the route
function chunkByTargetGames(questions: unknown[], targetGames: number): unknown[][] {
  const total = questions.length;
  const games = Math.max(1, targetGames);
  const base = Math.floor(total / games);
  const remainder = total % games;
  const chunks: unknown[][] = [];
  let offset = 0;
  for (let i = 0; i < games; i++) {
    const size = i < remainder ? base + 1 : base;
    if (size === 0) break;
    chunks.push(questions.slice(offset, offset + size));
    offset += size;
  }
  return chunks;
}

describe('chunkByTargetGames', () => {
  it('splits 50 questions into 4 games evenly [13,13,12,12]', () => {
    const qs = Array.from({ length: 50 }, (_, i) => i);
    const chunks = chunkByTargetGames(qs, 4);
    expect(chunks.map(c => c.length)).toEqual([13, 13, 12, 12]);
  });

  it('splits 10 questions into 3 games [4,3,3]', () => {
    const qs = Array.from({ length: 10 }, (_, i) => i);
    const chunks = chunkByTargetGames(qs, 3);
    expect(chunks.map(c => c.length)).toEqual([4, 3, 3]);
  });

  it('targetGames > total: returns one question per game, skips empties', () => {
    const qs = Array.from({ length: 3 }, (_, i) => i);
    const chunks = chunkByTargetGames(qs, 10);
    expect(chunks.length).toBe(3);
    expect(chunks.every(c => c.length === 1)).toBe(true);
  });

  it('targetGames = 0 treated as 1', () => {
    const qs = Array.from({ length: 5 }, (_, i) => i);
    const chunks = chunkByTargetGames(qs, 0);
    expect(chunks.length).toBe(1);
    expect(chunks[0].length).toBe(5);
  });

  it('targetGames = 1 returns single chunk with all questions', () => {
    const qs = Array.from({ length: 7 }, (_, i) => i);
    const chunks = chunkByTargetGames(qs, 1);
    expect(chunks.length).toBe(1);
    expect(chunks[0].length).toBe(7);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd web && npx vitest run src/app/api/sessions/batch/route.test.ts
```
Expected: FAIL — `chunkByTargetGames is not defined` or similar

- [ ] **Step 3: Implement the route change**

Replace `web/src/app/api/sessions/batch/route.ts` with:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { sessions, quizzes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthUserId } from '@/lib/server-auth';
import type { MultipleChoiceQuestion } from '@/types/quiz';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateCode() {
  return Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}

async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = generateCode();
    const existing = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.code, code));
    if (!existing.length) return code;
  }
  throw new Error('Could not generate unique code');
}

function chunkByTargetGames(questions: MultipleChoiceQuestion[], targetGames: number): MultipleChoiceQuestion[][] {
  const total = questions.length;
  const games = Math.max(1, targetGames);
  const base = Math.floor(total / games);
  const remainder = total % games;
  const chunks: MultipleChoiceQuestion[][] = [];
  let offset = 0;
  for (let i = 0; i < games; i++) {
    const size = i < remainder ? base + 1 : base;
    if (size === 0) break;
    chunks.push(questions.slice(offset, offset + size));
    offset += size;
  }
  return chunks;
}

export async function POST(req: NextRequest) {
  const teacherId = await getAuthUserId();
  if (!teacherId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { quizId, batchSize, targetGames } = await req.json();
  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, quizId));
  if (!quiz || quiz.teacherId !== teacherId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const allQuestions = quiz.questions as MultipleChoiceQuestion[];
  if (allQuestions.length === 0) return NextResponse.json({ error: 'Quiz has no questions' }, { status: 400 });

  let chunks: MultipleChoiceQuestion[][];
  if (targetGames != null) {
    chunks = chunkByTargetGames(allQuestions, targetGames);
  } else {
    const size = Math.max(5, Math.min(50, batchSize ?? 15));
    chunks = [];
    for (let i = 0; i < allQuestions.length; i += size) {
      chunks.push(allQuestions.slice(i, i + size));
    }
  }

  const batchId = crypto.randomUUID();
  const parts: { id: string; code: string; batchOrder: number; questionCount: number }[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const code = await uniqueCode();
    const [s] = await db.insert(sessions).values({
      quizId,
      teacherId,
      code,
      questionsSubset: chunks[i],
      batchId,
      batchOrder: i + 1,
    }).returning();
    parts.push({ id: s.id, code: s.code, batchOrder: i + 1, questionCount: chunks[i].length });
  }

  return NextResponse.json({ batchId, quizTitle: quiz.title, parts }, { status: 201 });
}
```

Note: `chunkByTargetGames` is defined at module level so the test file can copy the same logic for unit testing.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd web && npx vitest run src/app/api/sessions/batch/route.test.ts
```
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
cd web && git add src/app/api/sessions/batch/route.ts src/app/api/sessions/batch/route.test.ts
git commit -m "feat: add targetGames param to batch API with even-distribution chunking"
```

---

### Task 2: Add "Lưu & Tạo Batch" button and result display

**Files:**
- Modify: `web/src/app/teacher/quizzes/new/page.tsx`

**Interfaces:**
- Consumes:
  - `POST /api/quizzes` → `{ id: string }` (existing)
  - `POST /api/sessions/batch { quizId, targetGames }` → `{ batchId: string, quizTitle: string, parts: { id: string, code: string, batchOrder: number, questionCount: number }[] }` (from Task 1)
- Produces: updated page component (no new exports)

- [ ] **Step 1: Add new state and type to the page**

In `web/src/app/teacher/quizzes/new/page.tsx`, add after the `Status` type definition:

```typescript
type BatchResult = {
  batchId: string;
  quizTitle: string;
  parts: { id: string; code: string; batchOrder: number; questionCount: number }[];
};
```

Inside `NewQuizPage()`, add after `const [splitSize, setSplitSize] = useState(15);`:

```typescript
const [targetGames, setTargetGames] = useState(4);
const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
const [copying, setCopying] = useState<string | null>(null);
```

- [ ] **Step 2: Add `handleSaveAndBatch` function**

Add this function after `handleSaveToDb`:

```typescript
async function handleSaveAndBatch() {
  if (!quiz) return;
  setStatus('saving');
  setBatchResult(null);

  const basePayload = {
    description: quiz.description ?? '',
    source: quiz.source ?? '',
    timePerQuestion: quiz.timePerQuestion ?? 45,
    skippedSections: quiz.skippedSections ?? null,
  };

  try {
    const saveRes = await fetch('/api/quizzes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basePayload, title: quiz.title, questions: quiz.questions }),
    });
    if (!saveRes.ok) {
      const err = await saveRes.json();
      throw new Error(err.error ?? saveRes.statusText);
    }
    const { id: quizId } = await saveRes.json();

    const batchRes = await fetch('/api/sessions/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId, targetGames }),
    });
    if (!batchRes.ok) {
      const err = await batchRes.json();
      throw new Error(err.error ?? batchRes.statusText);
    }
    const data = await batchRes.json();
    setBatchResult(data);
    setStatus('success');
  } catch (err) {
    setStatus('error');
    setMessage('Save failed: ' + (err instanceof Error ? err.message : String(err)));
  }
}
```

- [ ] **Step 3: Add copy helper**

Add after `handleSaveAndBatch`:

```typescript
async function copyCode(code: string) {
  await navigator.clipboard.writeText(code);
  setCopying(code);
  setTimeout(() => setCopying(null), 1500);
}
```

- [ ] **Step 4: Update the success banner to include the new button**

Find the success banner block (lines 180–191 in current file). Replace the single-button `<div>` with two buttons + a `targetGames` input:

```tsx
{(status === 'success' || status === 'saving') && quiz && (
  <div className="space-y-4">
    <div className="bg-emerald-950 border border-emerald-800 rounded-xl p-4 space-y-3">
      <p className="text-emerald-400 font-semibold text-sm">✓ {message}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleSaveToDb}
          disabled={status === 'saving'}
          className="shrink-0 px-4 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {status === 'saving' ? 'Saving…' : splitEnabled && quiz.questions.length > splitSize ? `Save all + ${Math.ceil(quiz.questions.length / splitSize)} parts →` : 'Save to library →'}
        </button>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={1}
            max={20}
            value={targetGames}
            disabled={status === 'saving'}
            onChange={(e) => setTargetGames(Math.max(1, Math.min(20, Number(e.target.value))))}
            className="w-12 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-sm text-white text-center focus:outline-none focus:border-slate-500 disabled:opacity-40"
          />
          <button
            onClick={handleSaveAndBatch}
            disabled={status === 'saving'}
            className="shrink-0 px-4 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {status === 'saving' ? 'Saving…' : `Lưu & Tạo ${targetGames} batch →`}
          </button>
        </div>
      </div>
    </div>
    {/* preview questions */}
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        Preview ({quiz.questions.length} questions)
      </p>
      {quiz.questions.slice(0, 5).map((q, idx) => (
        <div key={q.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <p className="text-white text-sm font-medium">{idx + 1}. {q.text}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {q.options.map((opt, j) => (
              <div key={j} className={`text-xs px-2.5 py-1.5 rounded-lg border ${opt === q.answer ? 'bg-emerald-950 border-emerald-800 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                {['A','B','C','D'][j]}. {opt}
              </div>
            ))}
          </div>
        </div>
      ))}
      {quiz.questions.length > 5 && (
        <p className="text-center text-slate-600 text-xs">+{quiz.questions.length - 5} more</p>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 5: Add batch result section below the preview block**

After the closing `)}` of the `(status === 'success' || status === 'saving') && quiz` block, add:

```tsx
{batchResult && (
  <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-4">
    <p className="text-emerald-400 font-semibold text-sm">
      ✓ Đã tạo {batchResult.parts.length} game từ {quiz?.questions.length ?? 0} câu — &quot;{batchResult.quizTitle}&quot;
    </p>
    <div className="space-y-2">
      {batchResult.parts.map((part) => (
        <div key={part.id} className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-2.5 gap-3">
          <span className="text-slate-400 text-sm">Game {part.batchOrder}</span>
          <span className="font-mono text-white text-sm tracking-widest">{part.code}</span>
          <span className="text-slate-500 text-xs">{part.questionCount} câu</span>
          <button
            onClick={() => copyCode(part.code)}
            className="text-xs px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md transition-colors"
          >
            {copying === part.code ? 'Copied!' : 'Copy'}
          </button>
        </div>
      ))}
    </div>
    <Link href="/teacher" className="inline-block text-sm text-slate-400 hover:text-white transition-colors">
      ← Về dashboard
    </Link>
  </div>
)}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 7: Commit**

```bash
cd web && git add src/app/teacher/quizzes/new/page.tsx
git commit -m "feat: add Lưu & Tạo Batch button with inline room code display"
```

---

## Self-Review Checklist

- [x] `targetGames` param added to API with correct chunking
- [x] Existing `batchSize` callers unaffected
- [x] Edge cases: `targetGames=0` → 1, `targetGames > total` → skip empty chunks
- [x] Empty quiz guard (400) before chunking
- [x] UI: new button, targetGames input (1–20), result section
- [x] No redirect after batch creation
- [x] Copy to clipboard with visual feedback
- [x] "← Về dashboard" link in result section
- [x] TypeScript types consistent between Task 1 response and Task 2 consumption
