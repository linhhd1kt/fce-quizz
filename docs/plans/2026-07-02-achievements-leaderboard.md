# Achievements Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/student/leaderboard` page showing top 10 students ranked by total correct answers, accessible from the student profile page.

**Architecture:** A single `GET /api/student/leaderboard` route joins `student_stats` with `students`, orders by `total_correct DESC`, and returns the top 10. A client-side page fetches and renders this list. No new DB tables or migrations needed.

**Tech Stack:** Next.js App Router, Drizzle ORM, Vitest

## Global Constraints

- Auth: all `/api/student/*` routes require `session.user.role === 'student'` — return 401 otherwise
- Auth helper: `auth()` from `@/auth` — check `(session.user as { role?: string }).role === 'student'`
- Dark theme: `bg-slate-950` matching existing student pages
- Drizzle imports: `eq`, `desc` from `'drizzle-orm'`
- No new DB tables, no migration
- Plan save path: `docs/plans/2026-07-02-achievements-leaderboard.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `web/src/app/api/student/leaderboard/route.ts` | Create | GET endpoint — query top 10, return ranked list |
| `web/src/app/api/student/leaderboard/route.test.ts` | Create | Unit tests for the endpoint |
| `web/src/app/student/leaderboard/page.tsx` | Create | Leaderboard UI |
| `web/src/app/student/profile/page.tsx` | Modify | Add link to leaderboard |
| `docs/plans.md` | Modify | Tick Feature 8 checkboxes |

---

### Task 1: Leaderboard API — `GET /api/student/leaderboard`

**Files:**
- Create: `web/src/app/api/student/leaderboard/route.ts`
- Create: `web/src/app/api/student/leaderboard/route.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  // Response: Array<{ rank: number; displayName: string; totalCorrect: number; totalGames: number }>
  GET /api/student/leaderboard → 200 JSON array | 401
  ```

- [ ] **Step 1: Write failing tests**

Create `web/src/app/api/student/leaderboard/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auth } from '@/auth';

const mockLimit = vi.fn();
const mockOrderBy = vi.fn(() => ({ limit: mockLimit }));
const mockInnerJoin = vi.fn(() => ({ orderBy: mockOrderBy }));
const mockFrom = vi.fn(() => ({ innerJoin: mockInnerJoin }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

vi.mock('@/db/client', () => ({
  db: { select: mockSelect },
}));

vi.mock('@/db/schema', () => ({
  students: { displayName: {}, id: {} },
  studentStats: { studentId: {}, totalCorrect: {}, totalGames: {} },
}));

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm');
  return { ...actual, eq: vi.fn(() => ({})), desc: vi.fn((c) => c) };
});

beforeEach(() => {
  vi.resetAllMocks();
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ innerJoin: mockInnerJoin });
  mockInnerJoin.mockReturnValue({ orderBy: mockOrderBy });
  mockOrderBy.mockReturnValue({ limit: mockLimit });
  vi.mocked(auth).mockResolvedValue({ user: { id: 'student-1', role: 'student' } } as never);
});

