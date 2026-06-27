'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { validateQuizSet } from '@/lib/quiz-loader';
import type { QuizSet } from '@/types/quiz';

type Status = 'idle' | 'loading' | 'saving' | 'success' | 'error';

export default function NewQuizPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [quiz, setQuiz] = useState<QuizSet | null>(null);
  const [pageRange, setPageRange] = useState('');
  const [autoDetect, setAutoDetect] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  async function handlePdf(file: File) {
    if (!file.name.endsWith('.pdf')) { setStatus('error'); setMessage('Vui lòng chọn file PDF.'); return; }
    setStatus('loading'); setMessage(''); setQuiz(null);
    const form = new FormData();
    form.append('file', file);
    form.append('pageRange', pageRange.trim());
    form.append('autoDetect', autoDetect ? 'true' : 'false');
    try {
      const res = await fetch('/api/extract-quiz', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) { setStatus('error'); setMessage(data.error ?? 'Trích xuất thất bại.'); return; }
      setQuiz(data as QuizSet);
      setStatus('success');
      setMessage(`Tìm thấy ${data.totalQuestions} câu trong "${data.title}"`);
    } catch { setStatus('error'); setMessage('Lỗi kết nối. Thử lại.'); }
  }

  async function handleJson(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = validateQuizSet(data);
      if (!result.valid) { setStatus('error'); setMessage(result.error ?? 'File JSON không hợp lệ.'); return; }
      setQuiz(data as QuizSet);
      setStatus('success');
      setMessage(`Tìm thấy ${data.totalQuestions} câu trong "${data.title}"`);
    } catch { setStatus('error'); setMessage('Không thể đọc file JSON.'); }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.name.endsWith('.pdf')) handlePdf(file);
    else if (file.name.endsWith('.json')) handleJson(file);
    else { setStatus('error'); setMessage('Chỉ chấp nhận file PDF hoặc JSON.'); }
  }

  async function handleSaveToDb() {
    if (!quiz) return;
    setStatus('saving');
    const res = await fetch('/api/quizzes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: quiz.title,
        description: quiz.description ?? '',
        source: quiz.source ?? '',
        timePerQuestion: quiz.timePerQuestion ?? 45,
        questions: quiz.questions,
        skippedSections: quiz.skippedSections ?? null,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      setStatus('error'); setMessage('Lưu thất bại: ' + (err.error ?? res.statusText)); return;
    }
    router.replace('/teacher');
  }

  const isLoading = status === 'loading';

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 sticky top-0 z-10 bg-slate-950/80 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/teacher" className="text-slate-500 hover:text-slate-300 text-sm">← Dashboard</Link>
          <span className="text-slate-700">/</span>
          <span className="text-white text-sm font-semibold">Upload đề mới</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Options */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Tuỳ chọn trích xuất PDF</p>
          <label className="flex items-center gap-3 cursor-pointer">
            <button type="button" role="switch" aria-checked={autoDetect} disabled={isLoading}
              onClick={() => setAutoDetect(!autoDetect)}
              className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${autoDetect ? 'bg-blue-600' : 'bg-slate-700'} disabled:opacity-50`}>
              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${autoDetect ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
            <span className="text-sm text-slate-300">Tự động phát hiện trang MCQ</span>
          </label>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-300 shrink-0">Trang (PDF)</span>
            <input type="text" placeholder="VD: 8-19 hoặc 8-19, 22-27" value={pageRange}
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
              <p className="text-blue-400 text-sm font-medium">Đang trích xuất câu hỏi…</p>
              <p className="text-slate-500 text-xs mt-1">Mất khoảng 15-30 giây</p></>
          ) : (
            <><p className="text-4xl mb-3">📄</p>
              <p className="text-slate-400 text-sm">Kéo thả PDF hoặc JSON vào đây, hoặc click để chọn</p>
              <p className="text-slate-600 text-xs mt-1">PDF (tự động trích xuất) · JSON (schema chuẩn)</p></>
          )}
          <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handlePdf(file); e.target.value = ''; }} />
          <input ref={jsonRef} type="file" accept=".json,application/json" className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handleJson(file); e.target.value = ''; }} />
        </div>

        <p className="text-center text-xs text-slate-600">
          Muốn import JSON?{' '}
          <button onClick={() => jsonRef.current?.click()} className="text-slate-400 hover:text-white underline">
            Chọn file JSON
          </button>
        </p>

        {status === 'error' && (
          <div className="bg-red-950 border border-red-800 rounded-xl p-4">
            <p className="text-red-400 text-sm">✗ {message}</p>
          </div>
        )}

        {(status === 'success' || status === 'saving') && quiz && (
          <div className="space-y-4">
            <div className="bg-emerald-950 border border-emerald-800 rounded-xl p-4 flex items-center justify-between gap-4">
              <p className="text-emerald-400 font-semibold text-sm">✓ {message}</p>
              <button
                onClick={handleSaveToDb}
                disabled={status === 'saving'}
                className="shrink-0 px-4 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {status === 'saving' ? 'Đang lưu…' : 'Lưu vào thư viện →'}
              </button>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Xem trước ({quiz.questions.length} câu)
              </p>
              {quiz.questions.slice(0, 5).map((q, idx) => (
                <div key={q.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                  <p className="text-white text-sm font-medium">{idx + 1}. {q.text}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {q.options.map((opt, j) => (
                      <div key={j} className={`text-xs px-2.5 py-1.5 rounded-lg border ${opt === q.answer ? 'bg-emerald-950 border-emerald-800 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                        {['A','B','C','D'][j]}. {opt}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {quiz.questions.length > 5 && (
                <p className="text-center text-slate-600 text-xs">+{quiz.questions.length - 5} câu nữa</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
