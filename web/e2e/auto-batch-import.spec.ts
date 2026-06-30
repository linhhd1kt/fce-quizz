import { test, expect, Page } from '@playwright/test';
import path from 'path';

const FIXTURE_30Q = path.join(__dirname, 'fixtures/quiz-30q.json');

async function uploadJsonFixture(page: Page, fixturePath: string) {
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByText('Select JSON file').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(fixturePath);
}

test.describe('Auto-Batch on PDF Import', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/teacher/quizzes/new');
    await page.waitForLoadState('networkidle');
  });

  // Spec: targetGames = Math.ceil(totalQuestions / 15)
  // 30 questions → ceil(30/15) = 2
  test('JSON upload auto-calculates targetGames = ceil(30/15) = 2', async ({ page }) => {
    await uploadJsonFixture(page, FIXTURE_30Q);
    await expect(page.getByText(/Found 30 questions/)).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[type="number"]')).toHaveValue('2');
    await expect(page.getByText(/~15 câu\/game/)).toBeVisible();
  });

  // Spec: groups collapsed by default
  test('preview shows N game cards, all collapsed by default', async ({ page }) => {
    await uploadJsonFixture(page, FIXTURE_30Q);
    await expect(page.getByText(/Found 30 questions/)).toBeVisible({ timeout: 5000 });

    await expect(page.getByRole('button', { name: /Game 1/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Game 2/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Game 3/ })).not.toBeVisible();

    // Collapsed — question text must not be visible
    await expect(page.getByText('Q01: Câu hỏi số 1')).not.toBeVisible();
  });

  // Spec: teacher can expand/collapse each game
  test('clicking Game 1 expands and shows its questions', async ({ page }) => {
    await uploadJsonFixture(page, FIXTURE_30Q);
    await expect(page.getByText(/Found 30 questions/)).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /Game 1/ }).click();
    await expect(page.getByText('Q01: Câu hỏi số 1 — chọn đáp án đúng?')).toBeVisible();
    await expect(page.getByText('Q15: Câu hỏi số 15 — chọn đáp án đúng?')).toBeVisible();
    // Game 2 questions still hidden
    await expect(page.getByText('Q16: Câu hỏi số 16 — chọn đáp án đúng?')).not.toBeVisible();
  });

  // Spec: clicking expanded game collapses it
  test('clicking expanded game collapses it', async ({ page }) => {
    await uploadJsonFixture(page, FIXTURE_30Q);
    await expect(page.getByText(/Found 30 questions/)).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /Game 1/ }).click();
    await expect(page.getByText('Q01: Câu hỏi số 1 — chọn đáp án đúng?')).toBeVisible();

    await page.getByRole('button', { name: /Game 1/ }).click();
    await expect(page.getByText('Q01: Câu hỏi số 1 — chọn đáp án đúng?')).not.toBeVisible();
  });

  // Spec: changing targetGames → groups re-render instantly (client-side, no API call)
  test('changing targetGames to 3 updates preview to 3 game cards', async ({ page }) => {
    await uploadJsonFixture(page, FIXTURE_30Q);
    await expect(page.getByText(/Found 30 questions/)).toBeVisible({ timeout: 5000 });

    await page.locator('input[type="number"]').fill('3');
    await page.locator('input[type="number"]').press('Tab');

    await expect(page.getByRole('button', { name: /Game 3/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Game 4/ })).not.toBeVisible();
    await expect(page.getByText(/~10 câu\/game/)).toBeVisible();
  });

  // Spec: client-side re-render (no API call) when targetGames changes — expanded state persists
  test('expanded state persists when targetGames changes', async ({ page }) => {
    await uploadJsonFixture(page, FIXTURE_30Q);
    await expect(page.getByText(/Found 30 questions/)).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /Game 1/ }).click();
    await expect(page.getByText('Q01: Câu hỏi số 1 — chọn đáp án đúng?')).toBeVisible();

    await page.locator('input[type="number"]').fill('3');
    await page.locator('input[type="number"]').press('Tab');

    // expandedGames does not reset on targetGames change — Game 1 still expanded
    await expect(page.getByRole('button', { name: /Game 3/ })).toBeVisible();
    await expect(page.getByText('Q01: Câu hỏi số 1 — chọn đáp án đúng?')).toBeVisible();
  });

  // Spec: single action button "Lưu & Tạo N batch →", shows session codes after save
  test('Save & Create Batch shows session codes inline', async ({ page }) => {
    await page.route('/api/quizzes', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'quiz-e2e', title: 'Test Quiz — 30 Questions' }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route('/api/sessions/batch', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          batchId: 'batch-e2e',
          quizTitle: 'Test Quiz — 30 Questions',
          parts: [
            { id: 's1', code: 'ABC123', batchOrder: 1, questionCount: 15 },
            { id: 's2', code: 'DEF456', batchOrder: 2, questionCount: 15 },
          ],
        }),
      });
    });

    await uploadJsonFixture(page, FIXTURE_30Q);
    await expect(page.getByText(/Found 30 questions/)).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /Lưu & Tạo 2 batch/ }).click();

    await expect(page.getByText(/Đã tạo 2 game/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('ABC123')).toBeVisible();
    await expect(page.getByText('DEF456')).toBeVisible();
    await expect(page.getByText('← Về dashboard')).toBeVisible();
  });

  // Spec: button label uses actual chunk count (not raw targetGames)
  test('button label shows actual chunk count', async ({ page }) => {
    await uploadJsonFixture(page, FIXTURE_30Q);
    await expect(page.getByText(/Found 30 questions/)).toBeVisible({ timeout: 5000 });

    // targetGames=2 auto → button says "Lưu & Tạo 2 batch"
    await expect(page.getByRole('button', { name: /Lưu & Tạo 2 batch/ })).toBeVisible();

    // Change to 4 → button updates to "Lưu & Tạo 4 batch"
    await page.locator('input[type="number"]').fill('4');
    await page.locator('input[type="number"]').press('Tab');
    await expect(page.getByRole('button', { name: /Lưu & Tạo 4 batch/ })).toBeVisible();
  });
});
