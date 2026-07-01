'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { QuizSet } from '@/types/quiz';
import { loadBuiltInQuizSets, loadImportedQuizSets, deleteImportedQuizSet } from '@/lib/quiz-loader';
import { getAttemptsByQuiz } from '@/lib/storage';
import QuizCard from '@/components/QuizCard';
import Link from 'next/link';
import { useI18n } from '@/i18n';

export default function HomePage() {
  const { msgs } = useI18n();
  const m = msgs.home;
  const router = useRouter();
  const [quizSets, setQuizSets] = useState<QuizSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [codeInput, setCodeInput] = useState('');

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

  function handleJoinCode(e: React.FormEvent) {
    e.preventDefault();
    const code = codeInput.trim().toUpperCase();
    if (code) router.push(`/s/${code}`);
  }

  const builtIn = quizSets.filter((q) => !q.id.startsWith('upload-') && !q.id.startsWith('import-'));
  const imported = quizSets.filter((q) => q.id.startsWith('upload-') || q.id.startsWith('import-'));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <div className="text-center py-6 space-y-2">
        <h1 className="text-3xl font-bold text-white">{m.title}</h1>
        <p className="text-slate-400">{m.subtitle}</p>
      </div>

      {/* Join with code */}
      <form onSubmit={handleJoinCode} className="flex gap-2">
        <input
          type="text"
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
          placeholder="Enter room code…"
          maxLength={6}
          className="flex-1 bg-slate-900 border border-slate-700 focus:border-orange-500 rounded-xl px-4 py-3 text-white font-mono text-lg tracking-widest uppercase placeholder-slate-600 outline-none transition-colors text-center"
        />
        <button
          type="submit"
          disabled={codeInput.trim().length < 4}
          className="px-6 py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-bold rounded-xl transition-colors shrink-0"
        >
          Join →
</button>
      </form>

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

        </>
      )}
    </div>
  );
}
