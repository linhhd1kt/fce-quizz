/**
 * E2E tests: Student Quiz Player (/s/[code])
 *
 * All tests use API route mocking — no real DB required.
 *
 * Mock data notes:
 *  - answer values are the OPTION TEXT strings (not indices), matching MultipleChoiceQuestion.answer: string
 *  - API response shape mirrors the actual by-code route: { id, code, isActive, quizzes: QuizRow }
 *  - time_per_question: 30 keeps the auto-submit test practical with page.clock
 *
 * Button accessible-name quirk:
 *  Each tile button renders two spans: a numbered badge (idx+1) and the option text.
 *  Playwright's getByRole name matching is a substring match (case-insensitive).
 *  For options that might collide with badges (e.g., "4" appears as badge on the last tile),
 *  we use .first() to reliably select the first matching button in DOM order.
 */

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockSession = {
  id: 'session-test-1',
  code: 'TST001',
  isActive: true,
  questionsSubset: null,
  batchId: null,
  batchOrder: null,
  quizzes: {
    id: 'quiz-test-1',
    teacher_id: 'teacher-test-1',
    title: 'E2E Test Quiz',
    description: null,
    source: null,
    time_per_question: 30,
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice',
        text: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        answer: '4',
      },
      {
        id: 'q2',
        type: 'multiple-choice',
        text: 'What color is the sky?',
        options: ['Red', 'Green', 'Blue', 'Yellow'],
        answer: 'Blue',
      },
      {
        id: 'q3',
        type: 'multiple-choice',
        text: 'What is 3x3?',
        options: ['6', '7', '8', '9'],
        answer: '9',
      },
    ],
    skipped_sections: null,
    created_at: '2026-01-01T00:00:00.000Z',
  },
};

const mockAttemptResponse = {
  id: 'attempt-1',
  session_id: 'session-test-1',
  quiz_id: 'quiz-test-1',
  student_name: 'Alice',
  score: 2,
  total_questions: 3,
  time_spent_ms: 10000,
  answers: [],
  completed_at: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Install route mocks for TST001 session and attempts.
 * Must be called before page.goto().
 */
async function setupSessionMocks(page: import('@playwright/test').Page) {
  await page.route('**/api/sessions/by-code/TST001', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockSession),
    });
  });

  await page.route('**/api/attempts**', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(mockAttemptResponse),
      });
    } else {
      await route.continue();
    }
  });
}

/**
 * Join the quiz as the given student name.
 * Assumes page is already on /s/TST001 and quiz has loaded (join form visible).
 */
