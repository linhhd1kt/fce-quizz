'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { QuizSet } from '@/types/quiz';
import { loadBuiltInQuizSets, loadImportedQuizSets } from '@/lib/quiz-loader';
import QuizPlayer from '@/components/QuizPlayer';

export default function QuizPage() {
  const params = useParams();
  const id = params.id as string;
  const [quiz, setQuiz] = useState<QuizSet | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      const builtin = await loadBuiltInQuizSets();
      const imported = loadImportedQuizSets();
      const found = [...builtin, ...imported].find((q) => q.id === id);
      if (found) setQuiz(found);
      else setNotFound(true);
    }
    load();
  }, [id]);

  if (notFound) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-slate-500">Quiz not found.</p>
        <Link href="/" className="text-blue-400 hover:underline text-sm">← Back to home</Link>
      </div>
    );
  }

  if (!quiz) {
    return <div className="text-center py-20 text-slate-500">Loading…</div>;
  }

  return <QuizPlayer quiz={quiz} />;
}
