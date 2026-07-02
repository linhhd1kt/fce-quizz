# Feature 8: Achievements Leaderboard — Design

**Date:** 2026-07-02
**Status:** Approved
**Depends on:** Feature 5 (Student Auth & Profile)

---

## Overview

A public leaderboard at `/student/leaderboard` shows the top 10 students ranked by total correct answers. Any authenticated student can view it. No new DB tables or migrations needed — data comes from the existing `student_stats` table joined with `students`.

---

## User Stories

- As a student, I see a link to the leaderboard from my profile page
- As a student, I visit `/student/leaderboard` and see the top 10 students ranked by total correct answers
- As a student, I see rank badges (gold/silver/bronze) for the top 3
- The page requires student login (protected by existing middleware)

---

## Architecture

```
/student/leaderboard  (client page)
  │
  │ GET /api/student/leaderboard
  ▼
student_stats JOIN students
  ORDER BY total_correct DESC
  LIMIT 10
```

No new DB tables. No migration.

---

## API

### `GET /api/student/leaderboard`

**Auth:** Requires student session (`session.user.role === 'student'`).

**Logic:**
1. Auth check — return 401 if not a student
2. JOIN `student_stats` with `students` on `student_id`
3. ORDER BY `total_correct DESC` LIMIT 10
4. Return array

**Response:**
```json
[
  { "rank": 1, "displayName": "Alice", "totalCorrect": 342, "totalGames": 28 },
  { "rank": 2, "displayName": "Bob",   "totalCorrect": 290, "totalGames": 22 },
  ...
]
```

**File:** `web/src/app/api/student/leaderboard/route.ts`

---

## Frontend

### Leaderboard page — `/student/leaderboard`

**Route:** `web/src/app/student/leaderboard/page.tsx`

**UI:**
- Dark theme `bg-slate-950` — same as profile and practice pages
- Header: "🏆 Bảng xếp hạng" + link "← Về trang cá nhân"
- List of up to 10 rows:
  - Rank badge: 🥇 🥈 🥉 for top 3, plain number for 4-10
  - Student display name
  - Total correct answers (prominent)
  - Total games played (secondary, smaller text)
- Loading state while fetching
- Empty state if no students yet

**State:** Single `useEffect` fetch on mount, same pattern as profile page.

### Profile page update — `/student/profile`

Add a small link below the stats grid:
```
Ver bảng xếp hạng →
```
Links to `/student/leaderboard`.

---

## File Map

| File | Action |
|------|--------|
| `web/src/app/api/student/leaderboard/route.ts` | Create — GET endpoint |
| `web/src/app/api/student/leaderboard/route.test.ts` | Create — unit tests |
| `web/src/app/student/leaderboard/page.tsx` | Create — leaderboard UI |
| `web/src/app/student/profile/page.tsx` | Modify — add leaderboard link |
| `docs/plans.md` | Modify — tick Feature 8 checkboxes |

---

## Out of Scope

- No pagination (top 10 only)
- No per-quiz leaderboard
- No weekly/monthly filters
- No highlighting of current user's rank
- No real-time updates (static fetch on page load)

---

## Testing

- Unit: `GET /api/student/leaderboard` — returns 401 for non-student; returns ranked list ordered by total_correct DESC
- E2E: student navigates to leaderboard, sees ranked list
