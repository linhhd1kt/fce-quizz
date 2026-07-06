'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { chunkByTargetGames } from '@/lib/chunk-by-target-games';
import type { QuizSet, MultipleChoiceQuestion } from '@/types/quiz';

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
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  function initQuiz(data: QuizSet) {
    setQuiz(data);
    setTargetGames(Math.max(1, Math.ceil(data.questions.length / 15)));
    setExpandedGames(new Set());
    setEditingIds(new Set());
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


  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.name.endsWith('.pdf')) handlePdf(file);
    else { setStatus('error'); setMessage('Only PDF files accepted.'); }
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

  function toggleEdit(id: string) {
    setEditingIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function updateQuestion(id: string, patch: Partial<MultipleChoiceQuestion>) {
    setQuiz(prev => {
      if (!prev) return prev;
      return { ...prev, questions: prev.questions.map(q => q.id === id ? { ...q, ...patch } : q) };
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
    <div className="bg-slate-50 dark:bg-slate-950">
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-slate-900 dark:text-white font-bold text-lg">Upload new quiz</h1>
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
              <p className="text-slate-400 text-sm">Drag PDF here, or click to select</p>
              <p className="text-slate-600 text-xs mt-1">PDF only (auto-extract)</p></>
          )}
          <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handlePdf(file); e.target.value = ''; }} />
        </div>

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
                <span className="text-slate-400 text-sm">Split into</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={targetGames}
                  disabled={status === 'saving'}
                  onChange={(e) => setTargetGames(Math.max(1, Math.min(20, Number(e.target.value))))}
                  className="w-12 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-sm text-white text-center focus:outline-none focus:border-slate-500 disabled:opacity-40"
                />
                <span className="text-slate-400 text-sm">games (~{gameChunks.length > 0 ? Math.round(quiz.questions.length / gameChunks.length) : 0} q/game)</span>
                <button
                  onClick={handleSaveAndBatch}
                  disabled={status === 'saving'}
                  className="ml-auto shrink-0 px-4 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {status === 'saving' ? 'Saving…' : `Save & create ${gameChunks.length} batches →`}
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
                      <span className="text-slate-500 text-xs">{chunk.length} questions</span>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-3 space-y-3 border-t border-slate-800">
                        {chunk.map((q, idx) => {
                          const globalIdx = gameChunks.slice(0, i).reduce((s, c) => s + c.length, 0) + idx;
                          const isEditing = editingIds.has(q.id);
                          return (
                            <div key={q.id} className="pt-3 border-t border-slate-800 first:border-t-0">
                              {isEditing ? (
                                <div className="space-y-3">
                                  <div className="space-y-1">
                                    <p className="text-xs text-slate-500 uppercase tracking-widest">Question text</p>
                                    <textarea
                                      rows={2}
                                      value={q.text}
                                      data-testid={`question-text-${q.id}`}
                                      onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                                      className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white outline-none resize-none"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xs text-slate-500 uppercase tracking-widest">Options</p>
                                    <div className="space-y-1.5">
                                      {q.options.map((opt, j) => (
                                        <div key={j} className="flex items-center gap-2">
                                          <input
                                            type="radio"
                                            name={`answer-${q.id}`}
                                            checked={q.answer === opt}
                                            onChange={() => updateQuestion(q.id, { answer: opt })}
                                            className="accent-emerald-500 shrink-0"
                                          />
                                          <span className="text-xs text-slate-500 w-4 shrink-0">{['A','B','C','D'][j]}.</span>
                                          <input
                                            type="text"
                                            value={opt}
                                            data-testid={`option-input-${q.id}-${j}`}
                                            onChange={(e) => {
                                              const newOpts = q.options.map((o, k) => k === j ? e.target.value : o);
                                              const newAnswer = q.answer === opt ? e.target.value : q.answer;
                                              updateQuestion(q.id, { options: newOpts, answer: newAnswer });
                                            }}
                                            className="flex-1 bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-lg px-2.5 py-1 text-xs text-white outline-none"
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xs text-slate-500 uppercase tracking-widest">Explanation</p>
                                    <textarea
                                      rows={2}
                                      placeholder="Add explanation (optional)…"
                                      value={q.explanation ?? ''}
                                      data-testid={`explanation-${q.id}`}
                                      onChange={(e) => updateQuestion(q.id, { explanation: e.target.value })}
                                      className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 outline-none resize-none"
                                    />
                                  </div>
                                  <div className="flex justify-end">
                                    <button
                                      onClick={() => toggleEdit(q.id)}
                                      className="px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-colors"
                                    >
                                      ✓ Done
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-white text-sm font-medium flex-1">
                                      {globalIdx + 1}. {q.text}
                                    </p>
                                    <button
                                      onClick={() => toggleEdit(q.id)}
                                      data-testid={`edit-btn-${q.id}`}
                                      className="shrink-0 text-slate-500 hover:text-slate-300 text-xs px-2 py-0.5 rounded border border-slate-700 hover:border-slate-500 transition-colors"
                                    >
                                      ✎
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-1.5">
                                    {q.options.map((opt, j) => (
                                      <div key={j} className={`text-xs px-2.5 py-1.5 rounded-lg border ${opt === q.answer ? 'bg-emerald-950 border-emerald-800 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                                        {['A','B','C','D'][j]}. {opt}
                                      </div>
                                    ))}
                                  </div>
                                  {q.explanation && (
                                    <p className="text-xs text-blue-300/70 px-2.5 py-1.5 rounded-lg bg-blue-950/30 border border-blue-900/50">
                                      💡 {q.explanation}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
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
              ✓ Created {batchResult.parts.length} games from {quiz?.questions.length ?? 0} questions — &quot;{batchResult.quizTitle}&quot;
            </p>
            <div className="space-y-2">
              {batchResult.parts.map((part) => (
                <div key={part.id} className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-2.5 gap-3">
                  <span className="text-slate-400 text-sm">Game {part.batchOrder}</span>
                  <span className="font-mono text-white text-sm tracking-widest">{part.code}</span>
                  <span className="text-slate-500 text-xs">{part.questionCount} questions</span>
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
              ← Back to dashboard
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
