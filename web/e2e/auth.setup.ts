import { test as setup } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const authFile = path.join(__dirname, '.auth/user.json');

setup('authenticate as teacher', async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error('Set E2E_EMAIL and E2E_PASSWORD env vars before running E2E tests');
  }

  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  await page.goto('/teacher/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('/teacher', { timeout: 15_000 });
  await page.context().storageState({ path: authFile });
});
