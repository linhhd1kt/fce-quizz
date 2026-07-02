import type { Badge, BadgeId, StudentStats } from '@/types/quiz';

interface AttemptForBadge {
  score: number;
  totalQuestions: number;
  answers: Array<{ timeSpent: number }>;
}

const BADGE_LABELS: Record<BadgeId, string> = {
  first_play: 'First Play',
  first_win: 'First Win',
  on_fire: 'On Fire',
  speed_demon: 'Speed Demon',
  sharpshooter: 'Sharpshooter',
  dedicated: 'Dedicated',
};

export function evaluateBadges(stats: StudentStats, attempt: AttemptForBadge): Badge[] {
  const existing = new Set(stats.badges.map((b) => b.id));
  const earned: Badge[] = [];
  const now = new Date().toISOString();

  function award(id: BadgeId) {
    if (!existing.has(id)) {
      earned.push({ id, earnedAt: now });
    }
  }

  const isPerfect = attempt.score === attempt.totalQuestions;
  const newTotalGames = stats.totalGames + 1;

  if (newTotalGames === 1) award('first_play');
  if (isPerfect && !existing.has('first_win')) award('first_win');
  if (stats.currentStreak >= 7) award('on_fire');
  if (attempt.answers.some((a) => a.timeSpent > 0 && a.timeSpent < 5000)) award('speed_demon');
  if (stats.consecutivePerfect + (isPerfect ? 1 : 0) >= 5) award('sharpshooter');
  if (newTotalGames >= 30) award('dedicated');

  return earned;
}

export { BADGE_LABELS };
