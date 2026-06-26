'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getAttemptsForSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { formatTime } from '@/lib/scoring';
import type { AttemptRow, SessionRow, QuizRow } from '@/types/quiz';

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<(SessionRow & { quizzes: QuizRow }) | null>(null);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [sessionRes, attemptsData] = await Promise.all([
        supabase.from('sessions').select('*, quizzes(*)').eq('id', id).single(),
        getAttemptsForSession(id),
      ]);
      setSession(sessionRes.data as SessionRow & { quizzes: QuizRow });
      setAttempts(attemptsData as AttemptRow[]);
      setLoading(false);
    }
    load();
  }, [id]);

  function copyLink() {
    if (!session) return;
    navigator.clipboard.writeText(`${window.location.origin}/s/${session.code}`);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <p className="text-slate-500 text-sm">Đang tải…</p>
    </div>
  );

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <p className="text-slate-500 text-sm">Không tìm thấy phòng thi.</p>
    </div>
  );

  const sorted = [...attempts].sort((a, b) => b.score - a.score || a.time_spent_ms - b.time_spent_ms);
  const avg = attempts.length > 0
    ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length)
    : 0;

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 sticky top-0 z-10 bg-slate-950/80 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/teacher" className="text-slate-500 hover:text-slate-300 text-sm">← Dashboard</Link>
            <span className="text-slate-700">/</span>
            <span className="text-white text-sm font-semibold truncate max-w-xs">{session.quizzes?.title}</span>
          </div>
          <button onClick={copyLink} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            Copy link /s/{session.code}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Học sinh đã làm', value: attempts.length, color: '#8db600' },
            { label: 'Điểm trung bình', value: `${avg}%`, color: '#8a4fd0' },
            { label: 'Mã phòng', value: session.code, color: '#e86020' },
          ].map((s) => (
            <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
              <p className="font-black text-2xl" style={{ color: s.color }}>{s.value}</p>
              <p className="text-slate-500 text-xs mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Attempts table */}
        {attempts.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <p className="text-4xl">⏳</p>
            <p className="text-slate-500">Chưa có học sinh nào làm bài.</p>
            <button onClick={copyLink} className="text-blue-400 hover:underline text-sm">
              Copy link chia sẻ
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-white font-bold">Kết quả học sinh</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-slate-800">
                    <th className="pb-3 text-slate-500 font-medium text-xs uppercase tracking-wide">#</th>
                    <th className="pb-3 text-slate-500 font-medium text-xs uppercase tracking-wide">Học sinh</th>
                    <th className="pb-3 text-slate-500 font-medium text-xs uppercase tracking-wide text-right">Điểm</th>
                    <th className="pb-3 text-slate-500 font-medium text-xs uppercase tracking-wide text-right">Đúng</th>
                    <th className="pb-3 text-slate-500 font-medium text-xs uppercase tracking-wide text-right">Thời gian</th>
                    <th className="pb-3 text-slate-500 font-medium text-xs uppercase tracking-wide text-right">Ngày</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {sorted.map((a, idx) => {
                    const correct = (a.answers as { correct: boolean }[]).filter((x) => x.correct).length;
                    return (
                      <tr key={a.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-3 text-slate-600 text-xs w-8">{idx + 1}</td>
                        <td className="py-3 text-white font-medium">{a.student_name}</td>
                        <td className="py-3 text-right">
                          <span className={`font-bold ${a.score >= 75 ? 'text-emerald-400' : a.score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {a.score}%
                          </span>
                        </td>
                        <td className="py-3 text-right text-slate-400">{correct}/{a.total_questions}</td>
                        <td className="py-3 text-right text-slate-400">{formatTime(a.time_spent_ms)}</td>
                        <td className="py-3 text-right text-slate-600 text-xs">
                          {new Date(a.completed_at).toLocaleDateString('vi-VN')}
                        </td>
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
