'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { QuizAttempt } from '@/types/quiz';
import { getAllAttempts } from '@/lib/storage';
import { formatTime, getGrade } from '@/lib/scoring';
import { useI18n } from '@/i18n';

export default function ResultsClient() {
  const { msgs, i } = useI18n();
  const m = msgs.results;
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const attemptId = searchParams.get('attemptId');
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);

  useEffect(() => {
    const all = getAllAttempts();
    const found = attemptId ? all.find((a) => a.id === attemptId) : all.find((a) => a.quizId === id);
    if (found) setAttempt(found);
  }, [id, attemptId]);

  if (!attempt) return <div className="text-center py-20 text-slate-500">{m.loading}</div>;

  const correct = attempt.answers.filter((a) => a.correct).length;
  const grade = getGrade(attempt.score);

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
        <p className="text-slate-400 text-sm">{m.yourScore}</p>
        <div className="text-7xl font-bold text-white">{attempt.score}%</div>
        <p className={`text-lg font-semibold ${grade.color}`}>{grade.label}</p>
        <div className="flex justify-center gap-6 text-sm text-slate-500 pt-2">
          <span>{i(m.correct, { correct, total: attempt.totalQuestions })}</span>
          <span>{i(m.time, { time: formatTime(attempt.totalTimeSpent) })}</span>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">{m.review}</h2>
        {attempt.answers.map((a, idx) => (
          <div key={a.questionId} className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${a.correct ? 'bg-emerald-950/50 border-emerald-900 text-emerald-300' : 'bg-red-950/50 border-red-900 text-red-300'}`}>
            <span className="font-bold w-6 text-center">{idx + 1}</span>
            <span className="flex-1">
              {a.correct ? m.correctAnswer : i(m.wrongAnswer, { answer: a.selected || m.noAnswer })}
            </span>
            <span className="text-slate-500 text-xs">{formatTime(a.timeSpent)}</span>
          </div>
        ))}
      </section>

      <div className="flex gap-3">
        <Link href={`/quiz/${id}`} className="flex-1 text-center px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-colors">{m.tryAgain}</Link>
        <Link href="/" className="flex-1 text-center px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-sm transition-colors">{m.home}</Link>
      </div>
    </div>
  );
}
