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
    isActive: true,
    createdAt: '2026-06-30T00:00:00.000Z',
    quizTitle: 'FCE Practice Set 1',
    quizId: 'q1',
    batchId: null,
    batchOrder: null,
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
    await page.goto('/teacher');
    // SessionProvider polling can prevent networkidle — wait for a specific element instead
    await page.getByRole('heading', { name: 'Quiz Sets' }).waitFor({ timeout: 15_000 });
  });

  // Req 1 — quiz list renders title and question count
  test('dashboard loads and shows quiz list with title and question count', async ({ page }) => {
    // Quiz Sets section heading
    await expect(page.getByRole('heading', { name: 'Quiz Sets' })).toBeVisible();

    // Quiz title
    await expect(page.getByText('FCE Practice Set 1').first()).toBeVisible();

    // Question count derived from questions.length (30 items in mock)
    await expect(page.getByText(/30 questions/)).toBeVisible();

    // Time per question and source
    await expect(page.getByText(/20s\/q/)).toBeVisible();
    await expect(page.getByText(/json/)).toBeVisible();
  });

  // Req 2 — "+ Upload new" navigates to /teacher/quizzes/new
  test('clicking "+ Upload new" navigates to /teacher/quizzes/new', async ({ page }) => {
    await page.getByRole('link', { name: '+ Upload new' }).click();
    await expect(page).toHaveURL(/\/teacher\/quizzes\/new/);
  });

  // Req 4 — "+ Room" creates a session and shows the room code notification banner
  test('clicking "+ Room" shows room code in notification banner', async ({ page }) => {
    // Mock POST /api/sessions for session creation
    await page.route('/api/sessions', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_NEW_SESSION),
        });
      } else {
        // Let GET through (already mocked above, but this is a fresh override)
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_SESSIONS),
        });
      }
    });

    await page.getByRole('button', { name: '+ Room' }).click();

    // Banner with "Room created!" heading
    await expect(page.getByText('✓ Room created!')).toBeVisible({ timeout: 8000 });

    // Room code displayed in the banner (monospace large text)
    await expect(page.getByText('NEW123', { exact: true })).toBeVisible();

    // "Copy link" button present in the banner (use first() — active rooms also has one)
    await expect(page.getByRole('button', { name: 'Copy link' }).first()).toBeVisible();
  });

  // Req 6 — Active Rooms section shows sessions with room code and quiz title
  test('active rooms section displays sessions with room code and quiz title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Active rooms' })).toBeVisible();

    // Room code in orange monospace
    await expect(page.getByText('XYZ789')).toBeVisible();

    // Quiz title
    const activeRoomsSection = page.locator('section', { hasText: 'Active rooms' });
    await expect(activeRoomsSection.getByText('FCE Practice Set 1')).toBeVisible();

    // "Copy link" and "View results" buttons
    await expect(activeRoomsSection.getByRole('button', { name: 'Copy link' })).toBeVisible();
    await expect(activeRoomsSection.getByRole('link', { name: 'View results' })).toBeVisible();
  });

  // Req 7 — "View results" navigates to /teacher/sessions/[id]
  test('clicking "View results" navigates to /teacher/sessions/[id]', async ({ page }) => {
    const activeRoomsSection = page.locator('section', { hasText: 'Active rooms' });
    await activeRoomsSection.getByRole('link', { name: 'View results' }).click();
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
