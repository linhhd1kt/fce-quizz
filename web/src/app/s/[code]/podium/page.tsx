'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface PodiumEntry {
  rank: number;
  studentName: string;
  score: number;
  totalQuestions: number;
  timeSpentMs: number;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function PodiumPage() {
  const { code } = useParams<{ code: string }>();
  const [entries, setEntries] = useState<PodiumEntry[]>([]);
  const [quizTitle, setQuizTitle] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/sessions/lookup?code=${code}`)
      .then((r) => r.ok ? r.json() : null)
      .then(async (session) => {
        if (!session) { setLoading(false); return; }
        setQuizTitle(session.quizTitle ?? '');
        const res = await fetch(`/api/sessions/${session.id}/podium`);
        if (res.ok) {
          const data = await res.json() as { entries: PodiumEntry[] };
          setEntries(data.entries);
        }
        setLoading(false);
      });
  }, [code]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <p className="text-slate-500 text-sm">Loading results…</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <p className="text-5xl">🏆</p>
          <h1 className="text-white text-2xl font-black mt-2">Final Results</h1>
          {quizTitle && <p className="text-slate-400 text-sm">{quizTitle}</p>}
        </div>

        {entries.length === 0 ? (
          <p className="text-center text-slate-500 text-sm">No results yet.</p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.studentName}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
                  entry.rank === 1 ? 'bg-yellow-950/40 border border-yellow-700/50' :
                  entry.rank === 2 ? 'bg-slate-800/60 border border-slate-600/50' :
                  entry.rank === 3 ? 'bg-orange-950/30 border border-orange-800/40' :
                  'bg-slate-900 border border-slate-800'
                }`}
              >
                <span className="text-2xl w-8 text-center shrink-0">
                  {MEDALS[entry.rank - 1] ?? `${entry.rank}.`}
                </span>
                <span className="flex-1 text-white font-semibold truncate">{entry.studentName}</span>
                <span className={`font-black text-lg shrink-0 ${
                  entry.rank === 1 ? 'text-yellow-400' :
                  entry.rank === 2 ? 'text-slate-300' :
                  entry.rank === 3 ? 'text-orange-400' :
                  'text-slate-400'
                }`}>
                  {entry.score}/{entry.totalQuestions}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Link
            href="/"
            className="flex-1 py-3 text-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
