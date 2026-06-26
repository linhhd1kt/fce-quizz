'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { createSession } from '@/lib/session';
import type { QuizRow, SessionRow } from '@/types/quiz';

export default function TeacherDashboard() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [sessions, setSessions] = useState<(SessionRow & { quizzes: QuizRow })[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [newSession, setNewSession] = useState<SessionRow | null>(null);
  const [copied, setCopied] = useState(false);
  const [teacherName, setTeacherName] = useState('');

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/teacher/login'); return; }

    const [profileRes, quizRes, sessionRes] = await Promise.all([
      supabase.from('teacher_profiles').select('name').eq('id', user.id).single(),
      supabase.from('quizzes').select('*').eq('teacher_id', user.id).order('created_at', { ascending: false }),
      supabase.from('sessions').select('*, quizzes(*)').eq('teacher_id', user.id).order('created_at', { ascending: false }),
    ]);

    if (profileRes.data) setTeacherName(profileRes.data.name);
    setQuizzes(quizRes.data ?? []);
    setSessions((sessionRes.data ?? []) as (SessionRow & { quizzes: QuizRow })[]);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function handleCreateSession(quizId: string) {
    setCreatingFor(quizId);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const session = await createSession(quizId, user.id);
    if (session) {
      setNewSession(session);
      await load();
    }
    setCreatingFor(null);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/teacher/login');
  }

  function copyLink(code: string) {
    const url = `${window.location.origin}/s/${code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <p className="text-slate-500 text-sm">Đang tải…</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-600 hover:text-slate-400 text-sm">FCEQuiz</Link>
            <span className="text-slate-700">/</span>
            <span className="text-white text-sm font-semibold">Giáo viên</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-sm hidden sm:block">{teacherName}</span>
            <button onClick={handleSignOut} className="text-xs text-slate-600 hover:text-red-400 transition-colors">
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        {/* New session notification */}
        {newSession && (
          <div className="bg-emerald-950 border border-emerald-700 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-emerald-400 font-bold text-sm">✓ Phòng thi đã được tạo!</p>
              <p className="text-white font-mono text-3xl font-black mt-1 tracking-widest">{newSession.code}</p>
              <p className="text-emerald-600 text-xs mt-1">{window.location.origin}/s/{newSession.code}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => copyLink(newSession.code)}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm rounded-xl font-semibold transition-colors"
              >
                {copied ? '✓ Đã copy' : 'Copy link'}
              </button>
              <button onClick={() => setNewSession(null)} className="text-xs text-slate-500 hover:text-slate-300">
                Đóng
              </button>
            </div>
          </div>
        )}

        {/* Quizzes */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-bold text-lg">Bộ đề thi</h2>
            <Link
              href="/teacher/quizzes/new"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              + Upload đề mới
            </Link>
          </div>

          {quizzes.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl space-y-3">
              <p className="text-slate-500 text-sm">Chưa có bộ đề nào.</p>
              <Link href="/teacher/quizzes/new" className="text-blue-400 hover:underline text-sm">
                Upload đề đầu tiên →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {quizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold truncate">{quiz.title}</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {quiz.questions.length} câu · {quiz.time_per_question}s/câu
                      {quiz.source ? ` · ${quiz.source}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCreateSession(quiz.id)}
                    disabled={creatingFor === quiz.id}
                    className="shrink-0 px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    {creatingFor === quiz.id ? '…' : '+ Tạo phòng'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Sessions */}
        {sessions.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-white font-bold text-lg">Phòng thi đã tạo</h2>
            <div className="space-y-2">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-3 flex items-center gap-4"
                >
                  <span className="font-mono font-black text-lg text-orange-400 w-20 shrink-0">{s.code}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{s.quizzes?.title}</p>
                    <p className="text-slate-500 text-xs">{new Date(s.created_at).toLocaleDateString('vi-VN')}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => copyLink(s.code)}
                      className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      Copy link
                    </button>
                    <Link
                      href={`/teacher/sessions/${s.id}`}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      Xem kết quả
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
