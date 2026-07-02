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

  useEffect(() => {
    fetch('/api/student/profile')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading…</div>;
  if (!data?.student) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Profile not found.</div>;

  const { student, stats, avgScore, history } = data;

  return (
    <div className="min-h-screen bg-slate-950 text-white px-6 py-10">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-bold">
            {student.displayName[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{student.displayName}</h1>
            <p className="text-slate-400 text-sm">@{student.username}</p>
            <p className="text-orange-400 text-sm mt-0.5">
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
            <div key={label} className="bg-slate-900 rounded-xl p-4 text-center border border-slate-800">
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-slate-400 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Badges */}
        {stats.badges.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Badges</h2>
            <div className="flex flex-wrap gap-3">
              {stats.badges.map((b) => (
                <div key={b.id} className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2">
                  <span className="text-xl">{BADGE_EMOJI[b.id] ?? '🏅'}</span>
                  <span className="text-sm font-medium">{BADGE_LABELS[b.id] ?? b.id}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quiz history */}
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Recent games</h2>
          {history.length === 0 ? (
            <p className="text-slate-600 text-sm">No games yet. Join a room to start playing!</p>
          ) : (
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{h.quizTitle ?? 'Unknown quiz'}</p>
                    <p className="text-xs text-slate-500">{timeAgo(h.completedAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">
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
    </div>
  );
}
