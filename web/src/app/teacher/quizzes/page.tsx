'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';

interface QuizRow {
  id: string;
  title: string;
  questions: unknown[];
  time_per_question: number;
  source?: string;
}

interface SessionRow {
  id: string;
  quizId: string;
}

interface BatchResult {
  batchId: string;
  quizTitle: string;
  parts: { id: string; code: string; batchOrder: number; questionCount: number }[];
}

export default function QuizzesPage() {
  return <Suspense><QuizzesContent /></Suspense>;
}

function QuizzesContent() {
  const searchParams = useSearchParams();
  const filter = searchParams.get('filter');

  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [newSessionCode, setNewSessionCode] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const [qRes, sRes] = await Promise.all([
      fetch('/api/quizzes').then((r) => r.json()),
      fetch('/api/sessions').then((r) => r.json()),
    ]);
    setQuizzes(Array.isArray(qRes) ? qRes : []);
    setSessions(Array.isArray(sRes) ? sRes : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const quizIdsWithSessions = new Set(sessions.map((s) => s.quizId));

  const filtered = quizzes.filter((q) => {
    const matchesSearch = q.title.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter !== 'recent' || quizIdsWithSessions.has(q.id);
    return matchesSearch && matchesFilter;
  });

  async function handleCreate(quizId: string) {
    setCreatingFor(quizId);
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId }),
    });
    if (res.ok) {
      const s = await res.json() as { code: string };
      setNewSessionCode(s.code);
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
      await load();
    }
    setCreatingFor(null);
  }

  async function handleDelete(id: string, title: string) {
    setDeleting(true);
    const res = await fetch(`/api/quizzes/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      toast.error(`Failed to delete "${title}": ${body.error ?? res.status}`);
    } else {
      toast.success(`Deleted "${title}"`);
      await load();
    }
    setConfirmDelete(null);
    setDeleting(false);
  }

  function copyLink(code: string) {
    const url = `${window.location.origin}/s/${code}`;
    function fallback() {
      const el = document.createElement('textarea');
      el.value = url;
      el.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(fallback);
    } else {
      fallback();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500 text-sm">Loading…</p>
      </div>
    );
  }

  const createdCount = quizzes.length;

  return (
    <div className="px-6 py-6 max-w-4xl mx-auto space-y-6">
      {/* New session banner */}
      {newSessionCode && (
        <div className="bg-emerald-950 border border-emerald-700 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-emerald-400 font-bold text-sm">✓ Room created!</p>
            <p className="text-white font-mono text-3xl font-black mt-1 tracking-widest">{newSessionCode}</p>
            <p className="text-emerald-600 text-xs mt-1">{window.location.origin}/s/{newSessionCode}</p>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => copyLink(newSessionCode)}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm rounded-xl font-semibold transition-colors"
            >
              {copied ? '✓ Copied' : 'Copy link'}
            </button>
            <button
              onClick={() => setNewSessionCode(null)}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Batch banner */}
      {batchResult && (
        <div className="bg-blue-950 border border-blue-700 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-blue-400 font-bold text-sm">
              ✓ Batch created — {batchResult.parts.length} parts · {batchResult.quizTitle}
            </p>
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

      {/* Search + Add quiz */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search by quiz name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
        />
        <Link
          href="/teacher/quizzes/new"
          className="shrink-0 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          + Add quiz
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button className="text-sm font-semibold text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 pb-3 -mb-3">
          Created ({createdCount})
        </button>
        <button className="text-sm text-slate-400 dark:text-slate-600">Draft (0)</button>
        <button className="text-sm text-slate-400 dark:text-slate-600">Archived (0)</button>
      </div>

      {/* Quiz list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
          <p className="text-slate-500 text-sm">{search ? 'No quizzes match your search.' : 'No quiz sets yet.'}</p>
          {!search && (
            <Link href="/teacher/quizzes/new" className="text-blue-400 hover:underline text-sm">
              Upload your first quiz →
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((quiz) => (
            <div key={quiz.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-slate-900 dark:text-white font-semibold truncate">{quiz.title}</p>
                <p className="text-slate-500 text-xs mt-0.5">
                  {quiz.questions.length} questions · {quiz.time_per_question}s/q{quiz.source ? ` · ${quiz.source}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {confirmDelete === quiz.id ? (
                  <>
                    <span className="text-xs text-slate-400">Delete quiz + all room data?</span>
                    <button
                      onClick={() => handleDelete(quiz.id, quiz.title)}
                      disabled={deleting}
                      className="px-3 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                      {deleting ? '…' : 'Delete'}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setConfirmDelete(quiz.id)}
                      className="px-2 py-2 text-slate-400 hover:text-red-400 text-sm transition-colors"
                    >
                      🗑
                    </button>
                    <Link
                      href={`/teacher/quizzes/${quiz.id}`}
                      className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl transition-colors"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleCreate(quiz.id)}
                      disabled={!!creatingFor}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                      {creatingFor === quiz.id ? '…' : '▶ Start'}
                    </button>
                    <button
                      onClick={() => handleCreateBatch(quiz.id)}
                      disabled={!!creatingFor}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                      {creatingFor === quiz.id + ':batch' ? '…' : '+ Batch'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
