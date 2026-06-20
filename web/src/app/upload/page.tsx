'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { saveImportedQuizSet } from '@/lib/quiz-loader';
import type { QuizSet } from '@/types/quiz';

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function UploadPage() {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [quiz, setQuiz] = useState<QuizSet | null>(null);
  const [saved, setSaved] = useState(false);
  const [pageRange, setPageRange] = useState('');
  const [autoDetect, setAutoDetect] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.endsWith('.pdf')) {
      setStatus('error');
      setMessage('Please select a PDF file.');
      return;
    }

    setStatus('loading');
    setMessage('');
    setQuiz(null);
    setSaved(false);

    const form = new FormData();
    form.append('file', file);
    form.append('pageRange', pageRange.trim());
    form.append('autoDetect', autoDetect ? 'true' : 'false');

    try {
      const res = await fetch('/api/extract-quiz', { method: 'POST', body: form });
      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setMessage(data.error ?? 'Extraction failed.');
        return;
      }

      setQuiz(data as QuizSet);
      setStatus('success');
      setMessage(`Found ${data.totalQuestions} questions in "${data.title}"`);
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  }

  function handleSave() {
    if (!quiz) return;
    saveImportedQuizSet(quiz);
    setSaved(true);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  const isLoading = status === 'loading';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-bold text-white text-xl">PDF → Quiz</h1>
        <p className="text-slate-500 text-sm mt-1">
          Upload a PDF — AI will extract multiple-choice questions automatically.
        </p>
      </div>

      {/* Options */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Extraction options</p>

        {/* Auto-detect toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            role="switch"
            aria-checked={autoDetect}
            disabled={isLoading}
            onClick={() => setAutoDetect(!autoDetect)}
            className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${
              autoDetect ? 'bg-blue-600' : 'bg-slate-700'
            } disabled:opacity-50`}
          >
            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
              autoDetect ? 'translate-x-4' : 'translate-x-0'
            }`} />
          </button>
          <span className="text-sm text-slate-300">
            Auto-detect MCQ pages
            <span className="text-slate-500 ml-1.5">— skip Writing, Speaking, open cloze</span>
          </span>
        </label>

        {/* Page range */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-300 shrink-0">Page range</span>
          <input
            type="text"
            placeholder="e.g. 8-19 or 8-19, 22-27"
            value={pageRange}
            onChange={(e) => setPageRange(e.target.value)}
            disabled={isLoading}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500 disabled:opacity-50"
          />
        </div>
        <p className="text-xs text-slate-600">
          Specifying a page range overrides auto-detect and processes only those pages.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !isLoading && fileRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors
          ${isLoading
            ? 'border-blue-700 bg-blue-950/20 cursor-wait'
            : 'border-slate-700 hover:border-slate-500 cursor-pointer'
          }`}
      >
        {isLoading ? (
          <>
            <div className="text-4xl mb-3 animate-pulse">⚙️</div>
            <p className="text-blue-400 text-sm font-medium">Extracting questions…</p>
            <p className="text-slate-500 text-xs mt-1">This may take 15-30 seconds</p>
          </>
        ) : (
          <>
            <p className="text-4xl mb-3">📄</p>
            <p className="text-slate-400 text-sm">Drop a PDF here, or click to browse</p>
            <p className="text-slate-600 text-xs mt-1">Max 100MB</p>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </div>

      {/* Error */}
      {status === 'error' && (
        <div className="bg-red-950 border border-red-800 rounded-xl p-4">
          <p className="text-red-400 text-sm">✗ {message}</p>
        </div>
      )}

      {/* Success: quiz preview */}
      {status === 'success' && quiz && (
        <div className="space-y-4">
          <div className="bg-emerald-950 border border-emerald-800 rounded-xl p-4 flex items-center justify-between gap-4">
            <p className="text-emerald-400 font-semibold text-sm">✓ {message}</p>
            <div className="flex gap-2 shrink-0">
              {!saved ? (
                <button
                  onClick={handleSave}
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Save to Library
                </button>
              ) : (
                <Link
                  href={`/quiz/${quiz.id}`}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Start Quiz →
                </Link>
              )}
            </div>
          </div>

          {/* Question preview */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Preview ({quiz.questions.length} questions)
            </p>
            {quiz.questions.slice(0, 5).map((q, i) => (
              <div key={q.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                <p className="text-white text-sm font-medium">{i + 1}. {q.text}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {q.options.map((opt, j) => (
                    <div
                      key={j}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border ${
                        opt === q.answer
                          ? 'bg-emerald-950 border-emerald-800 text-emerald-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      {['A', 'B', 'C', 'D'][j]}. {opt}
                    </div>
                  ))}
                </div>
                {q.explanation && (
                  <p className="text-xs text-slate-500 italic border-t border-slate-800 pt-2">
                    {q.explanation}
                  </p>
                )}
              </div>
            ))}
            {quiz.questions.length > 5 && (
              <p className="text-center text-slate-600 text-xs">
                +{quiz.questions.length - 5} more questions
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-4 text-sm text-slate-500">
        <Link href="/" className="hover:text-slate-300">← Home</Link>
        <Link href="/import" className="hover:text-slate-300">Import JSON →</Link>
      </div>
    </div>
  );
}
