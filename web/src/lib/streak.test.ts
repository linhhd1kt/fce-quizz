import { describe, it, expect } from 'vitest';
import { updateStreak } from './streak';
import type { StudentStats } from '@/types/quiz';

const baseStats: StudentStats = {
  studentId: 'x',
  currentStreak: 3,
  longestStreak: 5,
  totalGames: 10,
  totalCorrect: 80,
  totalAnswered: 100,
  lastPlayedDate: null,
  consecutivePerfect: 0,
  badges: [],
};

function stats(overrides: Partial<StudentStats> = {}): StudentStats {
  return { ...baseStats, ...overrides };
}

const day = (s: string) => new Date(s + 'T12:00:00Z');

describe('updateStreak', () => {
  it('increments streak when last played yesterday', () => {
    const result = updateStreak(stats({ lastPlayedDate: '2026-07-01', currentStreak: 3, longestStreak: 5 }), day('2026-07-02'));
    expect(result.currentStreak).toBe(4);
    expect(result.longestStreak).toBe(5);
    expect(result.lastPlayedDate).toBe('2026-07-02');
  });

  it('does not change streak when already played today', () => {
    const result = updateStreak(stats({ lastPlayedDate: '2026-07-02', currentStreak: 3 }), day('2026-07-02'));
    expect(result).toEqual({});
  });

  it('resets streak to 1 when gap >= 2 days', () => {
    const result = updateStreak(stats({ lastPlayedDate: '2026-06-29', currentStreak: 10, longestStreak: 10 }), day('2026-07-02'));
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(10);
  });

  it('sets streak to 1 and updates longest on first play', () => {
    const result = updateStreak(stats({ lastPlayedDate: null, currentStreak: 0, longestStreak: 0 }), day('2026-07-02'));
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
    expect(result.lastPlayedDate).toBe('2026-07-02');
  });

  it('updates longestStreak when new streak exceeds it', () => {
    const result = updateStreak(stats({ lastPlayedDate: '2026-07-01', currentStreak: 5, longestStreak: 5 }), day('2026-07-02'));
    expect(result.currentStreak).toBe(6);
    expect(result.longestStreak).toBe(6);
  });
});
