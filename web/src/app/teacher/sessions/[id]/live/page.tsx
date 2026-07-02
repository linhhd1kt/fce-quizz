'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface LeaderboardEntry {
  rank: number;
  studentName: string;
  score: number;
  currentQuestion: number;
  totalQuestions: number;
  isFinished: boolean;
}

interface LiveData {
  entries: LeaderboardEntry[];
  playing: number;
  finished: number;
  quizTitle: string | null;
}

const RANK_BADGE: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
const RANK_BORDER: Record<number, string> = {
  1: 'border-yellow-500',
  2: 'border-slate-400',
  3: 'border-amber-700',
};

export default function LiveLeaderboardPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<LiveData | null>(null);
  const prevRanksRef = useRef<Record<string, number>>({});
  const [flashing, setFlashing] = useState<Set<string>>(new Set());

  useEffect(() => {
    const source = new EventSource(`/api/sessions/${id}/live`);
    source.onmessage = (e) => {
      const next: LiveData = JSON.parse(e.data);
      setData((prev) => {
        const newFlashing = new Set<string>();
        if (prev) {
          const prevRanks = prevRanksRef.current;
          next.entries.forEach((entry) => {
            const prevRank = prevRanks[entry.studentName];
            if (prevRank !== undefined && prevRank !== entry.rank) {
              newFlashing.add(entry.studentName);
            }
          });
        }
        prevRanksRef.current = Object.fromEntries(
          next.entries.map((e) => [e.studentName, e.rank])
        );
        if (newFlashing.size > 0) {
          setFlashing(newFlashing);
          setTimeout(() => setFlashing(new Set()), 800);
        }
        return next;
      });
    };
    return () => source.close();
  }, [id]);

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Connecting…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold truncate max-w-md">
            {data.quizTitle ?? 'Live Session'}
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {data.playing} playing · {data.finished} finished
          </p>
        </div>
        <Link
          href={`/teacher/sessions/${id}`}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          ← Results
        </Link>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 space-y-3">
        {data.entries.length === 0 ? (
          <div className="text-center py-24 text-slate-600">
            <p className="text-4xl mb-3">⏳</p>
            <p>Waiting for students…</p>
          </div>
        ) : (
          data.entries.map((entry) => {
            const progress =
              entry.totalQuestions > 0
                ? (entry.currentQuestion / entry.totalQuestions) * 100
                : 0;
            const isTop3 = entry.rank <= 3;
            const isFlashing = flashing.has(entry.studentName);
            return (
              <div
                key={entry.studentName}
                style={{ transition: 'all 0.4s ease' }}
                className={[
                  'flex items-center gap-4 rounded-2xl px-5 py-4 border',
                  isTop3 ? RANK_BORDER[entry.rank] : 'border-slate-800',
                  isTop3 ? 'bg-slate-900' : 'bg-slate-950',
                  isFlashing ? 'bg-blue-900/40' : '',
                ].join(' ')}
              >
                <div className="w-8 text-center text-xl flex-shrink-0">
                  {RANK_BADGE[entry.rank] ?? (
                    <span className="text-slate-600 text-sm font-bold">{entry.rank}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">
                    {entry.studentName}
                    {entry.isFinished && (
                      <span className="ml-2 text-xs text-emerald-400">✓ Done</span>
                    )}
                  </p>
                  <div className="mt-1 h-1.5 bg-slate-800 rounded-full overflow-hidden w-full">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${progress}%`, transition: 'width 0.6s ease' }}
                    />
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-xl font-bold text-white">{entry.score}</p>
                  <p className="text-xs text-slate-500">
                    {entry.currentQuestion}/{entry.totalQuestions}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
