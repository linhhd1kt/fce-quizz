'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatTime } from '@/lib/scoring';

interface AttemptRow { id: string; student_name: string; score: number; total_questions: number; time_spent_ms: number; answers: { correct: boolean }[]; completed_at: string; }
interface SessionData { id: string; code: string; quiz: { title: string } | null; }

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<SessionData | null>(null);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/sessions/${id}`)
      .then((r) => r.json())
      .then((data) => { setSession(data.session); setAttempts(data.attempts ?? []); setLoading(false); });
  }, [id]);

  function copyLink() {
    if (!session) return;
    navigator.clipboard.writeText(`${window.location.origin}/s/${session.code}`);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <p className="text-slate-500 text-sm">Loading…</p>
    </div>
  );

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <p className="text-slate-500 text-sm">Room not found.</p>
    </div>
  );

  const sorted = [...attempts].sort((a, b) => b.score - a.score || a.time_spent_ms - b.time_spent_ms);
  const avg = attempts.length > 0 ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length) : 0;

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 sticky top-0 z-10 bg-slate-950/80 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/teacher" className="text-slate-500 hover:text-slate-300 text-sm">← Dashboard</Link>
            <span className="text-slate-700">/</span>
            <span className="text-white text-sm font-semibold truncate max-w-xs">{session.quiz?.title}</span>
          </div>
          <button onClick={copyLink} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            Copy link /s/{session.code}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Students', value: attempts.length, color: '#8db600' },
            { label: 'Average score', value: `${avg}%`, color: '#8a4fd0' },
            { label: 'Room code', value: session.code, color: '#e86020' },
          ].map((s) => (
            <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
              <p className="font-black text-2xl" style={{ color: s.color }}>{s.value}</p>
              <p className="text-slate-500 text-xs mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {attempts.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <p className="text-4xl">⏳</p>
            <p className="text-slate-500">No students yet.</p>
            <button onClick={copyLink} className="text-blue-400 hover:underline text-sm">Copy share link</button>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-white font-bold">Results</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-slate-800">
                    {['#', 'Student', 'Score', 'Correct', 'Time', 'Date'].map((h) => (
                      <th key={h} className={`pb-3 text-slate-500 font-medium text-xs uppercase tracking-wide ${h !== '#' && h !== 'Student' ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {sorted.map((a, idx) => {
                    const correct = a.answers.filter((x) => x.correct).length;
                    return (
                      <tr key={a.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-3 text-slate-600 text-xs w-8">{idx + 1}</td>
                        <td className="py-3 text-white font-medium">{a.student_name}</td>
                        <td className="py-3 text-right">
                          <span className={`font-bold ${a.score >= 75 ? 'text-emerald-400' : a.score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>{a.score}%</span>
                        </td>
                        <td className="py-3 text-right text-slate-400">{correct}/{a.total_questions}</td>
                        <td className="py-3 text-right text-slate-400">{formatTime(a.time_spent_ms)}</td>
                        <td className="py-3 text-right text-slate-600 text-xs">{new Date(a.completed_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
