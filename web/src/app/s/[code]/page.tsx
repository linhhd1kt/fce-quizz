'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { calculateScore } from '@/lib/scoring';
import type { QuizRow, UserAnswer, AttemptRow, MultipleChoiceQuestion } from '@/types/quiz';

const TILES = [
  { bg: '#8db600', shadow: 'rgba(141,182,0,0.4)' },
  { bg: '#8a4fd0', shadow: 'rgba(138,79,208,0.4)' },
  { bg: '#e86020', shadow: 'rgba(232,96,32,0.4)' },
  { bg: '#00c9a7', shadow: 'rgba(0,201,167,0.4)' },
] as const;

type Screen = 'join' | 'lobby' | 'countdown' | 'playing' | 'finished' | 'results';
type Phase = 'question' | 'feedback';

interface PlayState {
  phase: Phase;
  questionIndex: number;
  selected: string | null;
  timeLeft: number;
  answers: UserAnswer[];
  questionStartedAt: number;
}

interface EditDraft {
  text: string;
  explanation: string;
  answer: string;
  options: string[];
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
  const { data: session } = useSession();
  const isTeacher = !!session;

  const [screen, setScreen] = useState<Screen>('join');
  const [sessionId, setSessionId] = useState('');
  const [sessionStatus, setSessionStatus] = useState<'waiting' | 'active' | 'ended' | null>(null);
  const [quiz, setQuiz] = useState<QuizRow | null>(null);
  const [studentName, setStudentName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [loadError, setLoadError] = useState('');
  const [countdown, setCountdown] = useState(3);
  const [history, setHistory] = useState<AttemptRow[]>([]);
  const [activeQuestions, setActiveQuestions] = useState<MultipleChoiceQuestion[] | null>(null);
  const [sessionQuestions, setSessionQuestions] = useState<MultipleChoiceQuestion[] | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchOrder, setBatchOrder] = useState<number | null>(null);
  const [batchParts, setBatchParts] = useState<{ id: string; code: string; batchOrder: number }[] | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Teacher edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const timePerQ = quiz?.time_per_question ?? 45;
  const questions: MultipleChoiceQuestion[] = activeQuestions ?? sessionQuestions ?? ((quiz?.questions as MultipleChoiceQuestion[]) ?? []);

  const [play, setPlay] = useState<PlayState>({
    phase: 'question', questionIndex: 0, selected: null,
    timeLeft: 45, answers: [], questionStartedAt: Date.now(),
  });

  useEffect(() => {
    fetch(`/api/sessions/by-code/${code}`)
      .then((r) => r.ok ? r.json() : null)
      .then((s) => {
        if (!s) { setLoadError('Room not found or closed.'); return; }
        setSessionId(s.id);
        setSessionStatus(s.status ?? 'active');
        setQuiz(s.quizzes);
        if (s.questionsSubset) setSessionQuestions(s.questionsSubset as MultipleChoiceQuestion[]);
        if (s.batchId) {
          setBatchId(s.batchId);
          setBatchOrder(s.batchOrder);
          fetch(`/api/sessions/batch/${s.batchId}`)
            .then((r) => r.ok ? r.json() : null)
            .then((parts) => { if (parts) setBatchParts(parts); });
        }
        if (s.status === 'ended') router.push(`/s/${code}/podium`);
      });
  }, [code, router]);

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

