'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { calculateScore } from '@/lib/scoring';
import type { QuizRow, UserAnswer, AttemptRow } from '@/types/quiz';
import type { MultipleChoiceQuestion } from '@/types/quiz';

// Wayground tile colors
const TILES = [
  { bg: '#8db600', shadow: 'rgba(141,182,0,0.4)' },
  { bg: '#8a4fd0', shadow: 'rgba(138,79,208,0.4)' },
  { bg: '#e86020', shadow: 'rgba(232,96,32,0.4)' },
  { bg: '#00c9a7', shadow: 'rgba(0,201,167,0.4)' },
] as const;

type Screen = 'join' | 'countdown' | 'playing' | 'finished' | 'results';
type Phase = 'question' | 'feedback';

interface PlayState {
  phase: Phase;
  questionIndex: number;
  selected: string | null;
  timeLeft: number;
  answers: UserAnswer[];
  questionStartedAt: number;
}

function GridPattern() {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{
      backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
      backgroundSize: '48px 48px',
    }} />
  );
}

export default function StudentSessionPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>('join');
  const [sessionId, setSessionId] = useState('');
  const [quiz, setQuiz] = useState<QuizRow | null>(null);
  const [studentName, setStudentName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [loadError, setLoadError] = useState('');
  const [countdown, setCountdown] = useState(3);
  const [savedAttemptId, setSavedAttemptId] = useState('');
  const [history, setHistory] = useState<AttemptRow[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [play, setPlay] = useState<PlayState>({
    phase: 'question',
    questionIndex: 0,
    selected: null,
    timeLeft: 45,
    answers: [],
    questionStartedAt: Date.now(),
  });

  // Load session on mount
  useEffect(() => {
    fetch(`/api/sessions/by-code/${code}`)
      .then((r) => r.ok ? r.json() : null)
      .then((s) => {
        if (!s) { setLoadError('Không tìm thấy phòng thi hoặc phòng đã đóng.'); return; }
        setSessionId(s.id);
        setQuiz(s.quizzes);
      });
  }, [code]);

  // Countdown timer
  useEffect(() => {
    if (screen !== 'countdown') return;
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(t); setScreen('playing'); return 3; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [screen]);

  // Question timer
  const timePerQ = quiz?.time_per_question ?? 45;

  const submitAnswer = useCallback((selected: string | null) => {
    if (!quiz) return;
    if (timerRef.current) clearInterval(timerRef.current);
    const q = quiz.questions[play.questionIndex] as MultipleChoiceQuestion;
    const answer: UserAnswer = {
      questionId: q.id,
      selected: selected ?? '',
      correct: selected === q.answer,
      timeSpent: Date.now() - play.questionStartedAt,
    };
    setPlay((prev) => ({ ...prev, phase: 'feedback', selected, answers: [...prev.answers, answer] }));
  }, [quiz, play.questionIndex, play.questionStartedAt]);

  useEffect(() => {
    if (screen !== 'playing' || play.phase !== 'question') return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setPlay((prev) => {
        if (prev.phase !== 'question') return prev;
        if (prev.timeLeft <= 1) { clearInterval(timerRef.current!); return { ...prev, timeLeft: 0 }; }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [screen, play.phase, play.questionIndex]);

  useEffect(() => {
    if (screen === 'playing' && play.phase === 'question' && play.timeLeft === 0) {
      submitAnswer(null);
    }
  }, [screen, play.phase, play.timeLeft, submitAnswer]);

  async function nextQuestion() {
    if (!quiz) return;
    const next = play.questionIndex + 1;
    if (next >= quiz.questions.length) {
      // Save to Supabase
      const score = calculateScore(play.answers);
      const res = await fetch('/api/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          quizId: quiz.id,
          studentName,
          score,
          totalQuestions: quiz.questions.length,
          timeSpentMs: play.answers.reduce((s, a) => s + a.timeSpent, 0),
          answers: play.answers,
        }),
      });
      if (res.ok) { const data = await res.json(); setSavedAttemptId(data.id); }
      setScreen('finished');
    } else {
      setPlay((prev) => ({
        ...prev,
        phase: 'question',
        questionIndex: next,
        selected: null,
        timeLeft: timePerQ,
        questionStartedAt: Date.now(),
      }));
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const name = nameInput.trim();
    if (!name) return;
    setStudentName(name);
    // Initialize play state
    setPlay({ phase: 'question', questionIndex: 0, selected: null, timeLeft: timePerQ, answers: [], questionStartedAt: Date.now() });
    setScreen('countdown');
    setCountdown(3);
  }

  async function showResults() {
    const res = await fetch(`/api/attempts?sessionId=${sessionId}&studentName=${encodeURIComponent(studentName)}`);
    const data = await res.json();
    setHistory(data as AttemptRow[]);
    setScreen('results');
  }

  // ── LOAD ERROR ──────────────────────────────────────────────────────────────
  if (loadError) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-950 px-4">
      <p className="text-red-400 text-center">{loadError}</p>
      <Link href="/" className="text-blue-400 hover:underline text-sm">← Trang chủ</Link>
    </div>
  );

  if (!quiz) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <p className="text-slate-500 text-sm">Đang tải phòng thi…</p>
    </div>
  );

  // ── JOIN ─────────────────────────────────────────────────────────────────────
  if (screen === 'join') return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-4" style={{ background: '#2d0a1e' }}>
      <GridPattern />
      <div className="relative w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold text-orange-400 bg-orange-400/10 border border-orange-400/30">
            {code.toUpperCase()}
          </span>
          <h1 className="text-white text-2xl font-bold">{quiz.title}</h1>
          <p className="text-white/40 text-sm">{quiz.questions.length} câu · {quiz.time_per_question}s/câu</p>
        </div>
        <form onSubmit={handleJoin} className="space-y-4">
          <input
            type="text"
            required
            autoFocus
            placeholder="Nhập tên của bạn…"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            className="w-full text-center text-white text-xl font-bold bg-white/5 border-2 border-white/20 focus:border-white/60 rounded-2xl px-6 py-4 outline-none transition-colors placeholder-white/20"
          />
          <button
            type="submit"
            className="w-full py-4 rounded-2xl text-white font-black text-xl transition hover:brightness-110 active:scale-95"
            style={{ background: '#e86020', boxShadow: 'rgba(232,96,32,0.4) 0 4px 20px' }}
          >
            Vào phòng →
          </button>
        </form>
      </div>
    </div>
  );

  // ── COUNTDOWN ───────────────────────────────────────────────────────────────
  if (screen === 'countdown') return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background: '#2d0a1e' }}>
      <GridPattern />
      <p className="relative text-white/50 text-base font-medium mb-4">{studentName}</p>
      <p className="relative text-white/30 text-sm mb-10">{quiz.title}</p>
      <div className="relative w-40 h-40 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-4 border-white/10 animate-ping" />
        <div className="absolute inset-0 rounded-full border-4 border-white/20" />
        <span className="relative text-9xl font-black text-white">{countdown}</span>
      </div>
      <p className="relative text-white/30 text-sm mt-10">Chuẩn bị…</p>
    </div>
  );

  // ── FINISHED ────────────────────────────────────────────────────────────────
  if (screen === 'finished') {
    const score = calculateScore(play.answers);
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6" style={{ background: '#2d0a1e' }}>
        <GridPattern />
        <div className="relative text-7xl">🎉</div>
        <p className="relative text-white text-2xl font-bold">Hoàn thành!</p>
        <p className="relative text-white/60">{studentName} · {score}%</p>
        <button
          onClick={showResults}
          className="relative px-10 py-3.5 rounded-2xl text-white font-bold text-lg transition hover:brightness-110"
          style={{ background: '#e86020' }}
        >
          Xem kết quả →
        </button>
      </div>
    );
  }

  // ── RESULTS ─────────────────────────────────────────────────────────────────
  if (screen === 'results') {
    return (
      <div className="min-h-screen bg-slate-950">
        <header className="border-b border-slate-800 sticky top-0 z-10 bg-slate-950/80 backdrop-blur">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="text-slate-500 hover:text-slate-300 text-sm">← Trang chủ</Link>
            <span className="text-white text-sm font-semibold">{studentName}</span>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
          <div className="text-center space-y-1">
            <p className="text-slate-500 text-sm">{quiz.title}</p>
            <p className="text-5xl font-black text-white">{calculateScore(play.answers)}%</p>
          </div>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Lịch sử làm bài</h2>
            {history.map((a, idx) => {
              const correct = (a.answers as { correct: boolean }[]).filter((x) => x.correct).length;
              return (
                <div key={a.id} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-4">
                  <span className="text-slate-600 text-xs w-4">{idx + 1}</span>
                  <div className="flex-1">
                    <p className="text-slate-400 text-xs">
                      {new Date(a.completed_at).toLocaleString('vi-VN')} · {correct}/{a.total_questions} đúng
                    </p>
                  </div>
                  <span className={`font-bold text-sm ${a.score >= 75 ? 'text-emerald-400' : a.score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {a.score}%
                  </span>
                </div>
              );
            })}
          </section>

          <button
            onClick={() => {
              setPlay({ phase: 'question', questionIndex: 0, selected: null, timeLeft: timePerQ, answers: [], questionStartedAt: Date.now() });
              setScreen('countdown');
              setCountdown(3);
            }}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            Làm lại
          </button>
        </main>
      </div>
    );
  }

  // ── PLAYING ─────────────────────────────────────────────────────────────────
  const q = quiz.questions[play.questionIndex] as MultipleChoiceQuestion;
  const pct = (play.timeLeft / timePerQ) * 100;
  const revealed = play.phase === 'feedback';
  const isCorrect = revealed && play.selected === q.answer;
  const isTimeout = revealed && play.selected === null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#2d0a1e' }}>
      <GridPattern />
      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 h-12 shrink-0">
        <span className="text-white/40 text-sm">{studentName}</span>
        <span className="text-white/40 text-sm font-medium">{play.questionIndex + 1}/{quiz.questions.length}</span>
      </div>
      {/* Timer bar */}
      <div className="relative z-10 mx-4 h-1.5 rounded-full shrink-0 overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
        <div className="h-full rounded-full transition-all duration-1000" style={{
          width: `${pct}%`,
          background: pct > 50 ? '#22c55e' : pct > 25 ? '#f59e0b' : '#ef4444',
        }} />
      </div>
      {/* Question zone */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-4 min-h-0">
        <div className="mb-3 px-5 py-1.5 rounded-full text-sm font-bold text-white" style={{ background: '#1a0815', border: '2px solid rgba(255,255,255,0.15)' }}>
          {play.questionIndex + 1} / {quiz.questions.length}
        </div>
        <div className="w-full max-w-3xl rounded-2xl px-8 py-5 text-center" style={{ background: '#1a0815' }}>
          <p className={`text-sm font-semibold mb-2 ${revealed ? (isCorrect ? 'text-green-400' : 'text-red-400') : 'invisible'}`}>
            {isTimeout ? `⏰ Hết giờ! Đáp án: ${q.answer}` : isCorrect ? '🎉 Chính xác!' : `😔 Sai — Đáp án: ${q.answer}`}
          </p>
          {q.context && <p className="text-white/50 text-xs mb-3 text-left leading-relaxed line-clamp-3">{q.context}</p>}
          <p className="text-white text-xl md:text-2xl font-bold leading-snug">{q.text}</p>
          <p className={`text-white/30 text-xs mt-3 ${revealed ? 'invisible' : ''}`}>{play.timeLeft}s</p>
        </div>
        <div className={`mt-3 w-full max-w-3xl rounded-xl px-5 py-3 text-sm text-blue-200 text-center ${revealed && q.explanation ? 'visible' : 'invisible'}`}
          style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', minHeight: '3rem' }}>
          {q.explanation}
        </div>
      </div>
      {/* Tiles */}
      <div className="relative z-10 grid gap-3 p-3 shrink-0" style={{
        gridTemplateColumns: q.options.length <= 2 ? 'repeat(2, 1fr)' : `repeat(${Math.min(q.options.length, 4)}, 1fr)`,
        minHeight: '38vh',
      }}>
        {q.options.map((opt, idx) => {
          const tile = TILES[idx % TILES.length];
          const isThisCorrect = opt === q.answer;
          let opacity = 1, outline = 'none', brightness = '';
          if (revealed) { if (isThisCorrect) outline = '3px solid rgba(255,255,255,0.8)'; else opacity = 0.28; }
          else brightness = 'hover:brightness-115';
          return (
            <button key={opt} disabled={revealed}
              onClick={() => { if (play.phase === 'question') submitAnswer(opt); }}
              className={`relative rounded-2xl flex flex-col items-center justify-center transition-all duration-150 active:scale-95 ${brightness} ${revealed ? 'cursor-default' : 'cursor-pointer'}`}
              style={{ background: `linear-gradient(150deg, ${tile.bg}ee, ${tile.bg}aa)`, boxShadow: revealed && isThisCorrect ? `0 0 24px ${tile.shadow}, 0 4px 16px rgba(0,0,0,0.4)` : '0 4px 16px rgba(0,0,0,0.3)', opacity, outline }}>
              <span className="absolute top-2.5 right-2.5 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(0,0,0,0.25)', color: 'rgba(255,255,255,0.9)' }}>
                {idx + 1}
              </span>
              {revealed && isThisCorrect && <span className="text-3xl mb-1 drop-shadow">✓</span>}
              {revealed && play.selected === opt && !isThisCorrect && <span className="text-3xl mb-1 drop-shadow">✗</span>}
              <span className="text-white font-bold text-lg md:text-xl text-center px-4 leading-snug drop-shadow-md">{opt}</span>
            </button>
          );
        })}
      </div>
      {/* Next button */}
      <div className={`relative z-10 flex justify-center pb-4 pt-2 shrink-0 ${revealed ? 'visible' : 'invisible'}`}>
        <button onClick={nextQuestion}
          className="px-12 py-3.5 rounded-2xl text-white font-bold text-base transition hover:brightness-110 active:scale-95 shadow-lg"
          style={{ background: '#e86020', boxShadow: 'rgba(232,96,32,0.4) 0 4px 20px' }}>
          {play.questionIndex + 1 < quiz.questions.length ? 'Tiếp theo →' : 'Xem kết quả 🎉'}
        </button>
      </div>
    </div>
  );
}
