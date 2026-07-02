# FCEQuiz — Project Rules

## Docs (single source of truth)

- **Spec:** `docs/specs.md` — all feature specs with Mermaid flow diagrams
- **Plan:** `docs/plans.md` — all implementation tasks with `- [ ]` / `- [x]` checkboxes
- After each task commit: tick the checkbox in `docs/plans.md` and commit it alongside the code
- After each spec change: update Mermaid diagrams to stay in sync with code

## Local Development

```bash
# Start dev server (from repo root)
cd web && node_modules/.bin/next dev

# Unit tests
cd web && npm test

# E2E tests (requires SSH tunnel + .env.local)
ssh -i ~/.ssh/digitalocean -L 15432:db.supabase.co:5432 root@139.162.42.158 -N -f
cd web && npm run test:e2e
```

> SSH tunnel dies between sessions — restart it before running E2E tests.

## Database

- **Supabase Postgres** — accessed via SSH tunnel on port `15432` locally
- Schema: `web/db/schema.ts` (Drizzle ORM)
- Migrations: `web/db/migrations/` — write SQL file, run manually against DB
- Never use `db.push()` in production — always write explicit migration files

## Tech Stack

- Next.js App Router (read `web/node_modules/next/dist/docs/` before writing any route/page)
- Drizzle ORM + Supabase Postgres
- NextAuth v5 (beta) — credentials provider for teacher; student-credentials provider for students
- Vitest for unit tests (`environment: 'node'`, `globals: true`)
- Playwright for E2E — auth state stored in `web/e2e/.auth/`

## Feature Delivery Flow

Same as global `~/git/CLAUDE.md`, with these project-specific steps:

```
Confirm
  → Spec: add section to docs/specs.md with Mermaid diagram
  → Plan: add task block to docs/plans.md with - [ ] checkboxes
  → Code: TDD for logic (streak, badges, chunking); implement directly for UI/routes
  → E2E: cover every requirement in the spec section
  → Full regression: npm run test:e2e (all specs)
  → Push → GitHub Actions CI → SSH verify PM2 + logs
```

## Implementation Order (current)

Follow `docs/plans.md` top to bottom. Next up: **Feature 5 — Student Auth & Profile** (12 tasks).

## Session Notes

- Solo developer — push directly to `origin/main`, no PR needed
- After push: check GitHub Actions → SSH verify PM2 is running + check logs
- VPS: `ssh -i ~/.ssh/digitalocean root@139.162.42.158`
- PM2: `pm2 logs fce-quiz --lines 50`
