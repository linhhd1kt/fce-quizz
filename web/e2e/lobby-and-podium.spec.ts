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
