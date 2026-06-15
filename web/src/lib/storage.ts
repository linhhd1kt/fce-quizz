import type { QuizAttempt } from '@/types/quiz';

const ATTEMPTS_KEY = 'fce_attempts';

export function saveAttempt(attempt: QuizAttempt): void {
  const all = getAllAttempts();
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify([attempt, ...all]));
}

export function getAllAttempts(): QuizAttempt[] {
  try {
    const raw = localStorage.getItem(ATTEMPTS_KEY);
    return raw ? (JSON.parse(raw) as QuizAttempt[]) : [];
  } catch {
    return [];
  }
}

export function getAttemptsByQuiz(quizId: string): QuizAttempt[] {
  return getAllAttempts().filter((a) => a.quizId === quizId);
}

export function clearAllAttempts(): void {
  localStorage.removeItem(ATTEMPTS_KEY);
}
