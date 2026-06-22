'use client';

import { useEffect, useState } from 'react';
import type { QuizSet } from '@/types/quiz';
import { loadBuiltInQuizSets, loadImportedQuizSets, deleteImportedQuizSet } from '@/lib/quiz-loader';
import { getAttemptsByQuiz } from '@/lib/storage';
import QuizCard from '@/components/QuizCard';
import Link from 'next/link';
import { useI18n } from '@/i18n';

export default function HomePage() {
  const { msgs } = useI18n();
  const m = msgs.home;
  const [quizSets, setQuizSets] = useState<QuizSet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const builtin = await loadBuiltInQuizSets();
      const imported = loadImportedQuizSets();
      setQuizSets([...builtin, ...imported]);
      setLoading(false);
    }
    load();
  }, []);

  function getBestScore(quizId: string): number | undefined {
    const attempts = getAttemptsByQuiz(quizId);
    if (attempts.length === 0) return undefined;
    return Math.max(...attempts.map((a) => a.score));
  }

  function handleDelete(id: string) {
    deleteImportedQuizSet(id);
    setQuizSets((prev) => prev.filter((q) => q.id !== id));
  }

  const builtIn = quizSets.filter((q) => !q.id.startsWith('upload-') && !q.id.startsWith('import-'));
  const imported = quizSets.filter((q) => q.id.startsWith('upload-') || q.id.startsWith('import-'));

  return (
    <div className="space-y-8">
      <div className="text-center py-6 space-y-2">
        <h1 className="text-3xl font-bold text-white">{m.title}</h1>
        <p className="text-slate-400">{m.subtitle}</p>
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-12">{m.loading}</div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              {m.practiceSets}
            </h2>
            {builtIn.map((quiz) => (
              <QuizCard key={quiz.id} quiz={quiz} bestScore={getBestScore(quiz.id)} />
            ))}
          </section>

          {imported.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                {m.importedSets}
              </h2>
              {imported.map((quiz) => (
                <div key={quiz.id} className="relative group">
                  <QuizCard quiz={quiz} bestScore={getBestScore(quiz.id)} />
                  <button
                    onClick={() => handleDelete(quiz.id)}
                    className="absolute top-4 right-24 text-xs text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    {m.remove}
                  </button>
                </div>
              ))}
            </section>
          )}

          <div className="border border-dashed border-slate-700 rounded-2xl p-5 text-center space-y-1">
            <p className="text-slate-500 text-sm">
              {m.hasPdf}{' '}
              <Link href="/upload" className="text-blue-400 hover:underline">
                {m.uploadLink}
              </Link>
            </p>
            <p className="text-slate-600 text-xs">
              {m.or}{' '}
              <Link href="/import" className="hover:underline">
                {m.importLink}
              </Link>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