async function joinAsStudent(
  page: import('@playwright/test').Page,
  name = 'Alice',
) {
  await page.getByPlaceholder('Enter your name…').fill(name);
  await page.getByRole('button', { name: 'Join →' }).click();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Student Quiz Player (/s/[code])', () => {
  // ── Test 1: Join screen ──────────────────────────────────────────────────
  test('1. join screen shows quiz title, room code and name input', async ({
    page,
  }) => {
    await setupSessionMocks(page);
    await page.goto('/s/TST001');

    // Room code badge
    await expect(page.getByText('TST001', { exact: false })).toBeVisible();

    // Quiz title
    await expect(page.getByText('E2E Test Quiz')).toBeVisible();

    // Question count meta (e.g. "3 questions")
    await expect(page.getByText(/3 questions/)).toBeVisible();

    // Name input and Join button
    await expect(page.getByPlaceholder('Enter your name…')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join →' })).toBeVisible();
  });

  // ── Test 2: Join → countdown ─────────────────────────────────────────────
  test('2. joining starts countdown 3 → 2 → 1', async ({ page }) => {
    // Install fake clock BEFORE navigation so setInterval calls are controlled
    await page.clock.install();
    await setupSessionMocks(page);
    await page.goto('/s/TST001');

    await joinAsStudent(page);

    // Countdown starts at 3
    await expect(page.getByText('3', { exact: true })).toBeVisible();

    // Advance 1 second → shows 2
    await page.clock.fastForward(1000);
    await expect(page.getByText('2', { exact: true })).toBeVisible();

    // Advance another second → shows 1
    await page.clock.fastForward(1000);
    await expect(page.getByText('1', { exact: true })).toBeVisible();
  });

  // ── Test 3: Countdown → first question ──────────────────────────────────
  test('3. after countdown completes, first question and 4 tiles are shown', async ({
    page,
  }) => {
    await page.clock.install();
    await setupSessionMocks(page);
    await page.goto('/s/TST001');

    await joinAsStudent(page);

    // Fast-forward through the full 3-second countdown
    await page.clock.fastForward(3000);

    // First question text
    await expect(page.getByText('What is 2+2?')).toBeVisible();

    // Progress indicator
    await expect(page.getByText('1 / 3')).toBeVisible();

    // All 4 answer options rendered as buttons
    // Note: accessible name = "<badge> <option>" e.g. "1 3", "2 4", "3 5", "4 6"
    await expect(page.getByRole('button', { name: '3' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '4' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '5' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '6' }).first()).toBeVisible();
  });

  // ── Test 4: Correct answer shows feedback ───────────────────────────────
  test('4. selecting the correct answer shows "Correct!" feedback', async ({
    page,
  }) => {
    await page.clock.install();
    await setupSessionMocks(page);
    await page.goto('/s/TST001');

    await joinAsStudent(page);
    await page.clock.fastForward(3000); // complete countdown

    await expect(page.getByText('What is 2+2?')).toBeVisible();

    // Click "4" — the correct answer for q1.
    // Tile accessible names: "1 3", "2 4" (correct), "3 5", "4 6".
    // getByRole name is a substring match, so "4" matches "2 4" and "4 6".
    // first() reliably selects "2 4" (the correct option).
    await page.getByRole('button', { name: '4' }).first().click();

    await expect(page.getByText('🎉 Correct!')).toBeVisible();
  });

  // ── Test 4b: Wrong answer shows feedback ────────────────────────────────
  test('4b. selecting the wrong answer shows "Wrong" feedback with correct answer', async ({
    page,
  }) => {
    await page.clock.install();
    await setupSessionMocks(page);
    await page.goto('/s/TST001');

    await joinAsStudent(page);
    await page.clock.fastForward(3000); // complete countdown

    await expect(page.getByText('What is 2+2?')).toBeVisible();

    // Click "3" — wrong answer for q1 (correct is "4").
    // Tile accessible names: "1 3" (wrong), "2 4" (correct), "3 5", "4 6".
    // first() selects "1 3" (option text "3").
    await page.getByRole('button', { name: '3' }).first().click();

    await expect(page.getByText('😔 Wrong — Answer: 4')).toBeVisible();
  });

  // ── Test 5: Timer auto-submit ────────────────────────────────────────────
  // Uses time_per_question:1 so startPlay() sets timeLeft=1; only 1 tick needed.
  test('5. timer auto-submits when it reaches 0 and shows Time\'s up! feedback', async ({
    page,
  }) => {
    await page.clock.install();

    // 1s/question: startPlay() sets timeLeft=1 so a single 1000ms tick expires it
    const fastTimerSession = {
      ...mockSession,
      quizzes: { ...mockSession.quizzes, time_per_question: 1 },
    };
    await page.route('**/api/sessions/by-code/TST001', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fastTimerSession),
      });
    });
    await page.route('**/api/attempts**', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(mockAttemptResponse),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/s/TST001');
    await joinAsStudent(page);

    await page.clock.fastForward(3000); // countdown → playing
    await expect(page.getByText('What is 2+2?')).toBeVisible();

    // timeLeft=1; one 1000ms tick sets timeLeft=0 → submitAnswer(null)
    await page.clock.fastForward(1000);

    await expect(page.getByText(/Time's up!/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Next →' })).toBeVisible();
  });

  // ── Test 6: Next button advances to next question ────────────────────────
  test('6. clicking Next → after feedback shows the next question', async ({
    page,
  }) => {
    await page.clock.install();
    await setupSessionMocks(page);
    await page.goto('/s/TST001');

    await joinAsStudent(page);
    await page.clock.fastForward(3000); // countdown → playing

    await expect(page.getByText('What is 2+2?')).toBeVisible();

    // Answer q1 correctly
    await page.getByRole('button', { name: '4' }).first().click();
    await expect(page.getByText('🎉 Correct!')).toBeVisible();

    // Click Next
    await page.getByRole('button', { name: 'Next →' }).click();

    // Q2 should now be visible
    await expect(page.getByText('What color is the sky?')).toBeVisible();

    // q2 options are unambiguous words — no badge conflict
    await expect(page.getByRole('button', { name: 'Blue' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Red' })).toBeVisible();
  });

  // ── Test 8: Finish screen ────────────────────────────────────────────────
  test('8. completing all questions shows finish screen with student name and score', async ({
    page,
  }) => {
    await page.clock.install();
    await setupSessionMocks(page);
    await page.goto('/s/TST001');

    await joinAsStudent(page);
    await page.clock.fastForward(3000); // countdown → playing

    // Answer q1 correctly ("4") and advance
    await expect(page.getByText('What is 2+2?')).toBeVisible();
    await page.getByRole('button', { name: '4' }).first().click();
    await page.getByRole('button', { name: 'Next →' }).click();

    // Answer q2 correctly ("Blue") and advance
    await expect(page.getByText('What color is the sky?')).toBeVisible();
    await page.getByRole('button', { name: 'Blue' }).click();
    await page.getByRole('button', { name: 'Next →' }).click();

    // Answer q3 correctly ("9") then click Finish
    await expect(page.getByText('What is 3x3?')).toBeVisible();
    await page.getByRole('button', { name: '9' }).first().click();
    await page.getByRole('button', { name: 'Finish 🎉' }).click();

    // Finish screen shows "Completed!" and student name + score
    await expect(page.getByText('Completed!')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Alice · \d+%/)).toBeVisible();
  });

  // ── Test 7: Invalid room code ────────────────────────────────────────────
  test('7. invalid room code shows "Room not found or closed." error', async ({
    page,
  }) => {
    await page.route('**/api/sessions/by-code/BADCODE', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not found' }),
      });
    });

    await page.goto('/s/BADCODE');

    await expect(page.getByText('Room not found or closed.')).toBeVisible();
    // Error page link — "← Home" (distinct from nav Home link)
    await expect(page.getByRole('link', { name: '← Home' })).toBeVisible();
  });
});
