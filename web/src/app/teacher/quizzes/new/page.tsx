'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type RangeItem = { id: string; name: string; from: number; to: number };
type PageStatus = 'idle' | 'detecting' | 'configuring' | 'creating' | 'error';

let _idCounter = 0;
function newId() { return `r-${++_idCounter}`; }

export default function NewQuizPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [timePerQuestion, setTimePerQuestion] = useState(45);
  const [status, setStatus] = useState<PageStatus>('idle');
  const [error, setError] = useState('');
  const [ranges, setRanges] = useState<RangeItem[]>([]);

  function setErr(msg: string) { setStatus('error'); setError(msg); }

  async function handleDetect(f: File) {
    if (!f.name.toLowerCase().endsWith('.pdf')) { setErr('Please select a PDF file.'); return; }
    setFile(f);
    setStatus('detecting');
    setError('');
    const form = new FormData();
    form.append('file', f);
    try {
      const res = await fetch('/api/extract-quiz/detect', { method: 'POST', body: form });
      const data = await res.json() as { ranges?: RangeItem[]; error?: string };
      if (!res.ok) { setErr(data.error ?? 'Detection failed.'); return; }
      if (!data.ranges || data.ranges.length === 0) {
        setRanges([{ id: newId(), name: 'Part 1', from: 1, to: 1 }]);
      } else {
        setRanges(data.ranges.map(r => ({ ...r, id: newId() })));
      }
      setStatus('configuring');
    } catch {
      setErr('Connection error. Please try again.');
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleDetect(f);
  }

  function updateRange(id: string, patch: Partial<RangeItem>) {
    setRanges(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  }

  function deleteRange(id: string) {
    setRanges(prev => prev.filter(r => r.id !== id));
  }

  function addRange() {
    const last = ranges[ranges.length - 1];
    setRanges(prev => [...prev, {
      id: newId(),
      name: `Part ${prev.length + 1}`,
      from: last ? last.to + 1 : 1,
      to: last ? last.to + 1 : 1,
    }]);
  }

  function mergeWithNext(idx: number) {
    if (idx >= ranges.length - 1) return;
    setRanges(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], to: next[idx + 1].to };
      next.splice(idx + 1, 1);
      return next;
    });
  }

  function splitRange(idx: number) {
    const r = ranges[idx];
    if (r.from >= r.to) return;
    const mid = Math.floor((r.from + r.to) / 2);
    setRanges(prev => {
      const next = [...prev];
      next.splice(idx, 1,
        { id: newId(), name: r.name, from: r.from, to: mid },
        { id: newId(), name: `${r.name} (b)`, from: mid + 1, to: r.to },
      );
      return next;
    });
  }

  const handleCreate = useCallback(async () => {
    if (!file || ranges.length === 0) return;
    setStatus('creating');
    setError('');
    const form = new FormData();
    form.append('file', file);
    form.append('ranges', JSON.stringify(ranges.map(r => ({ name: r.name, from: r.from, to: r.to }))));
    form.append('timePerQuestion', String(timePerQuestion));
    try {
      const res = await fetch('/api/extract-quiz/batch', { method: 'POST', body: form });
      const data = await res.json() as { quizzes?: unknown[]; error?: string };
      if (!res.ok) { setErr(data.error ?? 'Creation failed.'); return; }
      router.push('/teacher/quizzes');
    } catch {
      setErr('Connection error. Please try again.');
    }
  }, [file, ranges, timePerQuestion, router]);

  const isDetecting = status === 'detecting';
  const isCreating = status === 'creating';

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-slate-900 dark:text-white font-bold text-lg">Upload new quiz</h1>

      {/* Time per question — always visible */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600 dark:text-slate-400 shrink-0">Time per question</span>
        <input
          type="number"
          min={5}
          max={300}
          value={timePerQuestion}
          onChange={e => setTimePerQuestion(Math.max(5, Math.min(300, Number(e.target.value))))}
          disabled={isCreating}
          className="w-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white text-center focus:outline-none focus:border-blue-500 disabled:opacity-50"
        />
        <span className="text-sm text-slate-500">seconds</span>
      </div>

      {/* Drop zone — shown when idle or error before file selected */}
      {(status === 'idle' || (status === 'error' && !file)) && (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 rounded-2xl p-12 text-center cursor-pointer transition-colors"
        >
          <p className="text-4xl mb-3">📄</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Drag PDF here, or click to select</p>
          <p className="text-slate-400 dark:text-slate-600 text-xs mt-1">PDF only</p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleDetect(f); e.target.value = ''; }}
          />
        </div>
      )}

      {/* Detecting state */}
      {isDetecting && (
        <div className="border-2 border-dashed border-blue-400 dark:border-blue-700 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3 animate-pulse">🔍</p>
          <p className="text-blue-500 dark:text-blue-400 text-sm font-medium">Detecting MCQ sections…</p>
          <p className="text-slate-400 text-xs mt-1">{file?.name}</p>
        </div>
      )}

      {/* Creating state */}
      {isCreating && (
        <div className="border-2 border-dashed border-orange-400 dark:border-orange-700 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3 animate-pulse">⚙️</p>
          <p className="text-orange-500 dark:text-orange-400 text-sm font-medium">
            Creating {ranges.length} game{ranges.length !== 1 ? 's' : ''}… this may take a minute
          </p>
          <p className="text-slate-400 text-xs mt-1">{file?.name}</p>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start justify-between gap-3">
          <p className="text-red-600 dark:text-red-400 text-sm">✗ {error}</p>
          <button
            onClick={() => { setStatus('idle'); setFile(null); setRanges([]); }}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
          >
            Try again
          </button>
        </div>
      )}

      {/* Range configurator */}
      {status === 'configuring' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Detected {ranges.length} section{ranges.length !== 1 ? 's' : ''} · {file?.name}
            </p>
            <button
              onClick={() => { setStatus('idle'); setFile(null); setRanges([]); }}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Change file
            </button>
          </div>

          <div className="space-y-2">
            {ranges.map((r, idx) => (
              <div
                key={r.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3"
              >
                {/* Name + page range row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    value={r.name}
                    onChange={e => updateRange(r.id, { name: e.target.value })}
                    className="flex-1 min-w-32 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    placeholder="Game name"
                  />
                  <span className="text-xs text-slate-400 shrink-0">pages</span>
                  <input
                    type="number"
                    value={r.from}
                    min={1}
                    onChange={e => updateRange(r.id, { from: parseInt(e.target.value) || 1 })}
                    className="w-16 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-900 dark:text-white text-center focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-xs text-slate-400">–</span>
                  <input
                    type="number"
                    value={r.to}
                    min={r.from}
                    onChange={e => updateRange(r.id, { to: parseInt(e.target.value) || r.from })}
                    className="w-16 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-900 dark:text-white text-center focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {idx < ranges.length - 1 && (
                    <button
                      onClick={() => mergeWithNext(idx)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      Merge with next
                    </button>
                  )}
                  {r.from < r.to && (
                    <button
                      onClick={() => splitRange(idx)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      Split
                    </button>
                  )}
                  {ranges.length > 1 && (
                    <button
                      onClick={() => deleteRange(r.id)}
                      className="text-xs px-2.5 py-1 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors ml-auto"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={addRange}
            className="w-full py-2.5 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            + Add range
          </button>

          <button
            onClick={handleCreate}
            disabled={ranges.length === 0}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold text-sm rounded-xl transition-colors"
          >
            Extract & auto-split →
          </button>
        </div>
      )}
    </div>
  );
}
