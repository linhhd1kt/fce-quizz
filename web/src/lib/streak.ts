import type { StudentStats } from '@/types/quiz';

export function updateStreak(stats: StudentStats, today: Date): Partial<StudentStats> {
  const todayStr = today.toISOString().slice(0, 10);

  if (!stats.lastPlayedDate) {
    // First play ever
    const newStreak = 1;
    return {
      currentStreak: newStreak,
      longestStreak: Math.max(newStreak, stats.longestStreak),
      lastPlayedDate: todayStr,
    };
  }

  const last = new Date(stats.lastPlayedDate + 'T00:00:00Z');
  const todayUtc = new Date(todayStr + 'T00:00:00Z');
  const diffDays = Math.round((todayUtc.getTime() - last.getTime()) / 86400000);

  if (diffDays === 0) {
    // Already played today — no change
    return {};
  }

  let newStreak: number;
  if (diffDays === 1) {
    newStreak = stats.currentStreak + 1;
  } else {
    newStreak = 1;
  }

  return {
    currentStreak: newStreak,
    longestStreak: Math.max(newStreak, stats.longestStreak),
    lastPlayedDate: todayStr,
  };
}
