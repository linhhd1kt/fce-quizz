import { test, expect } from '@playwright/test';

test.describe('/join page', () => {
  test('shows code input and Join button', async ({ page }) => {
    await page.goto('/join');
    await expect(page.getByPlaceholder('Room code…')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join →' })).toBeDisabled();
  });

  test('Join button enables when code is entered', async ({ page }) => {
    await page.goto('/join');
    await page.getByPlaceholder('Room code…').fill('abc123');
    await expect(page.getByRole('button', { name: 'Join →' })).toBeEnabled();
  });

  test('input auto-uppercases', async ({ page }) => {
    await page.goto('/join');
    await page.getByPlaceholder('Room code…').fill('abc');
    await expect(page.getByPlaceholder('Room code…')).toHaveValue('ABC');
  });

  test('submitting redirects to /s/CODE', async ({ page }) => {
    await page.goto('/join');
    await page.getByPlaceholder('Room code…').fill('ABC123');
    await page.getByRole('button', { name: 'Join →' }).click();
    await expect(page).toHaveURL(/\/s\/ABC123/);
  });
});

test.describe('Teacher Lobby Page — unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('unauthenticated user is redirected from teacher lobby page', async ({ page }) => {
    await page.goto('/teacher/sessions/00000000-0000-0000-0000-000000000000/lobby');
    await page.waitForURL(/\/teacher\/login/, { timeout: 5000 });
  });
});

test.describe('Teacher Lobby Page — authenticated', () => {
  test('teacher can access lobby page for waiting session', async ({ browser }) => {
    const teacherContext = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const teacherPage = await teacherContext.newPage();

    await teacherPage.goto('/teacher');
    await teacherPage.waitForLoadState('networkidle');

    const lobbyLink = teacherPage.locator('a[href*="/teacher/sessions/"][href*="/lobby"]').first();
    const count = await lobbyLink.count();
    if (count === 0) {
      await teacherContext.close();
      test.skip();
      return;
    }

    await lobbyLink.click();
    await expect(teacherPage.locator('text=Room Code')).toBeVisible({ timeout: 5000 });

    await teacherContext.close();
  });
});

test.describe('Podium Page', () => {
  test('podium page has Play again button', async ({ browser }) => {
    const teacherContext = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const teacherPage = await teacherContext.newPage();

    await teacherPage.goto('/teacher');
    await teacherPage.waitForLoadState('networkidle');

    const podiumLink = teacherPage.locator('a[href*="/s/"][href*="/podium"]').first();
    const count = await podiumLink.count();
    if (count === 0) {
      await teacherContext.close();
      test.skip();
      return;
    }

    const href = await podiumLink.getAttribute('href').catch(() => null);
    if (!href) {
      await teacherContext.close();
      test.skip();
      return;
    }

    const publicContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const podiumPage = await publicContext.newPage();
    await podiumPage.goto(href);

    await expect(podiumPage.locator('text=Play again')).toBeVisible({ timeout: 8000 });

    await teacherContext.close();
    await publicContext.close();
  });
});

