'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { validateQuizSet } from '@/lib/quiz-loader';
import { chunkByTargetGames } from '@/lib/chunk-by-target-games';
import type { QuizSet } from '@/types/quiz';

type Status = 'idle' | 'loading' | 'saving' | 'success' | 'error';

type BatchResult = {
  batchId: string;
  quizTitle: string;
  parts: { id: string; code: string; batchOrder: number; questionCount: number }[];
};

export default function NewQuizPage() {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [quiz, setQuiz] = useState<QuizSet | null>(null);
  const [pageRange, setPageRange] = useState('');
  const [autoDetect, setAutoDetect] = useState(true);
  const [targetGames, setTargetGames] = useState(4);
  const [expandedGames, setExpandedGames] = useState<Set<number>>(new Set());
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [copying, setCopying] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  function initQuiz(data: QuizSet) {
    setQuiz(data);
    setTargetGames(Math.max(1, Math.ceil(data.questions.length / 15)));
    setExpandedGames(new Set());
    setBatchResult(null);
  }

  async function handlePdf(file: File) {
    if (!file.name.endsWith('.pdf')) { setStatus('error'); setMessage('Please select a PDF file.'); return; }
    setStatus('loading'); setMessage(''); setQuiz(null);
    const form = new FormData();
    form.append('file', file);
    form.append('pageRange', pageRange.trim());
    form.append('autoDetect', autoDetect ? 'true' : 'false');
    try {
      const res = await fetch('/api/extract-quiz', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) { setStatus('error'); setMessage(data.error ?? 'Extraction failed.'); return; }
      initQuiz(data as QuizSet);
      setStatus('success');
      setMessage(`Found ${data.totalQuestions} questions in "${data.title}"`);
    } catch { setStatus('error'); setMessage('Connection error. Please try again.'); }
  }

  async function handleJson(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = validateQuizSet(data);
      if (!result.valid) { setStatus('error'); setMessage(result.error ?? 'Invalid JSON file.'); return; }
      initQuiz(data as QuizSet);
      setStatus('success');
      setMessage(`Found ${data.totalQuestions} questions in "${data.title}"`);
    } catch { setStatus('error'); setMessage('Cannot read JSON file.'); }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.name.endsWith('.pdf')) handlePdf(file);
    else if (file.name.endsWith('.json')) handleJson(file);
    else { setStatus('error'); setMessage('Only PDF or JSON files accepted.'); }
  }

  function toggleGame(order: number) {
    setExpandedGames(prev => {
      const next = new Set(prev);
      if (next.has(order)) {
        next.delete(order);
      } else {
        next.add(order);
      }
      return next;
    });
  }

  async function handleSaveAndBatch() {
    if (!quiz) return;
    setStatus('saving');
    setBatchResult(null);

    const basePayload = {
      description: quiz.description ?? '',
      source: quiz.source ?? '',
      timePerQuestion: quiz.timePerQuestion ?? 45,
      skippedSections: quiz.skippedSections ?? null,
    };

    try {
      const saveRes = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...basePayload, title: quiz.title, questions: quiz.questions }),
      });
      if (!saveRes.ok) {
        const err = await saveRes.json();
        throw new Error(err.error ?? saveRes.statusText);
      }
      const { id: quizId } = await saveRes.json();

      const batchRes = await fetch('/api/sessions/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId, targetGames }),
      });
      if (!batchRes.ok) {
        const err = await batchRes.json();
        throw new Error(err.error ?? batchRes.statusText);
      }
      const data = await batchRes.json();
      setBatchResult(data);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setMessage('Save failed: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopying(code);
      setTimeout(() => setCopying(null), 1500);
    } catch {
      // clipboard unavailable
    }
  }

  const isLoading = status === 'loading';
  const gameChunks = quiz ? chunkByTargetGames(quiz.questions, targetGames) : [];

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 sticky top-0 z-10 bg-slate-950/80 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/teacher" className="text-slate-500 hover:text-slate-300 text-sm">← Dashboard</Link>
          <span className="text-slate-700">/</span>
          <span className="text-white text-sm font-semibold">Upload new quiz</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Options */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">PDF Extraction Options</p>
          <label className="flex items-center gap-3 cursor-pointer">
            <button type="button" role="switch" aria-checked={autoDetect} disabled={isLoading}
              onClick={() => setAutoDetect(!autoDetect)}
              className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${autoDetect ? 'bg-blue-600' : 'bg-slate-700'} disabled:opacity-50`}>
              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${autoDetect ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
            <span className="text-sm text-slate-300">Auto-detect MCQ pages</span>
          </label>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-300 shrink-0">Pages (PDF)</span>
            <input type="text" placeholder="e.g. 8-19 or 8-19, 22-27" value={pageRange}
              onChange={(e) => setPageRange(e.target.value)} disabled={isLoading}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500 disabled:opacity-50" />
          </div>
        </div>

        {/* Drop zone */}
        <div onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}
          onClick={() => !isLoading && fileRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors ${isLoading ? 'border-blue-700 bg-blue-950/20 cursor-wait' : 'border-slate-700 hover:border-slate-500 cursor-pointer'}`}>
          {isLoading ? (
            <><div className="text-4xl mb-3 animate-pulse">⚙️</div>
              <p className="text-blue-400 text-sm font-medium">Extracting questions…</p>
              <p className="text-slate-500 text-xs mt-1">Takes about 15-30 seconds</p></>
          ) : (
            <><p className="text-4xl mb-3">📄</p>
              <p className="text-slate-400 text-sm">Drag PDF or JSON here, or click to select</p>
              <p className="text-slate-600 text-xs mt-1">PDF (auto-extract) · JSON (standard schema)</p></>
          )}
          <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handlePdf(file); e.target.value = ''; }} />
          <input ref={jsonRef} type="file" accept=".json,application/json" className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handleJson(file); e.target.value = ''; }} />
        </div>

        <p className="text-center text-xs text-slate-600">
          Import JSON?{' '}
          <button onClick={() => jsonRef.current?.click()} className="text-slate-400 hover:text-white underline">
            Select JSON file
          </button>
        </p>

        {status === 'error' && (
          <div className="bg-red-950 border border-red-800 rounded-xl p-4">
            <p className="text-red-400 text-sm">✗ {message}</p>
          </div>
        )}

        {(status === 'success' || status === 'saving') && quiz && (
          <div className="space-y-4">
            {/* Action banner */}
            <div className="bg-emerald-950 border border-emerald-800 rounded-xl p-4 space-y-3">
              <p className="text-emerald-400 font-semibold text-sm">✓ {message}</p>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">Chia thành</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={targetGames}
                  disabled={status === 'saving'}
                  onChange={(e) => setTargetGames(Math.max(1, Math.min(20, Number(e.target.value))))}
                  className="w-12 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-sm text-white text-center focus:outline-none focus:border-slate-500 disabled:opacity-40"
                />
                <span className="text-slate-400 text-sm">games (~{gameChunks.length > 0 ? Math.round(quiz.questions.length / gameChunks.length) : 0} câu/game)</span>
                <button
                  onClick={handleSaveAndBatch}
                  disabled={status === 'saving'}
                  className="ml-auto shrink-0 px-4 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {status === 'saving' ? 'Saving…' : `Lưu & Tạo ${gameChunks.length} batch →`}
                </button>
              </div>
            </div>

            {/* Grouped game preview */}
            <div className="space-y-2">
              {gameChunks.map((chunk, i) => {
                const order = i + 1;
                const isExpanded = expandedGames.has(order);
                return (
                  <div key={order} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleGame(order)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800 transition-colors"
                    >
                      <span className="text-slate-300 text-sm font-medium">
                        {isExpanded ? '▼' : '▶'} Game {order}
                      </span>
                      <span className="text-slate-500 text-xs">{chunk.length} câu</span>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-3 space-y-3 border-t border-slate-800">
                        {chunk.map((q, idx) => (
                          <div key={q.id} className="pt-3 space-y-2">
                            <p className="text-white text-sm font-medium">
                              {gameChunks.slice(0, i).reduce((sum, c) => sum + c.length, 0) + idx + 1}. {q.text}
                            </p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {q.options.map((opt, j) => (
                                <div key={j} className={`text-xs px-2.5 py-1.5 rounded-lg border ${opt === q.answer ? 'bg-emerald-950 border-emerald-800 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                                  {['A','B','C','D'][j]}. {opt}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {batchResult && (
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-4">
            <p className="text-emerald-400 font-semibold text-sm">
              ✓ Đã tạo {batchResult.parts.length} game từ {quiz?.questions.length ?? 0} câu — &quot;{batchResult.quizTitle}&quot;
            </p>
            <div className="space-y-2">
              {batchResult.parts.map((part) => (
                <div key={part.id} className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-2.5 gap-3">
                  <span className="text-slate-400 text-sm">Game {part.batchOrder}</span>
                  <span className="font-mono text-white text-sm tracking-widest">{part.code}</span>
                  <span className="text-slate-500 text-xs">{part.questionCount} câu</span>
                  <button
                    onClick={() => copyCode(part.code)}
                    className="text-xs px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md transition-colors"
                  >
                    {copying === part.code ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              ))}
            </div>
            <Link href="/teacher" className="inline-block text-sm text-slate-400 hover:text-white transition-colors">
              ← Về dashboard
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
