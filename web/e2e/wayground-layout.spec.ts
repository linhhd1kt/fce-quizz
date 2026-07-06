import { test, expect } from '@playwright/test';

const MOCK_QUIZZES = [
  {
    id: 'q1',
    title: 'Grammar B2',
    questions: Array.from({ length: 40 }, (_, i) => ({ id: i + 1 })),
    time_per_question: 45,
    source: 'FCE.pdf',
  },
];

const MOCK_SESSIONS = [
  {
    id: 's1',
    code: 'ABC123',
    status: 'waiting',
    quizTitle: 'Grammar B2',
    quizId: 'q1',
    batchId: null,
    batchOrder: null,
    lobbyCount: 3,
    finishedCount: 0,
    createdAt: '2026-07-06T00:00:00.000Z',
  },
  {
    id: 's2',
    code: 'XYZ789',
    status: 'ended',
    quizTitle: 'Grammar B2',
    quizId: 'q1',
    batchId: null,
    batchOrder: null,
    lobbyCount: 5,
    finishedCount: 5,
    createdAt: '2026-07-05T00:00:00.000Z',
  },
];

async function mockApis(page: import('@playwright/test').Page) {
  await page.route('/api/quizzes', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_QUIZZES) });
    } else { await route.continue(); }
  });
  await page.route('/api/sessions', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SESSIONS) });
    } else { await route.continue(); }
  });
}

test.describe('Wayground layout — teacher', () => {
  test.beforeEach(async ({ page }) => {
    await mockApis(page);
    await page.goto('/teacher/quizzes');
    await page.getByText('Grammar B2').waitFor({ timeout: 15_000 });
  });

  test('sidebar is visible on quizzes page', async ({ page }) => {
    await expect(page.locator('aside').first()).toBeVisible();
  });

  test('QuizzesPanel second panel is visible on /teacher/quizzes', async ({ page }) => {
    await expect(page.getByText('Quizzes').first()).toBeVisible();
    await expect(page.locator('aside').nth(1)).toBeVisible();
    await expect(page.getByText('Recently used')).toBeVisible();
  });

  test('sidebar nav: clicking Sessions hides QuizzesPanel', async ({ page }) => {
    await page.goto('/teacher/sessions');
    await mockApis(page);
    await page.waitForLoadState('networkidle');
    // On /teacher/sessions, second panel should NOT show quizzes panel header "Quizzes"
    // The aside for QuizzesPanel won't be rendered
    const panelCount = await page.locator('aside').count();
    // Only one aside (the sidebar) — no second panel
    expect(panelCount).toBe(1);
  });

  test('quiz search filters results', async ({ page }) => {
    const input = page.getByPlaceholder('Search by quiz name…');
    await input.fill('Grammar');
    await expect(page.getByText('Grammar B2')).toBeVisible();
    await input.fill('Nonexistent Quiz XYZ');
    await expect(page.getByText('No quizzes match your search.')).toBeVisible();
  });

  test('/teacher redirects to /teacher/quizzes', async ({ page }) => {
    await page.goto('/teacher');
    await expect(page).toHaveURL(/\/teacher\/quizzes/, { timeout: 5000 });
  });
});

test.describe('Wayground layout — sessions page', () => {
  test.beforeEach(async ({ page }) => {
    await mockApis(page);
    await page.goto('/teacher/sessions');
    await page.waitForLoadState('networkidle');
  });

  test('sessions page shows filter tabs', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Waiting' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Active' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ended' })).toBeVisible();
  });

  test('session filter tab Waiting shows only waiting sessions', async ({ page }) => {
    await page.getByRole('button', { name: 'Waiting' }).click();
    await expect(page.getByText('ABC123')).toBeVisible();
    await expect(page.getByText('XYZ789')).not.toBeVisible();
  });

  test('session filter tab Ended shows only ended sessions', async ({ page }) => {
    await page.getByRole('button', { name: 'Ended' }).click();
    await expect(page.getByText('XYZ789')).toBeVisible();
    await expect(page.getByText('ABC123')).not.toBeVisible();
  });
});

test.describe('Wayground layout — theme toggle', () => {
  test('theme toggle switches dark/light class on html element', async ({ page }) => {
    await page.goto('/teacher/quizzes');
    await page.route('/api/quizzes', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('/api/sessions', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.waitForLoadState('networkidle');

    // Default is dark
    await expect(page.locator('html')).toHaveClass(/dark/, { timeout: 3000 });

    // Click theme toggle button (title contains "light mode" or "dark mode")
    const themeBtn = page.locator('button[title*="mode"]').first();
    await themeBtn.click();
    // Should switch to light (no dark class)
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    // Toggle back
    await themeBtn.click();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});

test.describe('Wayground layout — student', () => {
  test('/student/leaderboard has no back link to Trang ca nhan', async ({ page }) => {
    await page.goto('/student/leaderboard');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('← Trang cá nhân')).toHaveCount(0);
  });
});
