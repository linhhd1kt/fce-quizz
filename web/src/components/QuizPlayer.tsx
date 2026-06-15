'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { QuizSet, QuizAttempt, UserAnswer } from '@/types/quiz';
import { saveAttempt } from '@/lib/storage';
import { calculateScore } from '@/lib/scoring';
import QuestionMultipleChoice from './QuestionMultipleChoice';
import Timer from './Timer';
import ProgressBar from './ProgressBar';

type Phase = 'countdown' | 'question' | 'feedback' | 'finished';

interface State {
  phase: Phase;
  questionIndex: number;
  selected: string | null;
  timeLeft: number;
  answers: UserAnswer[];
  questionStartedAt: number;
  countdown: number;
  completedAttemptId?: string;
}

const DEFAULT_TIME = 45;

export default function QuizPlayer({ quiz }: { quiz: QuizSet }) {
  const router = useRouter();
  const timePerQ = quiz.timePerQuestion ?? DEFAULT_TIME;
  const completedAttemptRef = useRef<QuizAttempt | null>(null);

  const [state, setState] = useState<State>({
    phase: 'countdown',
    questionIndex: 0,
    selected: null,
    timeLeft: timePerQ,
    answers: [],
    questionStartedAt: Date.now(),
    countdown: 3,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // Countdown before quiz starts
  useEffect(() => {
    if (state.phase !== 'countdown') return;
    const t = setInterval(() => {
      setState((prev) => {
        if (prev.countdown <= 1) {
          clearInterval(t);
          return { ...prev, phase: 'question', questionStartedAt: Date.now(), timeLeft: timePerQ, countdown: 0 };
        }
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);
    return () => clearInterval(t);
  }, [state.phase, timePerQ]);

  // Per-question countdown
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
      const correct = selected === q.answer;
      const timeSpent = Date.now() - state.questionStartedAt;

      const answer: UserAnswer = {
        questionId: q.id,
        selected: selected ?? '',
        correct,
        timeSpent,
      };

      setState((prev) => ({
        ...prev,
        phase: 'feedback',
        selected,
        answers: [...prev.answers, answer],
      }));
    },
    [state.questionIndex, state.questionStartedAt, quiz.questions, clearTimer]
  );

  // Auto-submit when timer expires
  useEffect(() => {
    if (state.phase === 'question' && state.timeLeft === 0) {
      submitAnswer(null);
    }
  }, [state.phase, state.timeLeft, submitAnswer]);

  // Navigate to results after quiz completes
  useEffect(() => {
    if (state.phase === 'finished' && completedAttemptRef.current) {
      const attempt = completedAttemptRef.current;
      saveAttempt(attempt);
      router.push(`/quiz/${quiz.id}/results?attemptId=${attempt.id}`);
    }
  }, [state.phase, quiz.id, router]);

  const nextQuestion = useCallback(() => {
    setState((prev) => {
      const nextIndex = prev.questionIndex + 1;
      if (nextIndex >= quiz.questions.length) {
        const allAnswers = prev.answers;
        const attempt: QuizAttempt = {
          id: crypto.randomUUID(),
          quizId: quiz.id,
          quizTitle: quiz.title,
          startedAt: Date.now() - allAnswers.reduce((s, a) => s + a.timeSpent, 0),
          completedAt: Date.now(),
          score: calculateScore(allAnswers),
          totalQuestions: quiz.questions.length,
          totalTimeSpent: allAnswers.reduce((s, a) => s + a.timeSpent, 0),
          answers: allAnswers,
        };
        completedAttemptRef.current = attempt;
        return { ...prev, phase: 'finished', completedAttemptId: attempt.id };
      }
      return {
        ...prev,
        phase: 'question',
        questionIndex: nextIndex,
        selected: null,
        timeLeft: timePerQ,
        questionStartedAt: Date.now(),
      };
    });
  }, [quiz, timePerQ]);

  const currentQ = quiz.questions[state.questionIndex];

  if (state.phase === 'countdown') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <h2 className="text-slate-400 text-lg">Get ready…</h2>
        <div className="text-8xl font-bold text-white animate-pulse">{state.countdown}</div>
        <p className="text-slate-500 text-sm">{quiz.title}</p>
      </div>
    );
  }

  if (state.phase === 'finished') {
    const resultsHref = state.completedAttemptId
      ? `/quiz/${quiz.id}/results?attemptId=${state.completedAttemptId}`
      : `/quiz/${quiz.id}/results`;
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5">
        <div className="text-4xl animate-spin">⏳</div>
        <p className="text-slate-400">Saving results…</p>
        <Link
          href={resultsHref}
          className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors"
        >
          See Results →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="space-y-2">
        <ProgressBar current={state.questionIndex + 1} total={quiz.questions.length} />
        <Timer
          seconds={state.timeLeft}
          totalSeconds={timePerQ}
          onExpire={() => {}}
        />
      </div>

      {/* Question */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        {currentQ.type === 'multiple-choice' && (
          <QuestionMultipleChoice
            question={currentQ}
            selected={state.selected}
            revealed={state.phase === 'feedback'}
            onSelect={(opt) => {
              if (state.phase !== 'question') return;
              setState((prev) => ({ ...prev, selected: opt }));
            }}
          />
        )}
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-3">
        {state.phase === 'question' && (
          <button
            disabled={!state.selected}
            onClick={() => submitAnswer(state.selected)}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
          >
            Confirm
          </button>
        )}
        {state.phase === 'feedback' && (
          <button
            onClick={nextQuestion}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors"
          >
            {state.questionIndex + 1 < quiz.questions.length ? 'Next →' : 'See Results'}
          </button>
        )}
      </div>
    </div>
  );
}
