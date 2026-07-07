'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

type PageStatus = 'idle' | 'detecting' | 'creating' | 'error';

export default function NewQuizPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<PageStatus>('idle');
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');

  function setErr(msg: string) { setStatus('error'); setError(msg); }

  async function handleFile(f: File) {
    if (!f.name.toLowerCase().endsWith('.pdf')) { setErr('Please select a PDF file.'); return; }
    setFileName(f.name);
    setStatus('detecting');
    setError('');

    // Step 1: detect page ranges
    const detectForm = new FormData();
    detectForm.append('file', f);
    let ranges: { name: string; from: number; to: number }[];
    try {
      const res = await fetch('/api/extract-quiz/detect', { method: 'POST', body: detectForm });
      const data = await res.json() as { ranges?: { name: string; from: number; to: number }[]; error?: string };
      if (!res.ok) { setErr(data.error ?? 'Detection failed.'); return; }
      ranges = data.ranges && data.ranges.length > 0
        ? data.ranges
        : [{ name: 'Part 1', from: 1, to: 9999 }];
    } catch {
      setErr('Connection error. Please try again.');
      return;
    }

    // Step 2: extract & auto-split
    setStatus('creating');
    const batchForm = new FormData();
    batchForm.append('file', f);
    batchForm.append('ranges', JSON.stringify(ranges));
    batchForm.append('timePerQuestion', '45');
    try {
      const res = await fetch('/api/extract-quiz/batch', { method: 'POST', body: batchForm });
      const data = await res.json() as { quizzes?: unknown[]; error?: string };
      if (!res.ok) { setErr(data.error ?? 'Extraction failed.'); return; }
      router.push('/teacher/quizzes');
    } catch {
      setErr('Connection error. Please try again.');
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-slate-900 dark:text-white font-bold text-lg">Upload new quiz</h1>

      {/* Drop zone */}
      {(status === 'idle' || (status === 'error' && !fileName)) && (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 rounded-2xl p-16 text-center cursor-pointer transition-colors"
        >
          <p className="text-4xl mb-3">📄</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Drag PDF here, or click to select</p>
          <p className="text-slate-400 dark:text-slate-600 text-xs mt-1">PDF only · 45s per question · auto-split ~15q/game</p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
          />
        </div>
      )}

      {/* Detecting */}
      {status === 'detecting' && (
        <div className="border-2 border-dashed border-blue-400 dark:border-blue-700 rounded-2xl p-16 text-center">
          <p className="text-4xl mb-3 animate-pulse">🔍</p>
          <p className="text-blue-500 dark:text-blue-400 text-sm font-medium">Detecting MCQ sections…</p>
          <p className="text-slate-400 text-xs mt-1">{fileName}</p>
        </div>
      )}

      {/* Extracting & splitting */}
      {status === 'creating' && (
        <div className="border-2 border-dashed border-orange-400 dark:border-orange-700 rounded-2xl p-16 text-center">
          <p className="text-4xl mb-3 animate-pulse">⚙️</p>
          <p className="text-orange-500 dark:text-orange-400 text-sm font-medium">Extracting & splitting into games… this may take a minute</p>
          <p className="text-slate-400 text-xs mt-1">{fileName}</p>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start justify-between gap-3">
          <p className="text-red-600 dark:text-red-400 text-sm">✗ {error}</p>
          <button
            onClick={() => { setStatus('idle'); setFileName(''); setError(''); }}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