  useEffect(() => {
    if (screen !== 'lobby') return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/sessions/lookup?code=${code}`);
      if (!res.ok) return;
      const data = await res.json() as { status: string };
      if (data.status === 'active') {
        clearInterval(interval);
        setActiveQuestions(null);
        setPlay({ phase: 'question', questionIndex: 0, selected: null, timeLeft: timePerQ, answers: [], questionStartedAt: Date.now() });
        setScreen('countdown');
        setCountdown(3);
      } else if (data.status === 'ended') {
        clearInterval(interval);
        router.push(`/s/${code}/podium`);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [screen, code, router, timePerQ]);

  // Initialize teacher edit draft when entering feedback phase
  useEffect(() => {
    if (play.phase === 'feedback' && isTeacher && questions.length > 0) {
      const q = questions[play.questionIndex];
      if (q) setEditDraft({ text: q.text, explanation: q.explanation ?? '', answer: q.answer, options: [...q.options] });
      setEditOpen(false);
    }
  }, [play.phase, play.questionIndex, isTeacher]);

  const submitAnswer = useCallback((selected: string | null) => {
    if (!quiz) return;
    if (timerRef.current) clearInterval(timerRef.current);
    const q = questions[play.questionIndex];
    const answer: UserAnswer = {
      questionId: q.id,
      selected: selected ?? '',
      correct: selected === q.answer,
      timeSpent: Date.now() - play.questionStartedAt,
    };
    setPlay((prev) => ({ ...prev, phase: 'feedback', selected, answers: [...prev.answers, answer] }));

    if (sessionId) {
      fetch(`/api/sessions/${sessionId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName,
          questionIndex: play.questionIndex,
          isCorrect: selected === q.answer,
          totalQuestions: questions.length,
        }),
      });
    }
  }, [quiz, questions, play.questionIndex, play.questionStartedAt, sessionId, studentName]);

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
    if (screen === 'playing' && play.phase === 'question' && play.timeLeft === 0) submitAnswer(null);
  }, [screen, play.phase, play.timeLeft, submitAnswer]);

  async function saveEdit() {
    if (!quiz || !editDraft) return;
    setEditSaving(true);
    const qId = questions[play.questionIndex].id;
    const finalQuestions = (quiz.questions as MultipleChoiceQuestion[]).map((qq) =>
      qq.id === qId ? { ...qq, text: editDraft.text, options: editDraft.options, explanation: editDraft.explanation, answer: editDraft.answer } : qq
    );
    const res = await fetch(`/api/quizzes/${quiz.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions: finalQuestions }),
    });
    if (res.ok) {
      setQuiz((prev) => prev ? { ...prev, questions: finalQuestions } : prev);
      if (activeQuestions) {
        setActiveQuestions((prev) => prev?.map((qq) =>
          qq.id === qId ? { ...qq, text: editDraft.text, options: editDraft.options, explanation: editDraft.explanation, answer: editDraft.answer } : qq
        ) ?? prev);
      }
      setEditOpen(false);
    }
    setEditSaving(false);
  }

  async function nextQuestion() {
    if (!quiz) return;
    const next = play.questionIndex + 1;
    if (next >= questions.length) {
      const score = calculateScore(play.answers);
      const res = await fetch('/api/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId, quizId: quiz.id, studentName, score,
          totalQuestions: questions.length,
          timeSpentMs: play.answers.reduce((s, a) => s + a.timeSpent, 0),
          answers: play.answers,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { podiumRedirect?: boolean };
        if (data.podiumRedirect) {
          router.push(`/s/${code}/podium`);
          return;
        }
      }
      setScreen('finished');
    } else {
      setPlay((prev) => ({ ...prev, phase: 'question', questionIndex: next, selected: null, timeLeft: timePerQ, questionStartedAt: Date.now() }));
    }
  }

  function startPlay(qs: MultipleChoiceQuestion[] | null) {
    setActiveQuestions(qs);
    setPlay({ phase: 'question', questionIndex: 0, selected: null, timeLeft: timePerQ, answers: [], questionStartedAt: Date.now() });
    setScreen('countdown');
    setCountdown(3);
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const name = nameInput.trim();
    if (!name) return;
    setStudentName(name);
    if (sessionStatus === 'waiting') {
      await fetch('/api/lobby/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, studentName: name }),
      });
      setScreen('lobby');
    } else {
      startPlay(null);
    }
  }

  async function showResults() {
    const res = await fetch(`/api/attempts?sessionId=${sessionId}&studentName=${encodeURIComponent(studentName)}`);
    setHistory(await res.json() as AttemptRow[]);
    setScreen('results');
  }

  function handleRetryWrong() {
    const wrongIds = new Set(play.answers.filter(a => !a.correct).map(a => a.questionId));
    const wrongQs = (quiz!.questions as MultipleChoiceQuestion[]).filter(q => wrongIds.has(q.id));
    startPlay(wrongQs);
  }

  // ── LOAD ERROR ────────────────────────────────────────────────────────────
  if (loadError) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-950 px-4">
      <p className="text-red-400 text-center">{loadError}</p>
      <Link href="/" className="text-blue-400 hover:underline text-sm">← Home</Link>
    </div>
  );

  if (!quiz) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <p className="text-slate-500 text-sm">Loading room…</p>
    </div>
  );

  // ── LOBBY ────────────────────────────────────────────────────────────────
  if (screen === 'lobby') return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-4" style={{ background: '#2d0a1e' }}>
      <GridPattern />
      <div className="relative w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold text-orange-400 bg-orange-400/10 border border-orange-400/30">
            {code.toUpperCase()}
          </span>
          <h1 className="text-white text-xl font-bold">{quiz?.title}</h1>
        </div>
        <div className="space-y-3">
          <p className="text-white font-semibold">You&apos;re in the lobby!</p>
          <p className="text-white/50 text-sm">Hi, {studentName} 👋</p>
          <p className="text-white/40 text-sm">Waiting for teacher to start the game…</p>
          <div className="flex justify-center gap-2 pt-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-orange-400"
                style={{ animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }}
              />
            ))}
          </div>
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:0.2} 50%{opacity:1} }`}</style>
    </div>
  );

  // ── JOIN ─────────────────────────────────────────────────────────────────
  if (screen === 'join') return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-4" style={{ background: '#2d0a1e' }}>
      <GridPattern />
      <div className="relative w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold text-orange-400 bg-orange-400/10 border border-orange-400/30">
            {code.toUpperCase()}
          </span>
          <h1 className="text-white text-2xl font-bold">{quiz.title}</h1>
          <p className="text-white/40 text-sm">
            {(sessionQuestions ?? quiz.questions).length} questions · {quiz.time_per_question}s/q
            {batchOrder && batchParts ? ` · Part ${batchOrder}/${batchParts.length}` : ''}
          </p>
        </div>
        {isTeacher && (
          <div className="flex justify-center">
            <span className="px-3 py-1 rounded-full text-xs font-bold text-orange-400 bg-orange-400/10 border border-orange-400/30">
              Teacher mode
            </span>
          </div>
        )}
        <form onSubmit={handleJoin} className="space-y-4">
          <input type="text" required autoFocus placeholder="Enter your name…" value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            className="w-full text-center text-white text-xl font-bold bg-white/5 border-2 border-white/20 focus:border-white/60 rounded-2xl px-6 py-4 outline-none transition-colors placeholder-white/20" />
          <button type="submit" className="w-full py-4 rounded-2xl text-white font-black text-xl transition hover:brightness-110 active:scale-95"
            style={{ background: '#e86020', boxShadow: 'rgba(232,96,32,0.4) 0 4px 20px' }}>
            Join →
          </button>
        </form>
      </div>
    </div>
  );

  // ── COUNTDOWN ────────────────────────────────────────────────────────────
  if (screen === 'countdown') return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background: '#2d0a1e' }}>
      <GridPattern />
      <p className="relative text-white/50 text-base font-medium mb-4">{studentName}</p>
      <p className="relative text-white/30 text-sm mb-10">{quiz.title}{activeQuestions ? ` · ${activeQuestions.length} wrong` : ''}{batchOrder && batchParts ? ` · Part ${batchOrder}/${batchParts.length}` : ''}</p>
      <div className="relative w-40 h-40 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-4 border-white/10 animate-ping" />
        <div className="absolute inset-0 rounded-full border-4 border-white/20" />
        <span className="relative text-9xl font-black text-white">{countdown}</span>
      </div>
      <p className="relative text-white/30 text-sm mt-10">Get ready…</p>
    </div>
  );

  // ── FINISHED ─────────────────────────────────────────────────────────────
  if (screen === 'finished') {
    const score = calculateScore(play.answers);
    const nextPart = batchParts && batchOrder != null
      ? batchParts.find((p) => p.batchOrder === batchOrder + 1)
      : null;
    const totalParts = batchParts?.length ?? null;
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6" style={{ background: '#2d0a1e' }}>
        <GridPattern />
        <div className="relative text-7xl">🎉</div>
        <p className="relative text-white text-2xl font-bold">Completed!</p>
        <p className="relative text-white/60">
          {studentName} · {score}%
          {totalParts && batchOrder ? ` · Part ${batchOrder}/${totalParts}` : ''}
        </p>
        <div className="relative flex flex-col gap-3 w-full max-w-xs px-4">
          {nextPart && (
            <button onClick={() => router.push(`/s/${nextPart.code}`)}
              className="w-full py-3.5 rounded-2xl text-white font-black text-lg transition hover:brightness-110 active:scale-95"
              style={{ background: '#e86020', boxShadow: 'rgba(232,96,32,0.4) 0 4px 20px' }}>
              Continue — Part {batchOrder! + 1}/{totalParts} →
            </button>
          )}
          <button onClick={showResults}
            className={`w-full py-3.5 rounded-2xl text-white font-bold text-lg transition hover:brightness-110 active:scale-95 ${nextPart ? 'opacity-60' : ''}`}
            style={{ background: nextPart ? '#1a0815' : '#e86020', boxShadow: nextPart ? 'none' : 'rgba(232,96,32,0.4) 0 4px 20px', border: nextPart ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
            View results →
          </button>
        </div>
      </div>
    );
  }

  // ── RESULTS ──────────────────────────────────────────────────────────────
  if (screen === 'results') {
    const wrongCount = play.answers.filter(a => !a.correct).length;
    const correctCount = play.answers.length - wrongCount;
    const score = calculateScore(play.answers);

    return (
      <div className="min-h-screen bg-slate-950">
        <header className="border-b border-slate-800 sticky top-0 z-10 bg-slate-950/80 backdrop-blur">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="text-slate-500 hover:text-slate-300 text-sm">← Home</Link>
            <span className="text-white text-sm font-semibold">{studentName}</span>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
          {/* Score */}
          <div className="text-center space-y-1">
            <p className="text-slate-500 text-sm">{quiz.title}{activeQuestions ? ' · Wrong answers' : ''}</p>
            <p className="text-6xl font-black text-white">{score}%</p>
            <p className="text-slate-400 text-sm">{correctCount}/{play.answers.length} correct</p>
          </div>

          {/* Retry buttons */}
          <div className="flex flex-col gap-2">
            {wrongCount > 0 && (
              <button onClick={handleRetryWrong}
                className="w-full py-3 text-white font-bold rounded-xl transition-colors text-sm"
                style={{ background: '#e86020', boxShadow: 'rgba(232,96,32,0.3) 0 2px 12px' }}>
                Retry wrong ({wrongCount}) →
              </button>
            )}
            <button onClick={() => startPlay(null)}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors text-sm">
              Retry all ({quiz.questions.length})
            </button>
          </div>

          {/* Per-question review */}
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Review — {correctCount} correct · {wrongCount} wrong
            </h2>
            {play.answers.map((a, idx) => {
              const q = questions.find(q => q.id === a.questionId);
              return (
                <div key={a.questionId} className={`rounded-xl border p-3 space-y-1.5 ${a.correct ? 'bg-emerald-950/40 border-emerald-900/60' : 'bg-red-950/40 border-red-900/60'}`}>
                  <div className="flex items-start gap-2">
                    <span className={`shrink-0 font-bold text-sm w-5 ${a.correct ? 'text-emerald-400' : 'text-red-400'}`}>
                      {a.correct ? '✓' : '✗'}
                    </span>
                    <p className="text-white/80 text-sm leading-snug">{idx + 1}. {q?.text ?? `Question ${idx + 1}`}</p>
                  </div>
                  {!a.correct && (
                    <div className="pl-7 space-y-0.5 text-xs">
                      <p className="text-red-400">Your answer: <span className="font-medium">{a.selected || '(no answer)'}</span></p>
                      <p className="text-emerald-400">Correct: <span className="font-medium">{q?.answer}</span></p>
                      {q?.explanation && <p className="text-blue-300/70 italic mt-1 leading-relaxed">{q.explanation}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          {/* History */}
          {history.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">History</h2>
              {history.map((a, idx) => {
                const correct = (a.answers as { correct: boolean }[]).filter(x => x.correct).length;
                return (
                  <div key={a.id} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-4">
                    <span className="text-slate-600 text-xs w-4">{idx + 1}</span>
                    <p className="flex-1 text-slate-400 text-xs">
                      {new Date(a.completed_at).toLocaleString()} · {correct}/{a.total_questions} correct
                    </p>
                    <span className={`font-bold text-sm ${a.score >= 75 ? 'text-emerald-400' : a.score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {a.score}%
                    </span>
                  </div>
                );
              })}
            </section>
          )}
        </main>
      </div>
    );
  }

  // ── PLAYING ──────────────────────────────────────────────────────────────
  const q = questions[play.questionIndex];
  const pct = (play.timeLeft / timePerQ) * 100;
  const revealed = play.phase === 'feedback';
  const isCorrect = revealed && play.selected === q.answer;
  const isTimeout = revealed && play.selected === null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#2d0a1e' }}>
      <GridPattern />
      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 h-12 shrink-0">
        <span className="text-white/40 text-xs sm:text-sm truncate max-w-[40vw]">
          {studentName}
          {isTeacher && <span className="ml-1.5 text-orange-400/80 text-xs font-bold">✎</span>}
        </span>
        <span className="text-white/40 text-sm font-medium">{play.questionIndex + 1}/{questions.length}</span>
      </div>
      {/* Timer bar */}
      <div className="relative z-10 mx-3 h-1.5 rounded-full shrink-0 overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
        <div className="h-full rounded-full transition-all duration-1000" style={{
          width: `${pct}%`, background: pct > 50 ? '#22c55e' : pct > 25 ? '#f59e0b' : '#ef4444',
        }} />
      </div>
      {/* Question zone */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-3 py-3 min-h-0">
        <div className="mb-2 px-4 py-1 rounded-full text-xs font-bold text-white" style={{ background: '#1a0815', border: '2px solid rgba(255,255,255,0.15)' }}>
          {play.questionIndex + 1} / {questions.length}
        </div>
        <div className="relative w-full max-w-3xl rounded-2xl px-4 sm:px-8 py-4 text-center" style={{ background: '#1a0815' }}>
          {/* Teacher edit button */}
          {revealed && isTeacher && (
            <button onClick={() => setEditOpen(true)}
              className="absolute top-2 left-2 w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors"
              style={{ background: 'rgba(234,179,8,0.15)', color: 'rgba(234,179,8,0.7)' }}
              title="Edit question">
              ✎
            </button>
          )}
          <p className={`text-sm font-semibold mb-2 ${revealed ? (isCorrect ? 'text-green-400' : 'text-red-400') : 'invisible'}`}>
            {isTimeout ? `⏰ Time's up! Answer: ${q.answer}` : isCorrect ? '🎉 Correct!' : `😔 Wrong — Answer: ${q.answer}`}
          </p>
          {q.context && <p className="text-white/50 text-xs mb-2 text-left leading-relaxed line-clamp-2">{q.context}</p>}
          <p className="text-white text-base sm:text-xl font-bold leading-snug">{q.text}</p>
          <p className={`text-white/30 text-xs mt-2 ${revealed ? 'invisible' : ''}`}>{play.timeLeft}s</p>
        </div>
        <div className={`mt-2 w-full max-w-3xl rounded-xl px-4 py-2 text-xs sm:text-sm text-blue-200 text-center ${revealed && q.explanation ? 'visible' : 'invisible'}`}
          style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', minHeight: '2.5rem' }}>
          {q.explanation}
        </div>
      </div>
      {/* Tiles — always 2 columns on mobile */}
      <div className="relative z-10 grid grid-cols-2 gap-2 sm:gap-3 p-2 sm:p-3 shrink-0" style={{ minHeight: '36vh' }}>
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
              <span className="absolute top-2 right-2 w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(0,0,0,0.25)', color: 'rgba(255,255,255,0.9)' }}>
                {idx + 1}
              </span>
              {revealed && isThisCorrect && <span className="text-2xl mb-1 drop-shadow">✓</span>}
              {revealed && play.selected === opt && !isThisCorrect && <span className="text-2xl mb-1 drop-shadow">✗</span>}
              <span className="text-white font-bold text-sm sm:text-base text-center px-3 leading-snug drop-shadow-md">{opt}</span>
            </button>
          );
        })}
      </div>
      {/* Next button */}
      <div className={`relative z-10 flex justify-center pb-3 pt-1 shrink-0 ${revealed ? 'visible' : 'invisible'}`}>
        <button onClick={nextQuestion}
          className="px-10 py-3 rounded-2xl text-white font-bold text-base transition hover:brightness-110 active:scale-95 shadow-lg"
          style={{ background: '#e86020', boxShadow: 'rgba(232,96,32,0.4) 0 4px 20px' }}>
          {play.questionIndex + 1 < questions.length ? 'Next →' : 'Finish 🎉'}
        </button>
      </div>

      {/* Teacher edit modal */}
      {editOpen && editDraft && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-lg bg-slate-900 rounded-t-2xl sm:rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-sm">Edit Question</h3>
              <button onClick={() => setEditOpen(false)} className="text-slate-500 hover:text-slate-300 text-xl leading-none">×</button>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-slate-500 uppercase tracking-widest">Question text</p>
              <textarea
                rows={3}
                value={editDraft.text}
                onChange={(e) => setEditDraft((d) => d ? { ...d, text: e.target.value } : d)}
                className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white outline-none resize-none"
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs text-slate-500 uppercase tracking-widest">Answer options</p>
              <div className="space-y-2">
                {editDraft.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button
                      onClick={() => setEditDraft((d) => d ? { ...d, answer: d.options[i] } : d)}
                      className={`shrink-0 w-5 h-5 rounded-full border-2 transition-colors ${editDraft.answer === opt ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 hover:border-emerald-500'}`}
                    />
                    <input
                      value={opt}
                      onChange={(e) => {
                        const newVal = e.target.value;
                        setEditDraft((d) => {
                          if (!d) return d;
                          const newOpts = d.options.map((o, j) => j === i ? newVal : o);
                          const newAnswer = d.answer === d.options[i] ? newVal : d.answer;
                          return { ...d, options: newOpts, answer: newAnswer };
                        });
                      }}
                      className="flex-1 bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-lg px-3 py-1.5 text-sm text-white outline-none"
                    />
                    <span className={`text-xs font-mono w-4 ${editDraft.answer === opt ? 'text-emerald-400' : 'text-slate-600'}`}>
                      {['A', 'B', 'C', 'D'][i]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-slate-500 uppercase tracking-widest">Explanation</p>
              <textarea
                rows={2}
                placeholder="Add explanation (optional)…"
                value={editDraft.explanation}
                onChange={(e) => setEditDraft((d) => d ? { ...d, explanation: e.target.value } : d)}
                className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 outline-none resize-none"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={saveEdit} disabled={editSaving}
                className="flex-1 py-2.5 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                {editSaving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditOpen(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-xl transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
