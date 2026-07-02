import { test, expect } from '@playwright/test';

test('unauthenticated /student/profile redirects to /student/login', async ({ page }) => {
  await page.goto('/student/profile');
  await expect(page).toHaveURL(/\/student\/login/);
});

test('unauthenticated /student/profile subdirectory redirects to /student/login', async ({ page }) => {
  await page.goto('/student/profile/settings');
  await expect(page).toHaveURL(/\/student\/login/);
});

test('/student/login and /student/register are publicly accessible', async ({ page }) => {
  await page.goto('/student/login');
  await expect(page).not.toHaveURL(/\/teacher/);

  await page.goto('/student/register');
  await expect(page).not.toHaveURL(/\/teacher/);
});
