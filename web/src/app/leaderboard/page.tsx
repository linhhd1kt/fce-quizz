'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { QuizAttempt } from '@/types/quiz';
import { getAllAttempts, clearAllAttempts } from '@/lib/storage';
import { formatTime, getGrade } from '@/lib/scoring';
import { useI18n } from '@/i18n';

export default function LeaderboardPage() {
  const { msgs, i } = useI18n();
  const m = msgs.leaderboard;
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);

  useEffect(() => {
    setAttempts(getAllAttempts());
  }, []);

  function handleClear() {
    if (confirm(m.clearConfirm)) {
      clearAllAttempts();
      setAttempts([]);
    }
  }

  const sorted = [...attempts].sort((a, b) => b.score - a.score || a.totalTimeSpent - b.totalTimeSpent);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-white text-xl">{m.title}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{m.subtitle}</p>
        </div>
        {attempts.length > 0 && (
          <button
            onClick={handleClear}
            className="text-xs text-slate-600 hover:text-red-400 transition-colors"
          >
            {m.clearAll}
          </button>
        )}
      </div>

      {attempts.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <p className="text-4xl">🏆</p>
          <p className="text-slate-500">{m.empty}</p>
          <Link href="/" className="text-blue-400 hover:underline text-sm">{m.startLink}</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((attempt, idx) => {
            const grade = getGrade(attempt.score);
            const correct = attempt.answers.filter((a) => a.correct).length;
            return (
              <div
                key={attempt.id}
                className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-4"
              >
                <span className="w-6 text-center text-slate-600 text-sm font-bold">
                  {i(m.rank, { n: idx + 1 })}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{attempt.quizTitle}</p>
                  <p className="text-slate-500 text-xs">
                    {new Date(attempt.completedAt).toLocaleDateString()} · {formatTime(attempt.totalTimeSpent)} · {i(m.correct, { correct, total: attempt.totalQuestions })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-white font-bold">{attempt.score}%</p>
                  <p className={`text-xs ${grade.color}`}>{grade.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
