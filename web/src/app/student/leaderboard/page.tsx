'use client';

import { useEffect, useState } from 'react';

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  totalCorrect: number;
  totalGames: number;
}

const RANK_BADGE: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/student/leaderboard')
      .then((r) => r.json())
      .then((d) => { setEntries(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="px-6 py-6 max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">🏆 Scores</h1>

      {loading ? (
        <p className="text-slate-400 text-center py-12">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-slate-500 text-center py-12">No data yet.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.rank}
              className="flex items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3"
            >
              <span className="text-2xl w-8 text-center flex-shrink-0">
                {RANK_BADGE[entry.rank] ?? entry.rank}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate text-slate-900 dark:text-white">{entry.displayName}</p>
                <p className="text-xs text-slate-500">{entry.totalGames} games</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-lg font-bold text-slate-900 dark:text-white">{entry.totalCorrect}</p>
                <p className="text-xs text-slate-500">correct</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
