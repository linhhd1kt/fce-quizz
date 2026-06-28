'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { MultipleChoiceQuestion } from '@/types/quiz';

interface QuizRow {
  id: string;
  title: string;
  questions: MultipleChoiceQuestion[];
  time_per_question: number;
}

export default function EditQuizPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [quiz, setQuiz] = useState<QuizRow | null>(null);
  const [questions, setQuestions] = useState<MultipleChoiceQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/quizzes/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) { setError('Không tìm thấy bộ đề.'); return; }
        setQuiz(data);
        setQuestions(data.questions as MultipleChoiceQuestion[]);
      });
  }, [id]);

  function updateExplanation(idx: number, value: string) {
    setQuestions((prev) => prev.map((q, i) => i === idx ? { ...q, explanation: value } : q));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    const res = await fetch(`/api/quizzes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions }),
    });
    setSaving(false);
    if (!res.ok) { setError('Lưu thất bại.'); return; }
    setSaved(true);
  }

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-950 px-4">
      <p className="text-red-400">{error}</p>
      <Link href="/teacher" className="text-blue-400 hover:underline text-sm">← Dashboard</Link>
    </div>
  );

  if (!quiz) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <p className="text-slate-500 text-sm">Đang tải…</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 sticky top-0 z-10 bg-slate-950/80 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/teacher" className="text-slate-500 hover:text-slate-300 text-sm shrink-0">← Dashboard</Link>
            <span className="text-slate-700">/</span>
            <span className="text-white text-sm font-semibold truncate">{quiz.title}</span>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {saving ? 'Đang lưu…' : saved ? '✓ Đã lưu' : 'Lưu thay đổi'}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-3">
        <p className="text-slate-500 text-xs uppercase tracking-widest font-semibold">
          {questions.length} câu — Chỉnh sửa giải thích
        </p>
        {questions.map((q, idx) => (
          <div key={q.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="shrink-0 text-slate-600 text-xs font-bold w-5 mt-0.5">{idx + 1}.</span>
              <p className="text-white text-sm leading-snug">{q.text}</p>
            </div>
            <div className="pl-8 flex items-center gap-2 flex-wrap">
              {q.options.map((opt, j) => (
                <span key={j}
                  className={`text-xs px-2 py-0.5 rounded-md border ${opt === q.answer ? 'bg-emerald-950 border-emerald-800 text-emerald-300 font-semibold' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                  {['A', 'B', 'C', 'D'][j]}. {opt}
                </span>
              ))}
            </div>
            <div className="pl-8">
              <textarea
                rows={2}
                placeholder="Nhập giải thích (để trống nếu không cần)…"
                value={q.explanation ?? ''}
                onChange={(e) => updateExplanation(idx, e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 focus:border-blue-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 outline-none resize-none transition-colors"
              />
            </div>
          </div>
        ))}
        <div className="pb-8 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {saving ? 'Đang lưu…' : saved ? '✓ Đã lưu' : 'Lưu thay đổi'}
          </button>
        </div>
      </main>
    </div>
  );
}
