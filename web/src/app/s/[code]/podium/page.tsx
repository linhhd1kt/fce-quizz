'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface PodiumEntry {
  rank: number;
  studentName: string;
  score: number;
  totalQuestions: number;
  timeSpentMs: number;
}

const CONFETTI_COLORS = ['#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#3b82f6', '#f97316'];

function Confetti() {
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: `${i * 2.5}%`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: `${(i * 0.08).toFixed(2)}s`,
    duration: `${3 + (i % 3)}s`,
    width: `${6 + (i % 5)}px`,
    height: `${12 + (i % 7)}px`,
  }));
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute top-0"
          style={{
            left: p.left,
            width: p.width,
            height: p.height,
            background: p.color,
            borderRadius: '2px',
            animationName: 'fall',
            animationDuration: p.duration,
            animationDelay: p.delay,
            animationTimingFunction: 'linear',
            animationFillMode: 'both',
            animationIterationCount: '1',
          }}
        />
      ))}
      <style>{`@keyframes fall { 0% { transform: translateY(-20px) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }`}</style>
    </div>
  );
}

const PODIUM_CONFIG = {
  1: { height: 'h-32', bg: 'bg-yellow-500', medal: '🥇', textSize: 'text-lg' },
  2: { height: 'h-24', bg: 'bg-slate-400', medal: '🥈', textSize: 'text-base' },
  3: { height: 'h-20', bg: 'bg-amber-700', medal: '🥉', textSize: 'text-base' },
} as const;

function PodiumBlock({ entry, animDelay }: { entry: PodiumEntry; animDelay: string }) {
  const rank = entry.rank as 1 | 2 | 3;
  const cfg = PODIUM_CONFIG[rank];
  const pct = Math.round((entry.score / entry.totalQuestions) * 100);
  return (
    <div
      className="flex flex-col items-center"
      style={{
        animationName: 'slideUp',
        animationDuration: '0.6s',
        animationDelay: animDelay,
        animationTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)',
        animationFillMode: 'both',
      }}
    >
      <span className="text-3xl mb-1">{cfg.medal}</span>
      <p className={`text-white font-bold mb-1 text-center w-24 truncate ${cfg.textSize}`}>{entry.studentName}</p>
      <p className="text-white/50 text-xs mb-2">
        {entry.score} / {entry.totalQuestions} &bull; {pct}%
      </p>
      <div className={`w-24 sm:w-28 ${cfg.height} ${cfg.bg} rounded-t-xl flex items-center justify-center shadow-lg`}>
        <span className="text-white/30 text-4xl font-black">{rank}</span>
      </div>
    </div>
  );
}

export default function PodiumPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950">
      <p className="text-slate-500 text-sm">Loading results…</p>
    </div>
  );

  const top3 = entries.filter((e) => e.rank <= 3);
  const rest = entries.filter((e) => e.rank > 3);
  const byRank = (r: number) => top3.find((e) => e.rank === r);

  const REVEAL_DELAYS: Record<number, string> = { 1: '2.0s', 2: '1.2s', 3: '0.5s' };

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center px-4 py-8 bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950 overflow-hidden">
      <Confetti />

      <div className="relative z-10 w-full max-w-xl space-y-8 text-center">
        <div>
          <h1 className="text-white text-3xl font-black">Final Results</h1>
          {quizTitle && <p className="text-white/40 text-sm mt-1">{quizTitle}</p>}
        </div>

        {entries.length === 0 ? (
          <p className="text-slate-500 text-sm">No results yet.</p>
        ) : (
          <>
            {/* Podium: 2nd | 1st | 3rd */}
            <div className="flex items-end justify-center gap-4">
              {byRank(2) && <PodiumBlock entry={byRank(2)!} animDelay={REVEAL_DELAYS[2]} />}
              {byRank(1) && <PodiumBlock entry={byRank(1)!} animDelay={REVEAL_DELAYS[1]} />}
              {byRank(3) && <PodiumBlock entry={byRank(3)!} animDelay={REVEAL_DELAYS[3]} />}
            </div>

            {/* 4th+ */}
            {rest.length > 0 && (
              <div className="space-y-1.5">
                {rest.map((entry) => {
                  const pct = Math.round((entry.score / entry.totalQuestions) * 100);
                  return (
                    <div key={entry.studentName} className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5">
                      <span className="text-slate-500 text-sm w-6 text-right shrink-0">{entry.rank}.</span>
                      <span className="flex-1 text-white/70 text-sm truncate text-left">{entry.studentName}</span>
                      <span className="text-slate-400 text-sm shrink-0">{entry.score} / {entry.totalQuestions} &bull; {pct}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => router.push(`/s/${code}`)}
            className="flex-1 py-3.5 rounded-2xl text-white font-black text-base transition hover:brightness-110 active:scale-95"
            style={{ background: '#e86020', boxShadow: 'rgba(232,96,32,0.4) 0 4px 20px' }}
          >
            &#9654; Play again
          </button>
          <Link
            href="/"
            className="px-6 py-3.5 rounded-2xl text-slate-300 font-semibold text-base bg-white/10 hover:bg-white/20 transition-colors"
          >
            Home
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
