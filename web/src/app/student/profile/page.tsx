'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Badge } from '@/types/quiz';
import { BADGE_LABELS } from '@/lib/badges';

const BADGE_EMOJI: Record<string, string> = {
  first_play: '🎮',
  first_win: '🏆',
  on_fire: '🔥',
  speed_demon: '⚡',
  sharpshooter: '🎯',
  dedicated: '💪',
};

interface PracticeSummaryItem {
  quizId: string;
  quizTitle: string;
  dueCount: number;
  totalCount: number;
}

interface ProfileData {
  student: { id: string; username: string; displayName: string };
  stats: {
    currentStreak: number;
    longestStreak: number;
    totalGames: number;
    totalCorrect: number;
    totalAnswered: number;
    badges: Badge[];
    consecutivePerfect: number;
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

export default function StudentProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [practice, setPractice] = useState<PracticeSummaryItem[]>([]);

  useEffect(() => {
    fetch('/api/student/profile')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch('/api/student/practice-summary')
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setPractice(d))
      .catch(() => {});
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading…</div>;
  if (!data?.student) return <div className="flex items-center justify-center h-64 text-slate-400">Profile not found.</div>;

  const { student, stats, avgScore, history } = data;

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-bold text-white">
          {student.displayName[0]?.toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{student.displayName}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">@{student.username}</p>
          <p className="text-orange-500 dark:text-orange-400 text-sm mt-0.5">
            🔥 {stats.currentStreak} day streak
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Games played', value: stats.totalGames },
          { label: 'Avg score', value: `${avgScore}%` },
          { label: 'Correct answers', value: `${stats.totalCorrect}/${stats.totalAnswered}` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white dark:bg-slate-900 rounded-xl p-4 text-center border border-slate-200 dark:border-slate-800">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Leaderboard link */}
      <div className="text-right">
        <Link href="/student/leaderboard" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
          View leaderboard →
        </Link>
      </div>

      {/* Badges */}
      {stats.badges.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Badges</h2>
          <div className="flex flex-wrap gap-3">
            {stats.badges.map((b) => (
              <div key={b.id} className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2">
                <span className="text-xl">{BADGE_EMOJI[b.id] ?? '🏅'}</span>
                <span className="text-sm font-medium text-slate-900 dark:text-white">{BADGE_LABELS[b.id] ?? b.id}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Practice section */}
      {practice.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Practice</h2>
          <div className="space-y-2">
            {practice.map((item) => (
              <a
                key={item.quizId}
                href={`/student/practice/${item.quizId}`}
                className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{item.quizTitle}</p>
                  <p className="text-xs text-slate-500">{item.totalCount} questions</p>
                </div>
                <div className="text-right">
                  {item.dueCount > 0 ? (
                    <span className="text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 rounded-full px-2 py-0.5">
                      {item.dueCount} due
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">✓ done</span>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Quiz history */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Recent games</h2>
        {history.length === 0 ? (
          <p className="text-slate-500 text-sm">No games yet. Join a room to start playing!</p>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{h.quizTitle ?? 'Unknown quiz'}</p>
                  <p className="text-xs text-slate-500">{timeAgo(h.completedAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {Math.round((h.score / h.totalQuestions) * 100)}%
                  </p>
                  <p className="text-xs text-slate-500">{h.score}/{h.totalQuestions}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
