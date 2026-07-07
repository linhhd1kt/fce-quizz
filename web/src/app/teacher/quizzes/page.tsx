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
  code: string;
  status: string;
  createdAt: string;
  quizTitle: string | null;
  quizId: string;
  batchId: string | null;
  batchOrder: number | null;
  lobbyCount: number;
  finishedCount: number;
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
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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

  // Group by source
  const sourceMap = new Map<string, QuizRow[]>();
  const ungrouped: QuizRow[] = [];
  for (const q of filtered) {
    if (q.source) {
      if (!sourceMap.has(q.source)) sourceMap.set(q.source, []);
      sourceMap.get(q.source)!.push(q);
    } else {
      ungrouped.push(q);
    }
  }
  const groups = Array.from(sourceMap.entries());

  // Index sessions by quizId
  const sessionsByQuizId = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    if (!sessionsByQuizId.has(s.quizId)) sessionsByQuizId.set(s.quizId, []);
    sessionsByQuizId.get(s.quizId)!.push(s);
  }
  for (const arr of sessionsByQuizId.values()) {
    arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  function toggleCollapse(source: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(source) ? next.delete(source) : next.add(source);
      return next;
    });
  }

  async function handleCreate(quizId: string) {
    setCreatingFor(quizId);
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId }),
    });
    if (!res.ok) toast.error('Failed to create game room.');
    await load();
    setCreatingFor(null);
  }

  async function handleDeleteQuiz(id: string, title: string) {
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

  async function handleDeleteSession(id: string, code: string) {
    const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error(`Failed to delete room ${code}`);
    } else {
      toast.success(`Deleted room ${code}`);
      await load();
    }
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
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
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

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
          <p className="text-slate-500 text-sm">{search ? 'No quizzes match your search.' : 'No quiz sets yet.'}</p>
          {!search && (
            <Link href="/teacher/quizzes/new" className="text-blue-400 hover:underline text-sm">
              Upload your first quiz →
            </Link>
          )}
        </div>
      )}

      {/* Quiz list */}
      {filtered.length > 0 && (
        <div className="space-y-4">
          {groups.map(([source, groupQuizzes]) => {
            const isCollapsed = collapsed.has(source);
            const displayName = source.replace(/\.pdf$/i, '');
            return (
              <div key={source} className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <button
                  onClick={() => toggleCollapse(source)}
                  className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                >
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate flex-1 mr-3">
                    {isCollapsed ? '▶' : '▼'}&nbsp;&nbsp;{displayName}
                  </span>
                  <span className="text-xs text-slate-400 shrink-0">
                    {groupQuizzes.length} part{groupQuizzes.length !== 1 ? 's' : ''}
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {groupQuizzes.map((quiz) => (
                      <QuizCard
                        key={quiz.id}
                        quiz={quiz}
                        sessions={sessionsByQuizId.get(quiz.id) ?? []}
                        creatingFor={creatingFor}
                        confirmDelete={confirmDelete}
                        deleting={deleting}
                        copiedCode={copiedCode}
                        onStart={() => handleCreate(quiz.id)}
                        onDelete={() => handleDeleteQuiz(quiz.id, quiz.title)}
                        onConfirmDelete={() => setConfirmDelete(quiz.id)}
                        onCancelDelete={() => setConfirmDelete(null)}
                        onCopy={copyLink}
                        onDeleteSession={handleDeleteSession}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Ungrouped */}
          {ungrouped.length > 0 && (
            <div className="space-y-3">
              {groups.length > 0 && (
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-600 uppercase tracking-wider">Other</p>
              )}
              {ungrouped.map((quiz) => (
                <div key={quiz.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                  <QuizCard
                    quiz={quiz}
                    sessions={sessionsByQuizId.get(quiz.id) ?? []}
                    creatingFor={creatingFor}
                    confirmDelete={confirmDelete}
                    deleting={deleting}
                    copiedCode={copiedCode}
                    onStart={() => handleCreate(quiz.id)}
                    onDelete={() => handleDeleteQuiz(quiz.id, quiz.title)}
                    onConfirmDelete={() => setConfirmDelete(quiz.id)}
                    onCancelDelete={() => setConfirmDelete(null)}
                    onCopy={copyLink}
                    onDeleteSession={handleDeleteSession}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface QuizCardProps {
  quiz: QuizRow;
  sessions: SessionRow[];
  creatingFor: string | null;
  confirmDelete: string | null;
  deleting: boolean;
  copiedCode: string | null;
  onStart: () => void;
  onDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onCopy: (code: string) => void;
  onDeleteSession: (id: string, code: string) => void;
}

function statusBadge(status: string) {
  if (status === 'active') return <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Active</span>;
  if (status === 'waiting') return <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Waiting</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Finished</span>;
}

function sessionLink(s: SessionRow): { href: string; label: string } {
  if (s.status === 'waiting') return { href: `/teacher/sessions/${s.id}/lobby`, label: '→ Lobby' };
  if (s.status === 'active') return { href: `/teacher/sessions/${s.id}/live`, label: '→ Live' };
  return { href: `/teacher/sessions/${s.id}`, label: '→ Results' };
}

function QuizCard({ quiz, sessions, creatingFor, confirmDelete, deleting, copiedCode, onStart, onDelete, onConfirmDelete, onCancelDelete, onCopy, onDeleteSession }: QuizCardProps) {
  const [confirmDeleteSession, setConfirmDeleteSession] = useState<string | null>(null);

  return (
    <div>
      {/* Quiz row */}
      <div className="p-4 flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-slate-900 dark:text-white font-semibold truncate">{quiz.title}</p>
          <p className="text-slate-500 text-xs mt-0.5">
            {quiz.questions.length} questions · {quiz.time_per_question}s/q
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {confirmDelete === quiz.id ? (
            <>
              <span className="text-xs text-slate-400">Delete quiz + all room data?</span>
              <button
                onClick={onDelete}
                disabled={deleting}
                className="px-3 py-1.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {deleting ? '…' : 'Delete'}
              </button>
              <button
                onClick={onCancelDelete}
                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={onConfirmDelete} className="px-2 py-1.5 text-slate-400 hover:text-red-400 text-sm transition-colors">🗑</button>
              <Link
                href={`/teacher/quizzes/${quiz.id}`}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl transition-colors"
              >
                Edit
              </Link>
              <button
                onClick={onStart}
                disabled={!!creatingFor}
                className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {creatingFor === quiz.id ? '…' : '▶ Start'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sessions under quiz */}
      {sessions.length > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          {sessions.map((s) => {
            const { href, label } = sessionLink(s);
            return (
              <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
                <span className="font-mono font-bold text-slate-900 dark:text-white text-sm tracking-widest w-20 shrink-0">{s.code}</span>
                <div className="w-20 shrink-0">{statusBadge(s.status)}</div>
                <span className="text-xs text-slate-400 flex-1">
                  👥 {s.finishedCount}/{s.lobbyCount} played
                </span>
                {confirmDeleteSession === s.id ? (
                  <>
                    <span className="text-xs text-slate-400">Delete room?</span>
                    <button
                      onClick={() => { onDeleteSession(s.id, s.code); setConfirmDeleteSession(null); }}
                      className="text-xs px-2.5 py-1 rounded-lg bg-red-700 hover:bg-red-600 text-white transition-colors shrink-0"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDeleteSession(null)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors shrink-0"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => onCopy(s.code)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors shrink-0"
                    >
                      {copiedCode === s.code ? '✓ Copied' : 'Copy link'}
                    </button>
                    <Link
                      href={href}
                      className="text-xs px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors shrink-0"
                    >
                      {label}
                    </Link>
                    <button
                      onClick={() => setConfirmDeleteSession(s.id)}
                      className="text-slate-400 hover:text-red-400 text-xs transition-colors shrink-0"
                    >
                      🗑
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* No sessions yet */}
      {sessions.length === 0 && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-2 bg-slate-50 dark:bg-slate-950">
          <p className="text-xs text-slate-400 italic">No games yet — click ▶ Start to create one</p>
        </div>
      )}
    </div>
  );
}
