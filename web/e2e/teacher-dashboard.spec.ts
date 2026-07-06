import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Mock data — field names match the actual API response shapes used by the
// teacher dashboard component (QuizRow / SessionRow interfaces in page.tsx).
// ---------------------------------------------------------------------------

const MOCK_QUIZZES = [
  {
    id: 'q1',
    title: 'FCE Practice Set 1',
    // questions is an array; the dashboard renders its .length as "question count"
    questions: Array.from({ length: 30 }, (_, i) => ({ id: i + 1 })),
    time_per_question: 20,
    source: 'json',
  },
];

const MOCK_SESSIONS = [
  {
    id: 's1',
    code: 'XYZ789',
    status: 'active',
    isActive: true,
    createdAt: '2026-06-30T00:00:00.000Z',
    quizTitle: 'FCE Practice Set 1',
    quizId: 'q1',
    batchId: null,
    batchOrder: null,
    lobbyCount: 5,
    finishedCount: 3,
  },
];

const MOCK_NEW_SESSION = {
  id: 'new-session-id',
  code: 'NEW123',
  isActive: true,
  createdAt: '2026-06-30T01:00:00.000Z',
  quizId: 'q1',
  teacherId: 'teacher-1',
  batchId: null,
  batchOrder: null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function mockApis(page: import('@playwright/test').Page) {
  // GET /api/quizzes → teacher's quiz list
  await page.route('/api/quizzes', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_QUIZZES),
      });
    } else {
      await route.continue();
    }
  });

  // GET /api/sessions → teacher's active sessions
  await page.route('/api/sessions', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SESSIONS),
      });
    } else {
      await route.continue();
    }
  });
}

// ---------------------------------------------------------------------------
// Authenticated tests (use project-level storageState: e2e/.auth/user.json)
// ---------------------------------------------------------------------------

test.describe('Teacher Dashboard — authenticated', () => {
  test.beforeEach(async ({ page }) => {
    await mockApis(page);
    await page.goto('/teacher/quizzes');
    // SessionProvider polling can prevent networkidle — wait for a specific element instead
    await page.getByText('Created').waitFor({ timeout: 15_000 });
  });

  // Req 1 — quiz list renders title and question count
  test('dashboard loads and shows quiz list with title and question count', async ({ page }) => {
    // Quiz Sets section heading
    await expect(page.getByText('Created')).toBeVisible();

    // Quiz title
    await expect(page.getByText('FCE Practice Set 1').first()).toBeVisible();

    // Question count derived from questions.length (30 items in mock)
    await expect(page.getByText(/30 questions/)).toBeVisible();

    // Time per question and source
    await expect(page.getByText(/20s\/q/)).toBeVisible();
    await expect(page.getByText(/json/)).toBeVisible();
  });

  // Req 2 — "+ Add quiz" navigates to /teacher/quizzes/new
  test('clicking "+ Add quiz" navigates to /teacher/quizzes/new', async ({ page }) => {
    await page.getByRole('link', { name: '+ Add quiz' }).click();
    await expect(page).toHaveURL(/\/teacher\/quizzes\/new/);
  });

  // Req 4 — "▶ Start" creates a session and shows the room code notification banner
  test('clicking "▶ Start" shows room code in notification banner', async ({ page }) => {
    // Mock POST /api/sessions for session creation
    await page.route('/api/sessions', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_NEW_SESSION),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_SESSIONS),
        });
      }
    });

    await page.getByRole('button', { name: '▶ Start' }).first().click();

    // Banner with "Room created!" heading
    await expect(page.getByText('✓ Room created!')).toBeVisible({ timeout: 8000 });

    // Room code displayed in the banner (monospace large text)
    await expect(page.getByText('NEW123', { exact: true })).toBeVisible();

    // "Copy link" button present in the banner
    await expect(page.getByRole('button', { name: 'Copy link' }).first()).toBeVisible();
  });

  // Req 6 — Sessions page shows active sessions with room code and quiz title
  test('sessions page displays sessions with room code and quiz title', async ({ page }) => {
    await page.goto('/teacher/sessions');
    await page.waitForLoadState('networkidle');

    // Room code shown
    await expect(page.getByText('XYZ789')).toBeVisible();

    // Quiz title shown
    await expect(page.getByText('FCE Practice Set 1').first()).toBeVisible();

    // "View results" link for active session
    await expect(page.getByRole('link', { name: 'View results' }).first()).toBeVisible();
  });

  // Req 7 — "View results" navigates to /teacher/sessions/[id]
  test('clicking "View results" navigates to /teacher/sessions/[id]', async ({ page }) => {
    await page.goto('/teacher/sessions');
    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: 'View results' }).first().click();
    await expect(page).toHaveURL(/\/teacher\/sessions\/s1/);
  });
});

// ---------------------------------------------------------------------------
// Unauthenticated test — override storageState to simulate no active session
// ---------------------------------------------------------------------------

test.describe('Teacher Dashboard — unauthenticated', () => {
  // Clear auth cookies so middleware treats this as an anonymous visitor
  test.use({ storageState: { cookies: [], origins: [] } });

  // Req 10 — visiting /teacher without auth redirects to /teacher/login
  test('visiting /teacher without auth redirects to /teacher/login', async ({ page }) => {
    await page.goto('/teacher');
    // Middleware (src/middleware.ts) redirects any unauthenticated /teacher/* request
    await expect(page).toHaveURL(/\/teacher\/login/, { timeout: 10000 });
  });
});
