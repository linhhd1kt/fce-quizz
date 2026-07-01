import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_EXTRACT_RESPONSE = {
  id: 'upload-123',
  title: 'Test Quiz — 30 Questions',
  description: 'AI-extracted from test.pdf',
  source: 'test.pdf',
  totalQuestions: 30,
  questions: Array.from({ length: 30 }, (_, i) => ({
    id: `q${String(i + 1).padStart(2, '0')}`,
    type: 'multiple-choice',
    text: `Q${String(i + 1).padStart(2, '0')}: Which option is correct?`,
    options: [`Option A${i + 1}`, `Option B${i + 1}`, `Option C${i + 1}`, `Option D${i + 1}`],
    answer: `Option A${i + 1}`,
    explanation: i === 0 ? 'Option A is the correct answer.' : undefined,
  })),
};

const MOCK_QUIZ_RESPONSE = { id: 'mock-quiz-id-123', title: 'Test Quiz — 30 Questions' };

const MOCK_BATCH_RESPONSE = {
  batchId: 'batch-001',
  quizTitle: 'Test Quiz — 30 Questions',
  parts: [
    { id: 's1', code: 'ABC123', batchOrder: 1, questionCount: 15 },
    { id: 's2', code: 'DEF456', batchOrder: 2, questionCount: 15 },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function mockExtractAndUpload(
  page: Page,
  response = MOCK_EXTRACT_RESPONSE,
) {
  await page.route('**/api/extract-quiz', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

async function triggerPdfUpload(page: Page) {
  await page
    .locator('input[type="file"][accept=".pdf,application/pdf"]')
    .setInputFiles({
      name: 'test-quiz.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 fake'),
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Save & Create Batch (/teacher/quizzes/new)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/teacher/quizzes/new');
    await page.waitForLoadState('networkidle');
  });

  test('default targetGames = ceil(30/15) = 2 after upload', async ({ page }) => {
    await mockExtractAndUpload(page);
    await triggerPdfUpload(page);

    await expect(page.getByText(/Found 30 questions/)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('input[type="number"]')).toHaveValue('2');
    await expect(page.getByRole('button', { name: /Save & create 2 batches/ })).toBeVisible();
  });

  test('changing targetGames to 4 updates button label to "Save & create 4 batches →"', async ({ page }) => {
    await mockExtractAndUpload(page);
    await triggerPdfUpload(page);

    await expect(page.getByText(/Found 30 questions/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Save & create 2 batches/ })).toBeVisible();

    await page.locator('input[type="number"]').fill('4');
    await page.locator('input[type="number"]').press('Tab');

    await expect(page.getByRole('button', { name: /Save & create 4 batches/ })).toBeVisible();
  });

  test('clicking button calls both API endpoints in order', async ({ page }) => {
    const callOrder: string[] = [];

    await mockExtractAndUpload(page);
    await page.route('**/api/quizzes', async (route) => {
      if (route.request().method() === 'POST') {
        callOrder.push('quizzes');
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(MOCK_QUIZ_RESPONSE) });
      } else { await route.continue(); }
    });
    await page.route('**/api/sessions/batch', async (route) => {
      callOrder.push('batch');
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(MOCK_BATCH_RESPONSE) });
    });

    await triggerPdfUpload(page);
    await expect(page.getByText(/Found 30 questions/)).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /Save & create 2 batches/ }).click();
    await expect(page.getByText(/Created 2 games from 30 questions/)).toBeVisible({ timeout: 10_000 });

    expect(callOrder).toEqual(['quizzes', 'batch']);
  });

  test('success result shows "✓ Created N games from X questions", room codes, and dashboard link', async ({ page }) => {
    await mockExtractAndUpload(page);
    await page.route('**/api/quizzes', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(MOCK_QUIZ_RESPONSE) });
      } else { await route.continue(); }
    });
    await page.route('**/api/sessions/batch', async (route) => {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(MOCK_BATCH_RESPONSE) });
    });

    await triggerPdfUpload(page);
    await expect(page.getByText(/Found 30 questions/)).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /Save & create 2 batches/ }).click();

    await expect(page.getByText(/Created 2 games from 30 questions/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('ABC123')).toBeVisible();
    await expect(page.getByText('DEF456')).toBeVisible();
    await expect(page.getByRole('link', { name: '← Back to dashboard' })).toBeVisible();
  });

  test('button is disabled and shows "Saving…" while API call is pending', async ({ page }) => {
    let resolveQuiz!: () => void;
    const quizHold = new Promise<void>((res) => { resolveQuiz = res; });

    await mockExtractAndUpload(page);
    await page.route('**/api/quizzes', async (route) => {
      if (route.request().method() === 'POST') {
        await quizHold;
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(MOCK_QUIZ_RESPONSE) });
      } else { await route.continue(); }
    });
    await page.route('**/api/sessions/batch', async (route) => {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(MOCK_BATCH_RESPONSE) });
    });

    await triggerPdfUpload(page);
    await expect(page.getByText(/Found 30 questions/)).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /Save & create 2 batches/ }).click();

    await expect(page.getByRole('button', { name: /Saving/ })).toBeDisabled({ timeout: 5_000 });
    await expect(page.locator('input[type="number"]')).toBeDisabled();

    resolveQuiz();
    await expect(page.getByText(/Created 2 games from 30 questions/)).toBeVisible({ timeout: 10_000 });
  });

  test('batch API receives quizId from save response and current targetGames', async ({ page }) => {
    let batchRequestBody: { quizId?: string; targetGames?: number } = {};

    await mockExtractAndUpload(page);
    await page.route('**/api/quizzes', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(MOCK_QUIZ_RESPONSE) });
      } else { await route.continue(); }
    });
    await page.route('**/api/sessions/batch', async (route) => {
      batchRequestBody = route.request().postDataJSON() ?? {};
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(MOCK_BATCH_RESPONSE) });
    });

    await triggerPdfUpload(page);
    await expect(page.getByText(/Found 30 questions/)).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /Save & create 2 batches/ }).click();
    await expect(page.getByText(/Created 2 games from 30 questions/)).toBeVisible({ timeout: 10_000 });

    expect(batchRequestBody.quizId).toBe('mock-quiz-id-123');
    expect(batchRequestBody.targetGames).toBe(2);
  });

  test('copy button copies room code to clipboard and shows "Copied!" feedback', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await mockExtractAndUpload(page);
    await page.route('**/api/quizzes', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(MOCK_QUIZ_RESPONSE) });
      } else { await route.continue(); }
    });
    await page.route('**/api/sessions/batch', async (route) => {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(MOCK_BATCH_RESPONSE) });
    });

    await triggerPdfUpload(page);
    await expect(page.getByText(/Found 30 questions/)).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /Save & create 2 batches/ }).click();
    await expect(page.getByText(/Created 2 games from 30 questions/)).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Copy' }).first().click();
    await expect(page.getByRole('button', { name: 'Copied!' }).first()).toBeVisible({ timeout: 2_000 });

    const clipText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipText).toBe('ABC123');
  });

  // ── Inline editor ──────────────────────────────────────────────────────────

  test('expanding a game chunk shows all questions with edit button', async ({ page }) => {
    await mockExtractAndUpload(page);
    await triggerPdfUpload(page);
    await expect(page.getByText(/Found 30 questions/)).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /Game 1/ }).click();

    await expect(page.getByText('Q01: Which option is correct?')).toBeVisible();
    await expect(page.locator('[data-testid="edit-btn-q01"]')).toBeVisible();
  });

  test('clicking ✎ on a question shows edit inputs for text, options, and explanation', async ({ page }) => {
    await mockExtractAndUpload(page);
    await triggerPdfUpload(page);
    await expect(page.getByText(/Found 30 questions/)).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /Game 1/ }).click();
    await page.locator('[data-testid="edit-btn-q01"]').click();

    await expect(page.locator('[data-testid="question-text-q01"]')).toBeVisible();
    await expect(page.locator('[data-testid="question-text-q01"]')).toHaveValue('Q01: Which option is correct?');
    await expect(page.locator('[data-testid="option-input-q01-0"]')).toBeVisible();
    await expect(page.locator('[data-testid="option-input-q01-0"]')).toHaveValue('Option A1');
    await expect(page.locator('[data-testid="explanation-q01"]')).toBeVisible();
    await expect(page.getByRole('button', { name: '✓ Done' }).first()).toBeVisible();
  });

  test('editing question text and clicking Done shows updated text in read mode', async ({ page }) => {
    await mockExtractAndUpload(page);
    await triggerPdfUpload(page);
    await expect(page.getByText(/Found 30 questions/)).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /Game 1/ }).click();
    await page.locator('[data-testid="edit-btn-q01"]').click();

    await page.locator('[data-testid="question-text-q01"]').fill('Updated question text for Q01');
    await page.getByRole('button', { name: '✓ Done' }).first().click();

    await expect(page.getByText('Updated question text for Q01')).toBeVisible();
    await expect(page.locator('[data-testid="edit-btn-q01"]')).toBeVisible();
  });
});
