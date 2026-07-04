'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    router.push(`/s/${trimmed}`);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-1">
          <h1 className="text-white text-3xl font-black">FCEQuiz</h1>
          <p className="text-slate-400 text-sm">Enter your room code to join</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            required
            autoFocus
            autoComplete="off"
            placeholder="Room code…"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full text-center text-white text-2xl font-black tracking-widest bg-white/5 border-2 border-white/20 focus:border-white/60 rounded-2xl px-6 py-4 outline-none transition-colors placeholder-white/20 uppercase"
          />
          <button
            type="submit"
            disabled={!code.trim()}
            className="w-full py-4 rounded-2xl text-white font-black text-xl transition hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#e86020', boxShadow: 'rgba(232,96,32,0.4) 0 4px 20px' }}
          >
            Join →
          </button>
        </form>
      </div>
    </div>
  );
}
