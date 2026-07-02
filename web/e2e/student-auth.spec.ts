import { test, expect } from '@playwright/test';

const uniqueSuffix = () => Math.random().toString(36).slice(2, 8);

test('student register → auto sign-in → redirected to profile', async ({ page }) => {
  const suffix = uniqueSuffix();
  const username = `student_${suffix}`;

  await page.goto('/student/register');
  await page.getByPlaceholder('Display name').fill(`Test Student ${suffix}`);
  await page.getByPlaceholder('Username').fill(username);
  await page.getByPlaceholder('6-digit PIN').fill('123456');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/student\/profile/, { timeout: 10000 });
});

test('student login with correct PIN redirects to profile', async ({ page }) => {
  // Register first
  const suffix = uniqueSuffix();
  const username = `student_${suffix}`;
  await fetch(`${process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000'}/api/student/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ display_name: `Login Test ${suffix}`, username, pin: '654321' }),
  });

  await page.goto('/student/login');
  await page.getByPlaceholder('Username').fill(username);
  await page.getByPlaceholder('6-digit PIN').fill('654321');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/student\/profile/, { timeout: 10000 });
});

test('student login with wrong PIN shows error', async ({ page }) => {
  await page.goto('/student/login');
  await page.getByPlaceholder('Username').fill('nobody_here');
  await page.getByPlaceholder('6-digit PIN').fill('000000');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Invalid username or PIN.')).toBeVisible({ timeout: 5000 });
});
