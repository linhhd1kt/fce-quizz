import { test, expect } from '@playwright/test';

// Tests that require an unauthenticated browser (login + register flows).
// Override the global storageState so these tests start without a session.
const unauthenticatedTest = test.extend<object>({});
unauthenticatedTest.use({ storageState: { cookies: [], origins: [] } });

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

unauthenticatedTest.describe('Teacher Login', () => {
  unauthenticatedTest.beforeEach(async ({ page }) => {
    await page.goto('/teacher/login');
    await page.waitForLoadState('networkidle');
  });

  // Req 1 — valid credentials → redirect to /teacher dashboard
  unauthenticatedTest('valid credentials redirect to /teacher dashboard', async ({ page }) => {
    await page.locator('input[type="email"]').fill('e2e-test@fce-quiz.local');
    await page.locator('input[type="password"]').fill('e2e-test-2026');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('/teacher', { timeout: 15_000 });
    // Heading "Teacher" visible in dashboard header
    await expect(page.getByText('Teacher')).toBeVisible();
  });

  // Req 2 — wrong password → error message, no redirect
  unauthenticatedTest('wrong password shows error message', async ({ page }) => {
    await page.locator('input[type="email"]').fill('e2e-test@fce-quiz.local');
    await page.locator('input[type="password"]').fill('wrong-password-xyz');
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText('Invalid email or password.')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL('/teacher/login');
  });
});

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

unauthenticatedTest.describe('Teacher Register', () => {
  unauthenticatedTest.beforeEach(async ({ page }) => {
    await page.goto('/teacher/register');
    await page.waitForLoadState('networkidle');
  });

  // Req 3 — new unique email → register succeeds → redirect to /teacher/login
  unauthenticatedTest('valid registration redirects to /teacher/login', async ({ page }) => {
    const uniqueEmail = `test-register-${Date.now()}@example.com`;

    await page.getByPlaceholder('Your name').fill('E2E Test User');
    await page.getByPlaceholder('Email').fill(uniqueEmail);
    await page.getByPlaceholder('Password (min. 8 characters)').fill('password123');
    await page.locator('button[type="submit"]').click();

    await page.waitForURL('/teacher/login', { timeout: 10_000 });
    await expect(page).toHaveURL('/teacher/login');
  });

  // Req 4 — short password (< 8 chars): bypass browser minLength, API returns 400
  unauthenticatedTest('short password shows validation error', async ({ page }) => {
    await page.getByPlaceholder('Your name').fill('E2E Test User');
    await page.getByPlaceholder('Email').fill(`test-short-${Date.now()}@example.com`);

    // Remove the browser-level minLength constraint so the form submits to the API
    const passwordInput = page.getByPlaceholder('Password (min. 8 characters)');
    await passwordInput.evaluate((el) => el.removeAttribute('minlength'));
    await passwordInput.fill('short');

    await page.locator('button[type="submit"]').click();

    await expect(page.getByText('Dữ liệu không hợp lệ.')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL('/teacher/register');
  });

  // Req 5 — duplicate email shows error
  unauthenticatedTest('duplicate email shows error message', async ({ page }) => {
    // e2e-test@fce-quiz.local is the seeded test user and already exists in the DB
    await page.getByPlaceholder('Your name').fill('E2E Test User');
    await page.getByPlaceholder('Email').fill('e2e-test@fce-quiz.local');
    await page.getByPlaceholder('Password (min. 8 characters)').fill('password123');
    await page.locator('button[type="submit"]').click();

    await expect(page.getByText('Email đã được sử dụng.')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL('/teacher/register');
  });
});

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

// Uses the global storageState (authenticated session) — no override needed.
test.describe('Teacher Logout', () => {
  // Explicitly restore storageState — unauthenticatedTest.use() at file level can override
  // the project-level storageState for all tests in this file including base test instances.
  test.use({ storageState: 'e2e/.auth/user.json' });
  test.beforeEach(async ({ page }) => {
    // Mock API calls so dashboard loads without real DB access
    await page.route('**/api/quizzes', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/sessions', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto('/teacher');
    // Wait for Sign out button rather than networkidle (SessionProvider polling can prevent networkidle)
    await page.getByRole('button', { name: 'Sign out' }).waitFor({ timeout: 15_000 });
  });

  // Req 6 — sign out clears session and redirects to /teacher/login
  test('clicking Sign out redirects to /teacher/login', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.waitForURL('/teacher/login', { timeout: 10_000 });
    await expect(page).toHaveURL('/teacher/login');
  });
});
