export interface SM2Output {
  newRepetitions: number;
  newEaseFactor: number;
  nextReviewAt: Date;
  intervalDays: number;
}

export function sm2(
  stats: { repetitions: number; easeFactor: number },
  isCorrect: boolean
): SM2Output {
  const quality = isCorrect ? 4 : 1;

  const newEaseFactor = Math.max(
    1.3,
    stats.easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
  );

  let intervalDays: number;
  let newRepetitions: number;

  if (!isCorrect) {
    newRepetitions = 0;
    intervalDays = 1;
  } else {
    newRepetitions = stats.repetitions + 1;
    if (stats.repetitions === 0) {
      intervalDays = 1;
    } else if (stats.repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(6 * Math.pow(newEaseFactor, stats.repetitions - 1));
    }
  }

  const nextReviewAt = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000);

  return { newRepetitions, newEaseFactor, nextReviewAt, intervalDays };
}
