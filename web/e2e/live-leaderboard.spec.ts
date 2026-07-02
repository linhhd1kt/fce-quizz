import { test, expect } from '@playwright/test';

test.describe('Live Leaderboard', () => {
  test('unauthenticated user is redirected from live view', async ({ page }) => {
    await page.goto('/teacher/sessions/00000000-0000-0000-0000-000000000000/live');
    await page.waitForURL(/\/teacher\/login/, { timeout: 5000 });
  });

  test('teacher can access live view page', async ({ browser }) => {
    const teacherContext = await browser.newContext({ storageState: 'e2e/.auth/teacher.json' });
    const teacherPage = await teacherContext.newPage();

    await teacherPage.goto('/teacher');
    await teacherPage.waitForLoadState('networkidle');

    const firstSessionLink = teacherPage.locator('a[href*="/teacher/sessions/"]').first();
    const href = await firstSessionLink.getAttribute('href').catch(() => null);

    if (!href) {
      await teacherContext.close();
      test.skip();
      return;
    }

    const sessionId = href.split('/teacher/sessions/')[1]?.split('/')[0];
    await teacherPage.goto(`/teacher/sessions/${sessionId}/live`);

    await expect(
      teacherPage.locator('text=Waiting for students').or(teacherPage.locator('text=playing'))
    ).toBeVisible({ timeout: 8000 });

    await teacherContext.close();
  });

  test('live view link exists on session detail page', async ({ browser }) => {
    const teacherContext = await browser.newContext({ storageState: 'e2e/.auth/teacher.json' });
    const teacherPage = await teacherContext.newPage();

    await teacherPage.goto('/teacher');
    await teacherPage.waitForLoadState('networkidle');

    const firstSessionLink = teacherPage.locator('a[href*="/teacher/sessions/"]').first();
    const href = await firstSessionLink.getAttribute('href').catch(() => null);

    if (!href) {
      await teacherContext.close();
      test.skip();
      return;
    }

    await teacherPage.goto(href as string);
    await expect(teacherPage.locator('text=Live View')).toBeVisible({ timeout: 5000 });

    await teacherContext.close();
  });
});
