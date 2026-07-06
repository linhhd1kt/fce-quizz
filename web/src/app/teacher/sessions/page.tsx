'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

interface SessionRow {
  id: string;
  code: string;
  status: string;
  quizTitle: string;
  quizId: string;
  batchId?: string | null;
  batchOrder?: number | null;
  lobbyCount: number;
  finishedCount: number;
  createdAt: string;
}

type FilterTab = 'all' | 'waiting' | 'active' | 'ended';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>('all');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/sessions');
    const data = await res.json() as SessionRow[];
    setSessions(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const hasLive = sessions.some((s) => s.status === 'waiting' || s.status === 'active');
    if (!hasLive) return;
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [sessions, load]);

  async function handleStart(id: string) {
    const res = await fetch(`/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    if (!res.ok) { toast.error('Failed to start game'); return; }
    await load();
  }

  async function handleEnd(id: string) {
    const res = await fetch(`/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ended' }),
    });
    if (!res.ok) { toast.error('Failed to end game'); return; }
    await load();
  }

  async function handleDelete(id: string, code: string) {
    setDeleting(true);
    const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      toast.error(`Failed to delete room ${code}: ${body.error ?? res.status}`);
    } else {
      toast.success(`Deleted room ${code}`);
      await load();
    }
    setConfirmDelete(null);
    setDeleting(false);
  }

  function copyLink(code: string) {
    const url = `${window.location.origin}/s/${code}`;
    navigator.clipboard?.writeText(url).catch(() => {
      const el = document.createElement('textarea');
      el.value = url;
      el.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    });
  }

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'waiting', label: 'Waiting' },
    { key: 'active', label: 'Active' },
    { key: 'ended', label: 'Ended' },
  ];

  const displayed = tab === 'all' ? sessions : sessions.filter((s) => s.status === tab);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">Sessions</h1>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === key
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Session list */}
      {displayed.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          <p className="text-slate-500 text-sm">No sessions{tab !== 'all' ? ` with status "${tab}"` : ''} yet.</p>
          <p className="text-xs text-slate-400 mt-2">Create a session from the Quizzes page.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map((s) => {
            const isBatch = !!s.batchId;
            const totalInBatch = isBatch ? sessions.filter((x) => x.batchId === s.batchId).length : null;
            return (
              <div key={s.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-3 flex items-center gap-4">
                <span className="font-mono font-black text-lg text-orange-400 w-20 shrink-0">{s.code}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-slate-900 dark:text-white text-sm font-medium truncate">{s.quizTitle}</p>
                    {isBatch && (
                      <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-semibold">
                        Part {s.batchOrder}/{totalInBatch}
                      </span>
                    )}
                    {s.status === 'waiting' && (
                      <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 font-semibold">
                        waiting
                      </span>
                    )}
                    {s.status === 'active' && (
                      <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-semibold">
                        live
                      </span>
                    )}
                    {s.status === 'ended' && (
                      <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 font-semibold">
                        ended
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {s.status === 'waiting' && `${s.lobbyCount} in lobby · `}
                    {s.status === 'active' && `${s.finishedCount}/${s.lobbyCount} finished · `}
                    {new Date(s.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {confirmDelete === s.id ? (
                    <>
                      <span className="text-xs text-slate-400">
                        {isBatch ? `Delete all ${totalInBatch} parts?` : 'Delete this room?'}
                      </span>
                      <button
                        onClick={() => handleDelete(s.id, s.code)}
                        disabled={deleting}
                        className="px-3 py-1.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        {deleting ? '…' : 'Delete'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => copyLink(s.code)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                        Copy link
                      </button>
                      {s.status === 'waiting' && (
                        <>
                          <Link
                            href={`/teacher/sessions/${s.id}/lobby`}
                            className="px-3 py-1.5 bg-violet-700 hover:bg-violet-600 text-white text-xs font-semibold rounded-lg transition-colors"
                          >
                            👁 Lobby
                          </Link>
                          <button
                            onClick={() => handleStart(s.id)}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-colors"
                          >
                            ▶ Start
                          </button>
                        </>
                      )}
                      {s.status === 'active' && (
                        <button
                          onClick={() => handleEnd(s.id)}
                          className="px-3 py-1.5 bg-red-800 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          ⏹ End
                        </button>
                      )}
                      {(s.status === 'active' || s.status === 'ended') && (
                        <Link
                          href={`/teacher/sessions/${s.id}`}
                          className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          View results
                        </Link>
                      )}
                      {s.status === 'ended' && (
                        <Link
                          href={`/s/${s.code}/podium`}
                          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-lg transition-colors"
                        >
                          Podium
                        </Link>
                      )}
                      <button
                        onClick={() => setConfirmDelete(s.id)}
                        className="px-1 text-slate-400 hover:text-red-400 text-sm transition-colors"
                      >
                        🗑
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
