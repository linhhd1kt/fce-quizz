'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { QuizSet, QuizAttempt, UserAnswer, MultipleChoiceQuestion } from '@/types/quiz';
import { saveAttempt } from '@/lib/storage';
import { calculateScore } from '@/lib/scoring';
import { useI18n } from '@/i18n';

// Wayground tile colors
const TILES = [
  { bg: '#8db600', shadow: 'rgba(141,182,0,0.4)' },
  { bg: '#8a4fd0', shadow: 'rgba(138,79,208,0.4)' },
  { bg: '#e86020', shadow: 'rgba(232,96,32,0.4)' },
  { bg: '#00c9a7', shadow: 'rgba(0,201,167,0.4)' },
] as const;

const TILE_LABELS = ['1', '2', '3', '4'];

type Phase = 'countdown' | 'question' | 'feedback' | 'finished';

interface State {
  phase: Phase;
  questionIndex: number;
  selected: string | null;
  timeLeft: number;
  answers: UserAnswer[];
  questionStartedAt: number;
  countdown: number;
}

const DEFAULT_TIME = 45;

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export default function QuizPlayer({ quiz }: { quiz: QuizSet }) {
  const router = useRouter();
  const { msgs, i } = useI18n();
  const m = msgs.player;
  const timePerQ = quiz.timePerQuestion ?? DEFAULT_TIME;
  const completedAttemptRef = useRef<QuizAttempt | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [state, setState] = useState<State>({
    phase: 'countdown',
    questionIndex: 0,
    selected: null,
    timeLeft: timePerQ,
    answers: [],
    questionStartedAt: Date.now(),
    countdown: 3,
  });

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (state.phase !== 'countdown') return;
    const t = setInterval(() => {
      setState((prev) => {
        if (prev.countdown <= 1) {
          clearInterval(t);
          return { ...prev, phase: 'question', questionStartedAt: Date.now(), timeLeft: timePerQ };
        }
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);
    return () => clearInterval(t);
  }, [state.phase, timePerQ]);

  useEffect(() => {
    if (state.phase !== 'question') return;
    clearTimer();
    timerRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.phase !== 'question') return prev;
        if (prev.timeLeft <= 1) {
          clearInterval(timerRef.current!);
          return { ...prev, timeLeft: 0 };
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);
    return clearTimer;
  }, [state.phase, state.questionIndex, clearTimer]);

  const submitAnswer = useCallback(
    (selected: string | null) => {
      clearTimer();
      const q = quiz.questions[state.questionIndex];
      const answer: UserAnswer = {
        questionId: q.id,
        selected: selected ?? '',
        correct: selected === q.answer,
        timeSpent: Date.now() - state.questionStartedAt,
      };
      setState((prev) => ({ ...prev, phase: 'feedback', selected, answers: [...prev.answers, answer] }));
    },
    [state.questionIndex, state.questionStartedAt, quiz.questions, clearTimer],
  );

  useEffect(() => {
    if (state.phase === 'question' && state.timeLeft === 0) submitAnswer(null);
  }, [state.phase, state.timeLeft, submitAnswer]);

  useEffect(() => {
    if (state.phase === 'finished' && completedAttemptRef.current) {
      router.push(`/quiz/${quiz.id}/results?attemptId=${completedAttemptRef.current.id}`);
    }
  }, [state.phase, quiz.id, router]);

  const nextQuestion = useCallback(() => {
    setState((prev) => {
      const next = prev.questionIndex + 1;
      if (next >= quiz.questions.length) {
        const allAnswers = prev.answers;
        const attempt: QuizAttempt = {
          id: generateId(),
          quizId: quiz.id,
          quizTitle: quiz.title,
          startedAt: Date.now() - allAnswers.reduce((s, a) => s + a.timeSpent, 0),
          completedAt: Date.now(),
          score: calculateScore(allAnswers),
          totalQuestions: quiz.questions.length,
          totalTimeSpent: allAnswers.reduce((s, a) => s + a.timeSpent, 0),
          answers: allAnswers,
        };
        saveAttempt(attempt);
        completedAttemptRef.current = attempt;
        return { ...prev, phase: 'finished' };
      }
      return {
        ...prev,
        phase: 'question',
        questionIndex: next,
        selected: null,
        timeLeft: timePerQ,
        questionStartedAt: Date.now(),
      };
    });
  }, [quiz, timePerQ]);

  const q = quiz.questions[state.questionIndex] as MultipleChoiceQuestion;
  const pct = (state.timeLeft / timePerQ) * 100;

  // ── COUNTDOWN ──────────────────────────────────────────────────────────────
  if (state.phase === 'countdown') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background: '#2d0a1e' }}>
        <GridPattern />
        <p className="relative text-white/50 text-base font-medium mb-10">{quiz.title}</p>
        <div className="relative w-40 h-40 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-white/10 animate-ping" />
          <div className="absolute inset-0 rounded-full border-4 border-white/20" />
          <span className="relative text-9xl font-black text-white">{state.countdown}</span>
        </div>
        <p className="relative text-white/30 text-sm mt-10">{m.getReady}</p>
      </div>
    );
  }

  // ── FINISHED ───────────────────────────────────────────────────────────────
  if (state.phase === 'finished') {
    const href = completedAttemptRef.current
      ? `/quiz/${quiz.id}/results?attemptId=${completedAttemptRef.current.id}`
      : `/quiz/${quiz.id}/results`;
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6" style={{ background: '#2d0a1e' }}>
        <GridPattern />
        <div className="relative text-7xl">🎉</div>
        <p className="relative text-white text-2xl font-bold">{m.finished}</p>
        <Link
          href={href}
          className="relative px-10 py-3.5 rounded-2xl text-white font-bold text-lg transition hover:brightness-110"
          style={{ background: '#e86020' }}
        >
          {m.viewResults}
        </Link>
      </div>
    );
  }

  // ── GAME ───────────────────────────────────────────────────────────────────
  const revealed = state.phase === 'feedback';
  const isCorrect = revealed && state.selected === q.answer;
  const isTimeout = revealed && state.selected === null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#2d0a1e' }}>
      <GridPattern />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 h-12 shrink-0">
        <Link href="/" className="flex items-center gap-2 text-white/50 hover:text-white/80 text-sm transition">
          {m.exit}
        </Link>
        <div className="flex items-center gap-2">
          {q.section && (
            <span
              className="px-3 py-0.5 rounded-full text-xs font-medium"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)' }}
            >
              {q.section}
            </span>
          )}
          <span className="text-white/40 text-sm font-medium">
            {i(m.progress, { current: state.questionIndex + 1, total: quiz.questions.length })}
          </span>
        </div>
      </div>

      {/* Timer bar */}
      <div
        className="relative z-10 mx-4 h-1.5 rounded-full shrink-0 overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.1)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${pct}%`,
            background: pct > 50 ? '#22c55e' : pct > 25 ? '#f59e0b' : '#ef4444',
          }}
        />
      </div>

      {/* Question zone */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-4 min-h-0">
        {/* Counter pill */}
        <div
          className="mb-3 px-5 py-1.5 rounded-full text-sm font-bold text-white"
          style={{ background: '#1a0815', border: '2px solid rgba(255,255,255,0.15)' }}
        >
          {i(m.progress, { current: state.questionIndex + 1, total: quiz.questions.length })}
        </div>

        {/* Question card */}
        <div
          className="w-full max-w-3xl rounded-2xl px-8 py-5 text-center"
          style={{ background: '#1a0815' }}
        >
          <p className={`text-sm font-semibold mb-2 ${revealed ? (isCorrect ? 'text-green-400' : 'text-red-400') : 'invisible'}`}>
            {isTimeout
              ? i(m.timeout, { answer: q.answer })
              : isCorrect
              ? m.correct
              : i(m.wrong, { answer: q.answer })}
          </p>
          {q.context && (
            <p className="text-white/50 text-xs mb-3 text-left leading-relaxed line-clamp-3">
              {q.context}
            </p>
          )}
          <p className="text-white text-xl md:text-2xl font-bold leading-snug">{q.text}</p>
          <p className={`text-white/30 text-xs mt-3 ${revealed ? 'invisible' : ''}`}>{i(m.seconds, { s: state.timeLeft })}</p>
        </div>

        {/* Explanation - always rendered to prevent layout shift */}
        <div
          className={`mt-3 w-full max-w-3xl rounded-xl px-5 py-3 text-sm text-blue-200 text-center ${revealed && q.explanation ? 'visible' : 'invisible'}`}
          style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', minHeight: '3rem' }}
        >
          {q.explanation}
        </div>
      </div>

      {/* Option tiles */}
      <div
        className="relative z-10 grid gap-3 p-3 shrink-0"
        style={{
          gridTemplateColumns: q.options.length <= 2 ? 'repeat(2, 1fr)' : `repeat(${Math.min(q.options.length, 4)}, 1fr)`,
          minHeight: '38vh',
        }}
      >
        {q.options.map((opt, idx) => {
          const tile = TILES[idx % TILES.length];
          const isThisCorrect = opt === q.answer;
          const isThisSelected = state.selected === opt;

          let opacity = 1;
          let outline = 'none';
          let brightness = '';

          if (revealed) {
            if (isThisCorrect) {
              outline = '3px solid rgba(255,255,255,0.8)';
            } else {
              opacity = 0.28;
            }
          } else if (isThisSelected) {
            outline = '3px solid rgba(255,255,255,0.8)';
          } else {
            brightness = 'hover:brightness-115';
          }

          return (
            <button
              key={opt}
              disabled={revealed}
              onClick={() => {
                if (state.phase === 'question') submitAnswer(opt);
              }}
              className={`relative rounded-2xl flex flex-col items-center justify-center transition-all duration-150 active:scale-95 ${brightness} ${revealed ? 'cursor-default' : 'cursor-pointer'}`}
              style={{
                background: `linear-gradient(150deg, ${tile.bg}ee, ${tile.bg}aa)`,
                boxShadow: revealed && isThisCorrect
                  ? `0 0 24px ${tile.shadow}, 0 4px 16px rgba(0,0,0,0.4)`
                  : '0 4px 16px rgba(0,0,0,0.3)',
                opacity,
                outline,
              }}
            >
              <span
                className="absolute top-2.5 right-2.5 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                style={{ background: 'rgba(0,0,0,0.25)', color: 'rgba(255,255,255,0.9)' }}
              >
                {TILE_LABELS[idx]}
              </span>
              {revealed && isThisCorrect && (
                <span className="text-3xl mb-1 drop-shadow">✓</span>
              )}
              {revealed && isThisSelected && !isThisCorrect && (
                <span className="text-3xl mb-1 drop-shadow">✗</span>
              )}
              <span className="text-white font-bold text-lg md:text-xl text-center px-4 leading-snug drop-shadow-md">
                {opt}
              </span>
            </button>
          );
        })}
      </div>

      {/* Next button - always rendered to prevent layout shift */}
      <div className={`relative z-10 flex justify-center pb-4 pt-2 shrink-0 ${revealed ? 'visible' : 'invisible'}`}>
        <button
          onClick={nextQuestion}
          className="px-12 py-3.5 rounded-2xl text-white font-bold text-base transition hover:brightness-110 active:scale-95 shadow-lg"
          style={{ background: '#e86020', boxShadow: 'rgba(232,96,32,0.4) 0 4px 20px' }}
        >
          {state.questionIndex + 1 < quiz.questions.length ? m.next : m.seeResults}
        </button>
      </div>
    </div>
  );
}

function GridPattern() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }}
    />
  );
}