describe('GET /api/student/leaderboard', () => {
  it('returns 401 for unauthenticated request', async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const { GET } = await import('./route');
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 401 for teacher role', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 't-1', role: 'teacher' } } as never);
    const { GET } = await import('./route');
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns ranked list ordered by totalCorrect', async () => {
    mockLimit.mockResolvedValue([
      { displayName: 'Alice', totalCorrect: 100, totalGames: 10 },
      { displayName: 'Bob',   totalCorrect: 80,  totalGames: 8  },
    ]);
    const { GET } = await import('./route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0]).toEqual({ rank: 1, displayName: 'Alice', totalCorrect: 100, totalGames: 10 });
    expect(body[1]).toEqual({ rank: 2, displayName: 'Bob',   totalCorrect: 80,  totalGames: 8  });
  });

  it('returns empty array when no students have stats', async () => {
    mockLimit.mockResolvedValue([]);
    const { GET } = await import('./route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd web && node_modules/.bin/vitest run "src/app/api/student/leaderboard" 2>&1 | tail -5
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement the route**

Create `web/src/app/api/student/leaderboard/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { students, studentStats } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== 'student') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await db
    .select({
      displayName: students.displayName,
      totalCorrect: studentStats.totalCorrect,
      totalGames: studentStats.totalGames,
    })
    .from(studentStats)
    .innerJoin(students, eq(studentStats.studentId, students.id))
    .orderBy(desc(studentStats.totalCorrect))
    .limit(10);

  const result = rows.map((row, i) => ({ rank: i + 1, ...row }));
  return NextResponse.json(result);
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd web && node_modules/.bin/vitest run "src/app/api/student/leaderboard" 2>&1 | tail -5
```

Expected: 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add web/src/app/api/student/leaderboard/
git commit -m "feat: add GET /api/student/leaderboard endpoint"
```

---

### Task 2: Leaderboard Page + Profile Link + Docs

**Files:**
- Create: `web/src/app/student/leaderboard/page.tsx`
- Modify: `web/src/app/student/profile/page.tsx`
- Modify: `docs/plans.md`

**Interfaces:**
- Consumes: `GET /api/student/leaderboard` → `Array<{ rank, displayName, totalCorrect, totalGames }>`

- [ ] **Step 1: Create leaderboard page**

Create `web/src/app/student/leaderboard/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  totalCorrect: number;
  totalGames: number;
}

const RANK_BADGE: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/student/leaderboard')
      .then((r) => r.json())
      .then((d) => { setEntries(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white px-6 py-10">
      <div className="max-w-lg mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">🏆 Bảng xếp hạng</h1>
          <Link href="/student/profile" className="text-sm text-slate-400 hover:text-white transition-colors">
            ← Trang cá nhân
          </Link>
        </div>

        {loading ? (
          <p className="text-slate-400 text-center py-12">Đang tải…</p>
        ) : entries.length === 0 ? (
          <p className="text-slate-500 text-center py-12">Chưa có dữ liệu.</p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.rank}
                className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3"
              >
                <span className="text-2xl w-8 text-center flex-shrink-0">
                  {RANK_BADGE[entry.rank] ?? entry.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{entry.displayName}</p>
                  <p className="text-xs text-slate-500">{entry.totalGames} games</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-white">{entry.totalCorrect}</p>
                  <p className="text-xs text-slate-500">câu đúng</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add leaderboard link to profile page**

In `web/src/app/student/profile/page.tsx`, add a link after the stats grid (after the closing `</div>` of the grid, before the Badges section). Find the line `{/* Badges */}` and insert before it:

```typescript
        {/* Leaderboard link */}
        <div className="text-right">
          <Link href="/student/leaderboard" className="text-sm text-blue-400 hover:underline">
            Xem bảng xếp hạng →
          </Link>
        </div>
```

Also add `Link` to the import at the top of the file:

```typescript
import Link from 'next/link';
```

- [ ] **Step 3: Verify build**

```bash
cd web && node_modules/.bin/next build 2>&1 | tail -5
```

Expected: build succeeds

- [ ] **Step 4: Run all unit tests**

```bash
cd web && node_modules/.bin/vitest run 2>&1 | tail -4
```

Expected: all tests pass (90+ tests)

- [ ] **Step 5: Update docs/plans.md**

In `docs/plans.md`, replace the Feature 8 block:

```markdown
## Feature 8: Achievements Leaderboard ✅ Done

> Spec: `docs/specs/2026-07-02-achievements-leaderboard-design.md` | Plan: `docs/plans/2026-07-02-achievements-leaderboard.md`

- [x] `GET /api/student/leaderboard` — top 10 by total correct
- [x] `/student/leaderboard` leaderboard page
- [x] Profile page link to leaderboard
```

Also update the Progress Overview table: `| 8 | Achievements Leaderboard | §8 | ✅ Done |`

- [ ] **Step 6: Commit**

```bash
git add web/src/app/student/leaderboard/ web/src/app/student/profile/page.tsx docs/plans.md
git commit -m "feat: add student leaderboard page"
```

---

## Self-Review

**Spec coverage:**
- ✅ `GET /api/student/leaderboard` auth check — Task 1
- ✅ TOP 10 by `total_correct DESC` — Task 1 route
- ✅ Returns `rank, displayName, totalCorrect, totalGames` — Task 1
- ✅ `/student/leaderboard` page with loading + empty states — Task 2
- ✅ Rank badges 🥇🥈🥉 for top 3 — Task 2 page
- ✅ Link from profile page — Task 2
- ✅ Dark theme `bg-slate-950` — Task 2 page
- ✅ Auth protected (middleware covers `/student/*` already — no new middleware needed) — confirmed

**Type consistency:**
- `LeaderboardEntry { rank, displayName, totalCorrect, totalGames }` defined in Task 2, matches the API response shape from Task 1 exactly.
- `RANK_BADGE` record indexed by rank number — matches `entry.rank` (integer 1-10) in the map.
