import { describe, it, expect } from 'vitest';
import { evaluateBadges } from './badges';
import type { StudentStats } from '@/types/quiz';

const baseStats: StudentStats = {
  studentId: 'x',
  currentStreak: 0,
  longestStreak: 0,
  totalGames: 0,
  totalCorrect: 0,
  totalAnswered: 0,
  lastPlayedDate: null,
  consecutivePerfect: 0,
  badges: [],
};

const baseAttempt = {
  score: 10,
  totalQuestions: 15,
  answers: [{ timeSpent: 10000 }],
};

describe('evaluateBadges', () => {
  it('awards first_play on first game', () => {
    const badges = evaluateBadges({ ...baseStats, totalGames: 0 }, baseAttempt);
    expect(badges.map((b) => b.id)).toContain('first_play');
  });

  it('does not award first_play again', () => {
    const existing = [{ id: 'first_play' as const, earnedAt: '2026-01-01' }];
    const badges = evaluateBadges({ ...baseStats, totalGames: 0, badges: existing }, baseAttempt);
    expect(badges.map((b) => b.id)).not.toContain('first_play');
  });

  it('awards first_win on perfect score', () => {
    const badges = evaluateBadges(baseStats, { score: 15, totalQuestions: 15, answers: [] });
    expect(badges.map((b) => b.id)).toContain('first_win');
  });

  it('does not award first_win on non-perfect score', () => {
    const badges = evaluateBadges(baseStats, { score: 14, totalQuestions: 15, answers: [] });
    expect(badges.map((b) => b.id)).not.toContain('first_win');
  });

  it('awards on_fire when streak >= 7', () => {
    const badges = evaluateBadges({ ...baseStats, currentStreak: 7 }, baseAttempt);
    expect(badges.map((b) => b.id)).toContain('on_fire');
  });

  it('awards speed_demon when any answer < 5s', () => {
    const badges = evaluateBadges(baseStats, { ...baseAttempt, answers: [{ timeSpent: 4999 }] });
    expect(badges.map((b) => b.id)).toContain('speed_demon');
  });

  it('awards sharpshooter when consecutivePerfect reaches 5 with perfect attempt', () => {
    const badges = evaluateBadges({ ...baseStats, consecutivePerfect: 4 }, { score: 15, totalQuestions: 15, answers: [] });
    expect(badges.map((b) => b.id)).toContain('sharpshooter');
  });

  it('awards dedicated at 30 total games', () => {
    const badges = evaluateBadges({ ...baseStats, totalGames: 29 }, baseAttempt);
    expect(badges.map((b) => b.id)).toContain('dedicated');
  });
});
