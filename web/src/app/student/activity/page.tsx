'use client';

import { useEffect, useState } from 'react';
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

function AccuracyBar({ score, total }: { score: number; total: number }) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const color = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold w-8 text-right shrink-0 ${
        pct >= 75 ? 'text-emerald-600 dark:text-emerald-400' : pct >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
      }`}>{pct}%</span>
    </div>
  );
}

export default function StudentActivityPage() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [practice, setPractice] = useState<PracticeSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/student/profile').then((r) => r.json()),
      fetch('/api/student/practice-summary').then((r) => r.json()).catch(() => []),
    ]).then(([profileData, practiceData]) => {
      setData(profileData);
      if (Array.isArray(practiceData)) setPractice(practiceData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading…</div>;

  const history = data?.history ?? [];
  const stats = data?.stats;

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto space-y-8">

      {/* Badges */}
      {stats && stats.badges.length > 0 && (
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

      {/* Practice */}
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

      {/* Stats */}
      {stats && (
        <div>
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Stats</h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Games played', value: stats.totalGames },
              { label: 'Avg score', value: `${data?.avgScore ?? 0}%` },
              { label: 'Correct answers', value: `${stats.totalCorrect}/${stats.totalAnswered}` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white dark:bg-slate-900 rounded-xl p-4 text-center border border-slate-200 dark:border-slate-800">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All games */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">All games</h2>
        {history.length === 0 ? (
          <p className="text-slate-500 text-sm">No games yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{h.quizTitle ?? 'Unknown quiz'}</p>
                  <p className="text-xs text-slate-500 shrink-0 ml-2">{timeAgo(h.completedAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <AccuracyBar score={h.score} total={h.totalQuestions} />
                  <span className="text-xs text-slate-400 shrink-0">{h.score}/{h.totalQuestions}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
