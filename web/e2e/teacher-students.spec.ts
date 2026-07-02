import { test, expect } from '@playwright/test';

test.use({ storageState: 'e2e/.auth/teacher.json' });

test('teacher can add student, see PIN, and delete', async ({ page }) => {
  await page.goto('/teacher/students');

  // Add student
  const suffix = Math.random().toString(36).slice(2, 6);
  await page.getByPlaceholder('Display name').fill(`Test Student ${suffix}`);
  await page.getByRole('button', { name: '+ Add Student' }).click();

  // PIN visible in green
  const pinCell = page.locator('td span.font-mono').first();
  await expect(pinCell).toBeVisible({ timeout: 5000 });
  const pin = await pinCell.textContent();
  expect(pin).toMatch(/^\d{6}$/);

  // Delete the student
  await page.getByRole('button', { name: 'Delete' }).first().click();
  await expect(pinCell).not.toBeVisible({ timeout: 5000 });
});
