'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const MAX_QUIZZES = 20;

export default function QuizzesPanel() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filter = searchParams.get('filter');
  const [quizCount, setQuizCount] = useState(0);

  useEffect(() => {
    fetch('/api/quizzes')
      .then((r) => r.json())
      .then((d: unknown) => { if (Array.isArray(d)) setQuizCount(d.length); })
      .catch(() => {});
  }, [pathname]);

  const progress = Math.min((quizCount / MAX_QUIZZES) * 100, 100);
  const isRecent = filter === 'recent';

  return (
    <aside className="w-[240px] shrink-0 h-full border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col py-4">
      <p className="px-4 text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Quizzes</p>

      <Link
        href="/teacher/quizzes"
        className={`mx-2 px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
          !isRecent
            ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-medium'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'
        }`}
      >
        <span>✏️</span>
        <span>All <span className="text-slate-400 dark:text-slate-500">({quizCount})</span></span>
      </Link>

      <Link
        href="/teacher/quizzes?filter=recent"
        className={`mx-2 px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
          isRecent
            ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-medium'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'
        }`}
      >
        <span>🕐</span>
        <span>Recently used</span>
      </Link>

      <div className="flex-1" />

      <div className="px-4 space-y-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">{quizCount} / {MAX_QUIZZES} quizzes</p>
        <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </aside>
  );
}
