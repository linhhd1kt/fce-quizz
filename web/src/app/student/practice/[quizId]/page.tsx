'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type Screen = 'loading' | 'empty' | 'ready' | 'playing' | 'finished';

interface PracticeQuestion {
  id: string;
  text: string;
  options: string[];
  answer: string;
  explanation: string | null;
  easeFactor: number;
  repetitions: number;
}

interface PracticeAnswer {
  questionId: string;
  isCorrect: boolean;
}

interface PlayState {
  phase: 'question' | 'feedback';
  questionIndex: number;
  selected: string | null;
  answers: PracticeAnswer[];
}

const TILES = [
  { bg: '#8db600', shadow: 'rgba(141,182,0,0.4)' },
  { bg: '#8a4fd0', shadow: 'rgba(138,79,208,0.4)' },
  { bg: '#e86020', shadow: 'rgba(232,96,32,0.4)' },
  { bg: '#00c9a7', shadow: 'rgba(0,201,167,0.4)' },
] as const;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function PracticePage() {
  const { quizId } = useParams<{ quizId: string }>();
  const [screen, setScreen] = useState<Screen>('loading');
  const [quizTitle, setQuizTitle] = useState('');
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [nextReviewAt, setNextReviewAt] = useState<string | null>(null);
  const [play, setPlay] = useState<PlayState>({
    phase: 'question',
    questionIndex: 0,
    selected: null,
    answers: [],
  });
  const [finalScore, setFinalScore] = useState(0);

  useEffect(() => {
    fetch(`/api/student/practice/${quizId}`)
      .then((r) => r.json())
      .then((data) => {
        setQuizTitle(data.quizTitle ?? '');
        if (data.dueCount === 0) {
          setNextReviewAt(data.nextReviewAt);
          setScreen('empty');
        } else {
          setQuestions(data.questions);
          setScreen('ready');
        }
      })
      .catch(() => setScreen('empty'));
  }, [quizId]);

  const submitAnswer = useCallback(
    (selected: string | null) => {
      const q = questions[play.questionIndex];
      const isCorrect = selected === q.answer;
      setPlay((prev) => ({
        ...prev,
        phase: 'feedback',
        selected,
        answers: [...prev.answers, { questionId: q.id, isCorrect }],
      }));
    },
    [questions, play.questionIndex]
  );

  async function nextQuestion() {
    const next = play.questionIndex + 1;
    if (next >= questions.length) {
      const allAnswers = play.answers;
      await fetch(`/api/student/practice/${quizId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: allAnswers }),
      });
      setFinalScore(allAnswers.filter((a) => a.isCorrect).length);
      setScreen('finished');
    } else {
      setPlay((prev) => ({
        ...prev,
        phase: 'question',
        questionIndex: next,
        selected: null,
      }));
    }
  }

  if (screen === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Đang tải…
      </div>
    );
  }

  if (screen === 'empty') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <p className="text-5xl">🎉</p>
          <h1 className="text-xl font-bold">Không có gì để ôn hôm nay!</h1>
          {nextReviewAt && (
            <p className="text-slate-400 text-sm">Lần ôn tiếp: {formatDate(nextReviewAt)}</p>
          )}
          <Link href="/student/profile" className="block text-blue-400 hover:underline text-sm mt-4">
            ← Về trang cá nhân
          </Link>
        </div>
      </div>
    );
  }

  if (screen === 'finished') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center space-y-4 max-w-sm">
          <p className="text-5xl">{finalScore === questions.length ? '🏆' : '📚'}</p>
          <h1 className="text-2xl font-bold">
            {finalScore}/{questions.length} đúng
          </h1>
          <p className="text-slate-400 text-sm">SM-2 đã cập nhật lịch ôn tập.</p>
          <Link href="/student/profile" className="block text-blue-400 hover:underline text-sm mt-4">
            ← Về trang cá nhân
          </Link>
        </div>
      </div>
    );
  }

  if (screen === 'ready') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center space-y-6 max-w-sm px-6">
          <div>
            <h1 className="text-xl font-bold truncate">{quizTitle}</h1>
            <p className="text-slate-400 text-sm mt-1">{questions.length} câu cần ôn hôm nay</p>
          </div>
          <button
            onClick={() => setScreen('playing')}
            className="w-full py-3 rounded-2xl font-bold text-white"
            style={{ background: '#8db600' }}
          >
            Bắt đầu ôn tập
          </button>
          <Link href="/student/profile" className="block text-slate-500 hover:text-slate-300 text-sm">
            ← Về trang cá nhân
          </Link>
        </div>
      </div>
    );
  }

  // playing
  const q = questions[play.questionIndex];
  const isCorrect = play.selected === q.answer;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="px-4 pt-6 pb-2 max-w-xl mx-auto w-full">
        <div className="flex justify-between items-center text-sm text-slate-500 mb-3">
          <span>{quizTitle}</span>
          <span>{play.questionIndex + 1}/{questions.length}</span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${((play.questionIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </header>

      {/* Question */}
      <main className="flex-1 flex flex-col max-w-xl mx-auto w-full px-4 py-6 gap-6">
        <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800">
          <p className="text-white font-medium leading-relaxed">{q.text}</p>
        </div>

        {play.phase === 'question' ? (
          <div className="grid grid-cols-2 gap-3">
            {q.options.map((opt, i) => (
              <button
                key={opt}
                onClick={() => submitAnswer(opt)}
                className="rounded-2xl p-4 text-white font-semibold text-sm text-left"
                style={{ background: TILES[i % 4].bg }}
              >
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {q.options.map((opt, i) => {
                const isSelected = opt === play.selected;
                const isAns = opt === q.answer;
                const opacity = !isSelected && !isAns ? 0.35 : 1;
                const outline = isAns ? '3px solid white' : isSelected && !isCorrect ? '3px solid #ef4444' : 'none';
                return (
                  <div
                    key={opt}
                    className="rounded-2xl p-4 text-white font-semibold text-sm"
                    style={{ background: TILES[i % 4].bg, opacity, outline }}
                  >
                    {opt}
                  </div>
                );
              })}
            </div>

            <div className={`rounded-2xl p-4 border ${isCorrect ? 'border-green-600 bg-green-950/40' : 'border-red-600 bg-red-950/40'}`}>
              <p className="font-bold text-sm mb-1">{isCorrect ? '✓ Đúng!' : '✗ Sai'}</p>
              {q.explanation && <p className="text-slate-300 text-sm">{q.explanation}</p>}
            </div>

            <button
              onClick={nextQuestion}
              className="w-full py-3 rounded-2xl font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
            >
              {play.questionIndex + 1 < questions.length ? 'Tiếp theo →' : 'Kết thúc'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
