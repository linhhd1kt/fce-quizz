import { describe, it, expect } from 'vitest';
import { sm2 } from './sm2';

describe('sm2', () => {
  it('first correct answer: interval = 1 day, repetitions = 1', () => {
    const result = sm2({ repetitions: 0, easeFactor: 2.5 }, true);
    expect(result.intervalDays).toBe(1);
    expect(result.newRepetitions).toBe(1);
    expect(result.newEaseFactor).toBeCloseTo(2.5, 5);
    expect(result.nextReviewAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('second correct answer: interval = 6 days, repetitions = 2', () => {
    const result = sm2({ repetitions: 1, easeFactor: 2.5 }, true);
    expect(result.intervalDays).toBe(6);
    expect(result.newRepetitions).toBe(2);
  });

  it('third correct answer: interval = round(6 * ef), repetitions = 3', () => {
    const result = sm2({ repetitions: 2, easeFactor: 2.5 }, true);
    expect(result.intervalDays).toBe(15); // round(6 * 2.5)
    expect(result.newRepetitions).toBe(3);
  });

  it('fourth correct answer: interval = round(6 * ef^2)', () => {
    const result = sm2({ repetitions: 3, easeFactor: 2.5 }, true);
    expect(result.intervalDays).toBe(38); // round(6 * 2.5^2) = round(37.5)
    expect(result.newRepetitions).toBe(4);
  });

  it('wrong answer: interval = 1 day, repetitions reset to 0', () => {
    const result = sm2({ repetitions: 5, easeFactor: 2.5 }, false);
    expect(result.intervalDays).toBe(1);
    expect(result.newRepetitions).toBe(0);
  });

  it('wrong answer: ease factor decreases by ~0.54', () => {
    const result = sm2({ repetitions: 3, easeFactor: 2.5 }, false);
    expect(result.newEaseFactor).toBeCloseTo(1.96, 1);
  });

  it('ease factor floor is 1.3', () => {
    const result = sm2({ repetitions: 0, easeFactor: 1.3 }, false);
    expect(result.newEaseFactor).toBeCloseTo(1.3, 5);
  });

  it('nextReviewAt is approximately interval days in the future', () => {
    const before = Date.now();
    const result = sm2({ repetitions: 0, easeFactor: 2.5 }, true);
    const after = Date.now();
    const expectedMs = 1 * 24 * 60 * 60 * 1000;
    expect(result.nextReviewAt.getTime()).toBeGreaterThanOrEqual(before + expectedMs - 1000);
    expect(result.nextReviewAt.getTime()).toBeLessThanOrEqual(after + expectedMs + 1000);
  });
});
