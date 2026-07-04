'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { toast } from 'sonner';

interface QuizRow { id: string; title: string; questions: unknown[]; time_per_question: number; source?: string; }
interface SessionRow { id: string; code: string; isActive: boolean; createdAt: string; quizTitle: string; batchId?: string | null; batchOrder?: number | null; }
interface BatchPart { id: string; code: string; batchOrder: number; questionCount: number; }
interface BatchResult { batchId: string; quizTitle: string; parts: BatchPart[]; }

export default function TeacherDashboard() {
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [newSessionCode, setNewSessionCode] = useState<string | null>(null);
  const [newSessionId, setNewSessionId] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'session' | 'quiz'; id: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const [quizRes, sessionRes] = await Promise.all([
      fetch('/api/quizzes').then((r) => r.json()),
      fetch('/api/sessions').then((r) => r.json()),
    ]);
    setQuizzes(Array.isArray(quizRes) ? quizRes : []);
    setSessions(Array.isArray(sessionRes) ? sessionRes : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreateSession(quizId: string) {
    setCreatingFor(quizId);
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId }),
    });
    if (res.ok) {
      const session = await res.json();
      setNewSessionCode(session.code);
      setNewSessionId(session.id);
      setBatchResult(null);
      await load();
    }
    setCreatingFor(null);
  }

  async function handleCreateBatch(quizId: string) {
    setCreatingFor(quizId + ':batch');
    const res = await fetch('/api/sessions/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId }),
    });
    if (res.ok) {
      const result = await res.json() as BatchResult;
      setBatchResult(result);
      setNewSessionCode(null);
      setNewSessionId(null);
      await load();
    }
    setCreatingFor(null);
  }

  async function handleDeleteQuiz(id: string, title: string) {
    setDeleting(true);
    const res = await fetch(`/api/quizzes/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(`Failed to delete "${title}": ${body.error ?? res.status}`);
      setDeleting(false);
      return;
    }
    setConfirmDelete(null);
    setDeleting(false);
    toast.success(`Deleted "${title}"`);
    await load();
  }

  async function handleDeleteSession(id: string, code: string) {
    setDeleting(true);
    const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(`Failed to delete room ${code}: ${body.error ?? res.status}`);
      setDeleting(false);
      return;
    }
    setConfirmDelete(null);
    setDeleting(false);
    toast.success(`Deleted room ${code}`);
    await load();
  }

  async function handleSignOut() {
    await signOut({ redirectTo: '/teacher/login' });
  }

  function copyLink(code: string) {
    const url = `${window.location.origin}/s/${code}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => fallbackCopy(url));
    } else {
      fallbackCopy(url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function fallbackCopy(text: string) {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <p className="text-slate-500 text-sm">Loading…</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-600 hover:text-slate-400 text-sm">FCEQuiz</Link>
            <span className="text-slate-700">/</span>
            <span className="text-white text-sm font-semibold">Teacher</span>
          </div>
          <button onClick={handleSignOut} className="text-xs text-slate-600 hover:text-red-400 transition-colors">
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        {newSessionCode && newSessionId && (
          <div className="bg-emerald-950 border border-emerald-700 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-emerald-400 font-bold text-sm">✓ Room created!</p>
              <p className="text-white font-mono text-3xl font-black mt-1 tracking-widest">{newSessionCode}</p>
              <p className="text-emerald-600 text-xs mt-1">{typeof window !== 'undefined' ? window.location.origin : ''}/s/{newSessionCode}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => copyLink(newSessionCode)}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm rounded-xl font-semibold transition-colors">
                {copied ? '✓ Copied' : 'Copy link'}
              </button>
              <button onClick={() => { setNewSessionCode(null); setNewSessionId(null); }} className="text-xs text-slate-500 hover:text-slate-300">
                Close
              </button>
            </div>
          </div>
        )}

        {batchResult && (
          <div className="bg-blue-950 border border-blue-700 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-blue-400 font-bold text-sm">✓ Batch created — {batchResult.parts.length} parts · {batchResult.quizTitle}</p>
              <button onClick={() => setBatchResult(null)} className="text-slate-500 hover:text-slate-300 text-xl leading-none">×</button>
            </div>
            <div className="space-y-2">
              {batchResult.parts.map((part) => (
                <div key={part.id} className="flex items-center gap-3 bg-blue-900/30 rounded-xl px-4 py-2.5">
                  <span className="text-blue-300 text-xs font-semibold w-14 shrink-0">Part {part.batchOrder}/{batchResult.parts.length}</span>
                  <span className="font-mono font-black text-white text-lg tracking-widest w-20">{part.code}</span>
                  <span className="text-slate-400 text-xs flex-1">{part.questionCount} questions</span>
                  <button onClick={() => copyLink(part.code)} className="text-xs text-blue-400 hover:text-blue-200 transition-colors">
                    Copy
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-bold text-lg">Quiz Sets</h2>
            <Link href="/teacher/quizzes/new" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors">
              + Upload new
            </Link>
          </div>
          {quizzes.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl space-y-3">
              <p className="text-slate-500 text-sm">No quiz sets yet.</p>
              <Link href="/teacher/quizzes/new" className="text-blue-400 hover:underline text-sm">Upload your first quiz →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {quizzes.map((quiz) => (
                <div key={quiz.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold truncate">{quiz.title}</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {(quiz.questions as unknown[]).length} questions · {quiz.time_per_question}s/q{quiz.source ? ` · ${quiz.source}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {confirmDelete?.type === 'quiz' && confirmDelete.id === quiz.id ? (
                      <>
                        <span className="text-xs text-slate-400">Xóa tất cả rooms + dữ liệu?</span>
                        <button onClick={() => handleDeleteQuiz(quiz.id, quiz.title)} disabled={deleting}
                          className="px-3 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                          {deleting ? '…' : 'Xóa'}
                        </button>
                        <button onClick={() => setConfirmDelete(null)}
                          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors">
                          Huỷ
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setConfirmDelete({ type: 'quiz', id: quiz.id })}
                          className="px-2 py-2 text-slate-600 hover:text-red-400 text-sm transition-colors">
                          🗑
                        </button>
                        <Link href={`/teacher/quizzes/${quiz.id}`}
                          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors">
                          Edit
                        </Link>
                        <button onClick={() => handleCreateSession(quiz.id)} disabled={!!creatingFor}
                          className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                          {creatingFor === quiz.id ? '…' : '+ Room'}
                        </button>
                        <button onClick={() => handleCreateBatch(quiz.id)} disabled={!!creatingFor}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                          {creatingFor === quiz.id + ':batch' ? '…' : '+ Batch'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {sessions.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-white font-bold text-lg">Active rooms</h2>
            <div className="space-y-2">
              {sessions.map((s) => {
                const isBatch = !!s.batchId;
                const totalInBatch = isBatch ? sessions.filter(x => x.batchId === s.batchId).length : null;
                return (
                  <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-3 flex items-center gap-4">
                    <span className="font-mono font-black text-lg text-orange-400 w-20 shrink-0">{s.code}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white text-sm font-medium truncate">{s.quizTitle}</p>
                        {isBatch && (
                          <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-400 border border-blue-800 font-semibold">
                            Part {s.batchOrder}/{totalInBatch}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 text-xs">{new Date(s.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {confirmDelete?.type === 'session' && confirmDelete.id === s.id ? (
                        <>
                          <span className="text-xs text-slate-400">
                            {isBatch ? `Xóa tất cả ${totalInBatch} parts?` : 'Xóa room này?'}
                          </span>
                          <button onClick={() => handleDeleteSession(s.id, s.code)} disabled={deleting}
                            className="px-3 py-1.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
                            {deleting ? '…' : 'Xóa'}
                          </button>
                          <button onClick={() => setConfirmDelete(null)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors">
                            Huỷ
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => copyLink(s.code)} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                            Copy link
                          </button>
                          <Link href={`/teacher/sessions/${s.id}`}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition-colors">
                            View results
                          </Link>
                          <button onClick={() => setConfirmDelete({ type: 'session', id: s.id })}
                            className="px-1 text-slate-600 hover:text-red-400 text-sm transition-colors">
                            🗑
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
