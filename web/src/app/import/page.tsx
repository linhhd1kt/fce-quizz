'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { validateQuizSet, saveImportedQuizSet } from '@/lib/quiz-loader';
import type { QuizSet } from '@/types/quiz';
import { useI18n } from '@/i18n';

type Status = 'idle' | 'success' | 'error';

export default function ImportPage() {
  const { msgs, i } = useI18n();
  const m = msgs.import;
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [imported, setImported] = useState<QuizSet | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = validateQuizSet(data);
      if (!result.valid) {
        setStatus('error');
        setMessage(result.error ?? m.invalidFormat);
        return;
      }
      const quiz = data as QuizSet;
      saveImportedQuizSet(quiz);
      setImported(quiz);
      setStatus('success');
      setMessage(i(m.successMsg, { title: quiz.title, count: quiz.questions.length }));
    } catch {
      setStatus('error');
      setMessage(m.parseError);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="font-bold text-white text-xl">{m.title}</h1>
        <p className="text-slate-500 text-sm mt-1">{m.subtitle}</p>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-slate-700 hover:border-slate-500 rounded-2xl p-12 text-center cursor-pointer transition-colors"
      >
        <p className="text-4xl mb-3">📂</p>
        <p className="text-slate-400 text-sm">{m.dropZone}</p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {status === 'success' && imported && (
        <div className="bg-emerald-950 border border-emerald-800 rounded-xl p-4 space-y-2">
          <p className="text-emerald-400 font-semibold text-sm">✓ {message}</p>
          <Link
            href={`/quiz/${imported.id}`}
            className="inline-block text-sm text-white bg-emerald-700 hover:bg-emerald-600 px-4 py-1.5 rounded-lg transition-colors"
          >
            {m.startQuiz}
          </Link>
        </div>
      )}
      {status === 'error' && (
        <div className="bg-red-950 border border-red-800 rounded-xl p-4">
          <p className="text-red-400 text-sm">✗ {message}</p>
        </div>
      )}

      <details className="text-sm text-slate-500">
        <summary className="cursor-pointer hover:text-slate-300 transition-colors">
          {m.schemaRef}
        </summary>
        <pre className="mt-3 bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 overflow-x-auto">{`{
  "id": "my-quiz-1",
  "title": "My Quiz Title",
  "description": "Description shown on home page",
  "source": "Source name",
  "totalQuestions": 2,
  "timePerQuestion": 45,
  "questions": [
    {
      "id": "q1",
      "type": "multiple-choice",
      "text": "Question text here",
      "context": "Optional passage (shown above the question)",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": "Option A",
      "explanation": "Optional explanation shown after answering"
    }
  ]
}`}</pre>
      </details>

      <Link href="/" className="block text-center text-slate-500 hover:text-slate-300 text-sm">
        {m.backHome}
      </Link>
    </div>
  );
}
