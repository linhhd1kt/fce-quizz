import type { UserAnswer } from '@/types/quiz';

export function calculateScore(answers: UserAnswer[]): number {
  if (answers.length === 0) return 0;
  const correct = answers.filter((a) => a.correct).length;
  return Math.round((correct / answers.length) * 100);
}

export function calculateTimeBonus(timeSpentMs: number, timeLimitMs: number): number {
  if (timeSpentMs >= timeLimitMs) return 0;
  return Math.round(((timeLimitMs - timeSpentMs) / timeLimitMs) * 10);
}

export function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
}

export function getGrade(score: number): { label: string; color: string } {
  if (score >= 90) return { label: 'Excellent', color: 'text-emerald-400' };
  if (score >= 75) return { label: 'Good', color: 'text-blue-400' };
  if (score >= 60) return { label: 'Pass', color: 'text-yellow-400' };
  return { label: 'Keep Practising', color: 'text-red-400' };
}
