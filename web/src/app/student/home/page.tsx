'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { Badge } from '@/types/quiz';

interface ProfileData {
  student: { id: string; username: string; displayName: string };
  stats: {
    currentStreak: number;
    totalGames: number;
    totalCorrect: number;
    totalAnswered: number;
    badges: Badge[];
  };
  avgScore: number;
  history: Array<{ id: string; score: number; totalQuestions: number; completedAt: string; quizTitle: string | null }>;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function AccuracyBar({ score, total }: { score: number; total: number }) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const color = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function StudentHomePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [data, setData] = useState<ProfileData | null>(null);
  const [code, setCode] = useState('');

  const sessionUser = session?.user as { username?: string; displayName?: string } | undefined;
  const displayName = sessionUser?.displayName ?? sessionUser?.username ?? session?.user?.name ?? '';

  useEffect(() => {
    fetch('/api/student/profile')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {});
  }, []);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed) router.push(`/s/${trimmed}`);
  }

  const recent = data?.history.slice(0, 6) ?? [];
  const greeting = data?.student.displayName ?? displayName;

  return (
    <div className="px-6 py-6 max-w-4xl mx-auto space-y-8">
      {/* Header row: join + greeting */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Join a game */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Join a game</p>
          <form onSubmit={handleJoin} className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
              placeholder="Enter game code"
              className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono uppercase tracking-widest"
              maxLength={8}
            />
            <button
              type="submit"
              disabled={!code.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Find
            </button>
          </form>
        </div>

        {/* Greeting */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold text-white shrink-0">
            {greeting[0]?.toUpperCase() ?? 'S'}
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900 dark:text-white">
              Hello, {greeting || 'there'}!
            </p>
            {data && (
              <>
                <p className="text-sm text-orange-500 dark:text-orange-400">
                  🔥 {data.stats.currentStreak} day streak
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {data.stats.totalGames} games · {data.avgScore}% avg
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Recent games */}
      {recent.length > 0 ? (
        <div>
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            Recent games
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recent.map((h) => {
              const pct = h.totalQuestions > 0 ? Math.round((h.score / h.totalQuestions) * 100) : 0;
              const pctColor = pct >= 75
                ? 'text-emerald-600 dark:text-emerald-400'
                : pct >= 50
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-red-600 dark:text-red-400';
              return (
                <div
                  key={h.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2"
                >
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {h.quizTitle ?? 'Unknown quiz'}
                  </p>
                  <AccuracyBar score={h.score} total={h.totalQuestions} />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{timeAgo(h.completedAt)}</span>
                    <span className={`text-xs font-bold ${pctColor}`}>{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : data ? (
        <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          <p className="text-slate-500 text-sm">No games yet. Enter a game code above to start playing!</p>
        </div>
      ) : null}
    </div>
  );
}
