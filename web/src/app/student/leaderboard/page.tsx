'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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
    <div className="min-h-screen bg-slate-950 text-white px-6 py-10">
      <div className="max-w-lg mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">🏆 Bảng xếp hạng</h1>
          <Link href="/student/profile" className="text-sm text-slate-400 hover:text-white transition-colors">
            ← Trang cá nhân
          </Link>
        </div>

        {loading ? (
          <p className="text-slate-400 text-center py-12">Đang tải…</p>
        ) : entries.length === 0 ? (
          <p className="text-slate-500 text-center py-12">Chưa có dữ liệu.</p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.rank}
                className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3"
              >
                <span className="text-2xl w-8 text-center flex-shrink-0">
                  {RANK_BADGE[entry.rank] ?? entry.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{entry.displayName}</p>
                  <p className="text-xs text-slate-500">{entry.totalGames} games</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-white">{entry.totalCorrect}</p>
                  <p className="text-xs text-slate-500">câu đúng</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
