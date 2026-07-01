# Design: Teacher Authentication

**Date:** 2026-06-30
**Status:** Approved

---

## Problem

Teachers need secure, password-protected access to the FCEQuiz platform to manage quiz sets, create game sessions, and track student results. Without authentication, any user could access and modify quiz data.

## Requirements

1. A teacher can log in at `/teacher/login` with valid email and password; on success they are redirected to `/teacher` (dashboard).
2. A failed login attempt (wrong password or unknown email) shows the message "Invalid email or password." without redirecting.
3. A new teacher can register at `/teacher/register` with name, email, and password (minimum 8 characters); on success they are redirected to `/teacher/login`.
4. Registering with a password shorter than 8 characters is rejected; the error message "Dữ liệu không hợp lệ." is shown.
5. Registering with an email already in use shows the error message "Email đã được sử dụng."
6. A logged-in teacher can sign out by clicking the "Sign out" button in the dashboard header; the session is cleared and they are redirected to `/teacher/login`.

## Out of Scope

- OAuth / social login (Google, GitHub, etc.)
- Password reset flow
- Email verification
- Confirm password field on the registration form
- Role-based access control (all authenticated users have teacher-level access)

---

## UI Layout

```
/teacher/login
┌────────────────────────────────┐
│        Teacher Login           │
│  Manage quizzes and track...   │
│                                │
│  [Email input]                 │
│  [Password input]              │
│  [Error message — red text]    │
│  [Sign in button]              │
│                                │
│  No account? Register          │
│  ← Home                        │
└────────────────────────────────┘

/teacher/register
┌────────────────────────────────┐
│     Teacher Registration       │
│  Create an account to manage   │
│                                │
│  [Your name input]             │
│  [Email input]                 │
│  [Password input (min 8 chars)]│
│  [Error message — red text]    │
│  [Register button]             │
│                                │
│  Already have an account?      │
│  ← Home                        │
└────────────────────────────────┘

/teacher (dashboard — sticky header)
┌────────────────────────────────────────┐
│  FCEQuiz  /  Teacher       [Sign out]  │
└────────────────────────────────────────┘
```

---

## State Changes

### Add
- `session: NextAuthSession` — created on successful login via NextAuth credentials provider

### Remove
- `session` — cleared on sign-out via `signOut({ redirectTo: '/teacher/login' })`

### Keep (unchanged)
- Quiz data, session data, student answers — unaffected by auth state changes

---

## Data / API Changes

| Endpoint | Method | Change |
|---|---|---|
| `/api/auth/register` | POST | New — accepts `{ name, email, password }`, creates teacher account |
| `/api/auth/callback/credentials` | POST | NextAuth built-in — validates credentials against DB |

---

## Logic / Formula

```
Registration validation (server-side, /api/auth/register):
  IF email is empty OR password is empty OR password.length < 8
    → 400  { error: "Dữ liệu không hợp lệ." }
  IF email already exists in authUsers
    → 409  { error: "Email đã được sử dụng." }
  ELSE
    hash = bcrypt.hash(password, cost=12)
    INSERT INTO authUsers (name, email, password=hash)
    → 201  { ok: true }

Login (NextAuth credentials provider):
  FIND authUsers WHERE email = input.email
  IF not found OR bcrypt.compare(input.password, hash) === false
    → NextAuth error → UI shows "Invalid email or password."
  ELSE
    → create session → redirect to /teacher
```

---

## Files Changed

| File | Change |
|---|---|
| `web/src/app/teacher/login/page.tsx` | Login form using NextAuth `signIn('credentials')` |
| `web/src/app/teacher/register/page.tsx` | Registration form, POST `/api/auth/register` |
| `web/src/app/api/auth/register/route.ts` | Register API: validation, duplicate check, bcrypt hash |
| `web/src/app/teacher/page.tsx` | Dashboard with "Sign out" button in header |

---

## Edge Cases

- Empty email or password fields: browser `required` attribute prevents form submission before any API call.
- Password shorter than 8 characters: browser `minLength={8}` blocks submit as a first layer; API enforces minimum length as a second layer (returns 400).
- Duplicate email: API returns 409; UI displays "Email đã được sử dụng."
- Concurrent duplicate registration: last-writer-wins is acceptable at current scale; the first to commit succeeds and the second sees 409.
- Session expiry: Next.js middleware redirects unauthenticated requests to `/teacher/login`.

---

## E2E Test Scenarios

> Map directly to Requirements above. One scenario per requirement minimum.

| # | Scenario | Requirement |
|---|---|---|
| 1 | Teacher enters valid credentials → URL changes to /teacher, dashboard heading visible | Req 1 |
| 2 | Teacher enters wrong password → error "Invalid email or password." appears, URL stays on /teacher/login | Req 2 |
| 3 | Teacher fills name + new unique email + 8-char password → redirected to /teacher/login | Req 3 |
| 4 | Teacher submits password shorter than 8 chars (minLength bypassed) → error "Dữ liệu không hợp lệ." | Req 4 |
| 5 | Teacher registers with already-used email → error "Email đã được sử dụng." | Req 5 |
| 6 | Logged-in teacher clicks "Sign out" → redirected to /teacher/login | Req 6 |
