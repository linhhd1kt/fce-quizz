'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface SessionInfo {
  id: string;
  code: string;
  quiz: { title: string } | null;
}

export default function TeacherLobbyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [players, setPlayers] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    fetch(`/api/sessions/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: { session: SessionInfo } | null) => {
        if (data?.session) setSession(data.session);
      });
  }, [id]);

  const fetchPlayers = useCallback(async () => {
    const res = await fetch(`/api/sessions/${id}/players`);
    if (res.ok) {
      const data = await res.json() as { players: string[] };
      setPlayers(data.players);
    }
  }, [id]);

  useEffect(() => {
    fetchPlayers();
    const interval = setInterval(fetchPlayers, 2000);
    return () => clearInterval(interval);
  }, [fetchPlayers]);

  async function handleStart() {
    setStarting(true);
    await fetch(`/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    router.push('/teacher');
  }

  const code = session?.code ?? '';
  const title = session?.quiz?.title ?? '';

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center px-6 bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950">
      <button
        onClick={() => router.back()}
        className="absolute top-4 left-4 text-white/40 hover:text-white text-sm transition-colors"
      >
        &larr; Back
      </button>

      <div className="w-full max-w-3xl space-y-10 text-center">
        {title && <p className="text-white/60 text-lg font-medium">{title}</p>}

        <div>
          <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Room Code</p>
          <div className="inline-block px-10 py-5 rounded-2xl bg-white/5 border-2 border-white/10">
            <span className="font-mono text-7xl sm:text-8xl font-black text-orange-400 tracking-widest">
              {code.toUpperCase()}
            </span>
          </div>
        </div>

        <p className="text-white/60 text-xl">
          {players.length} player{players.length !== 1 ? 's' : ''} joined
        </p>

        {players.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3">
            {players.map((p) => (
              <span
                key={p}
                className="rounded-full px-4 py-2 bg-white/10 border border-white/20 text-white text-base font-medium"
              >
                {p}
              </span>
            ))}
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={starting || players.length === 0}
          className="px-12 py-4 rounded-2xl text-white text-xl font-black transition disabled:opacity-40 hover:brightness-110 active:scale-95"
          style={{ background: '#e86020', boxShadow: 'rgba(232,96,32,0.4) 0 4px 24px' }}
        >
          {starting ? 'Starting…' : '▶ Start Game'}
        </button>
      </div>
    </div>
  );
}
