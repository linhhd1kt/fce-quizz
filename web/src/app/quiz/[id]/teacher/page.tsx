'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { QuizSet, MultipleChoiceQuestion, SkippedSection } from '@/types/quiz';
import { loadBuiltInQuizSets, loadImportedQuizSets } from '@/lib/quiz-loader';
import { useI18n } from '@/i18n';

const LABELS = ['A', 'B', 'C', 'D'];
const TILE_COLORS = ['#8db600', '#8a4fd0', '#e86020', '#00c9a7'];

type Tab = 'answers' | 'questions' | 'skipped';

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

function AnswerKeyGrid({ questions }: { questions: MultipleChoiceQuestion[] }) {
  return (
    <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
      {questions.map((q, i) => {
        const letterIdx = q.options.indexOf(q.answer);
        const letter = letterIdx >= 0 ? LABELS[letterIdx] : '?';
        const color = TILE_COLORS[letterIdx % TILE_COLORS.length];
        return (
          <div key={q.id} className="flex flex-col items-center gap-1">
            <span className="text-white/40 text-[10px]">{i + 1}</span>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm"
              style={{ background: color }}
            >
              {letter}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function QuestionRow({
  q,
  num,
  expanded,
  onToggle,
}: {
  q: MultipleChoiceQuestion;
  num: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { msgs } = useI18n();
  const m = msgs.teacher;
  const answerIdx = q.options.indexOf(q.answer);
  const answerLabel = answerIdx >= 0 ? `${LABELS[answerIdx]}. ${q.answer}` : q.answer;
  const tileColor = TILE_COLORS[answerIdx % TILE_COLORS.length];

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-4 p-4 text-left hover:brightness-125 transition-all"
      >
        <span
          className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold mt-0.5"
          style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
        >
          {num}
        </span>
        <p className="flex-1 text-white/90 text-sm leading-relaxed line-clamp-2">{q.text}</p>
        <div className="shrink-0 flex items-center gap-2 ml-2">
          <span
            className="px-2.5 py-1 rounded-xl text-white text-xs font-bold"
            style={{ background: tileColor }}
          >
            {answerLabel}
          </span>
          <span className="text-white/30 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div
          className="px-4 pb-4 space-y-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
        >
          {q.context && (
            <div
              className="rounded-xl p-3 text-white/50 text-xs leading-relaxed max-h-40 overflow-y-auto mt-3"
              style={{ background: 'rgba(0,0,0,0.3)' }}
            >
              {q.context}
            </div>
          )}
          <div className="grid grid-cols-1 gap-1.5 mt-3">
            {q.options.map((opt, j) => (
              <div
                key={j}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2"
                style={{
                  background: opt === q.answer ? `${TILE_COLORS[j]}22` : 'rgba(255,255,255,0.04)',
                  border: opt === q.answer ? `1px solid ${TILE_COLORS[j]}66` : '1px solid transparent',
                }}
              >
                <span
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 text-white"
                  style={{ background: opt === q.answer ? TILE_COLORS[j] : 'rgba(255,255,255,0.1)' }}
                >
                  {LABELS[j]}
                </span>
                <span className={`text-sm ${opt === q.answer ? 'text-white font-semibold' : 'text-white/50'}`}>
                  {opt}
                </span>
                {opt === q.answer && (
                  <span className="ml-auto text-xs font-bold" style={{ color: TILE_COLORS[j] }}>
                    ✓
                  </span>
                )}
              </div>
            ))}
          </div>
          {q.explanation && (
            <div
              className="rounded-xl px-4 py-3 text-blue-200 text-sm"
              style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}
            >
              <span className="font-bold text-blue-400">{m.explanationLabel} </span>
              {q.explanation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SkippedCard({ s }: { s: SkippedSection }) {
  const { msgs } = useI18n();
  const m = msgs.teacher;
  return (
    <div
      className="rounded-2xl p-5 space-y-3"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-white text-base">{s.type}</h3>
          <p className="text-white/40 text-xs mt-0.5">{s.questions} · {s.points} pts</p>
        </div>
        <span
          className="shrink-0 px-3 py-1 rounded-full text-xs font-semibold"
          style={{ background: 'rgba(232,96,32,0.2)', border: '1px solid rgba(232,96,32,0.4)', color: '#f0904a' }}
        >
          {m.manualGrade}
        </span>
      </div>
      <p className="text-white/60 text-sm leading-relaxed">{s.description}</p>
      {s.examples && s.examples.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-white/30 text-[11px] uppercase tracking-widest font-semibold">{m.examplesLabel}</p>
          {s.examples.map((ex, i) => (
            <div
              key={i}
              className="rounded-xl px-3 py-2 text-white/60 text-xs font-mono"
              style={{ background: 'rgba(0,0,0,0.3)' }}
            >
              {ex}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TeacherPage() {
  const params = useParams();
  const id = params.id as string;
  const { msgs, i } = useI18n();
  const m = msgs.teacher;
  const [quiz, setQuiz] = useState<QuizSet | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>('answers');
  const [expandedQ, setExpandedQ] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const builtin = await loadBuiltInQuizSets();
      const imported = loadImportedQuizSets();
      const found = [...builtin, ...imported].find((q) => q.id === id);
      if (found) setQuiz(found);
      else setNotFound(true);
    }
    load();
  }, [id]);

  if (notFound) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background: '#2d0a1e' }}>
        <p className="text-white/50">{m.notFound}</p>
        <Link href="/" className="mt-4 text-blue-400 hover:underline text-sm">{m.homeLink}</Link>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: '#2d0a1e' }}>
        <p className="text-white/50">{m.loading}</p>
      </div>
    );
  }

  const questions = quiz.questions as MultipleChoiceQuestion[];
  const sections = Array.from(new Set(questions.map((q) => q.section ?? 'General')));

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={{ background: '#2d0a1e' }}>
      <GridPattern />

      {/* Top bar */}
      <div
        className="relative z-10 flex items-center justify-between px-5 h-14 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}
      >
        <div className="flex items-center gap-4">
          <Link href="/" className="text-white/50 hover:text-white/80 text-sm transition">
            {m.exit}
          </Link>
          <span className="text-white/20">|</span>
          <h1 className="text-white font-bold text-sm truncate max-w-[200px] md:max-w-none">{quiz.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="px-3 py-1 rounded-full text-xs font-bold"
            style={{ background: 'rgba(232,96,32,0.2)', border: '1px solid rgba(232,96,32,0.5)', color: '#f0904a' }}
          >
            {m.roleBadge}
          </span>
          <Link
            href={`/quiz/${id}`}
            className="px-4 py-1.5 rounded-xl text-white text-sm font-bold transition hover:brightness-110"
            style={{ background: '#e86020' }}
          >
            {m.playBtn}
          </Link>
        </div>
      </div>

      {/* Stats bar */}
      <div className="relative z-10 flex items-center gap-4 px-5 py-3 shrink-0">
        {[
          { label: m.statMcq, value: quiz.questions.length, color: '#8db600' },
          { label: m.statSections, value: sections.length, color: '#8a4fd0' },
          { label: m.statSkipped, value: quiz.skippedSections?.length ?? 0, color: '#e86020' },
        ].map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-2 px-4 py-2 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <span className="font-black text-xl" style={{ color: s.color }}>{s.value}</span>
            <span className="text-white/50 text-xs">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div
        className="relative z-10 flex items-center gap-1 px-5 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        {(
          [
            { key: 'answers', label: m.tabAnswers },
            { key: 'questions', label: m.tabQuestions },
            { key: 'skipped', label: `${m.tabSkippedLabel}${quiz.skippedSections?.length ? ` (${quiz.skippedSections.length})` : ''}` },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-3 text-sm font-semibold transition-colors relative"
            style={{ color: tab === t.key ? 'white' : 'rgba(255,255,255,0.35)' }}
          >
            {t.label}
            {tab === t.key && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                style={{ background: '#e86020' }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        {/* ANSWERS TAB */}
        {tab === 'answers' && (
          <div className="p-5 space-y-6">
            <div>
              <p className="text-white/40 text-xs uppercase tracking-widest font-semibold mb-4">
                {i(m.allAnswersLabel, { count: questions.length })}
              </p>
              <AnswerKeyGrid questions={questions} />
            </div>
            {sections.map((sec) => {
              const secQs = questions.filter((q) => (q.section ?? 'General') === sec);
              return (
                <div key={sec}>
                  <div className="flex items-center gap-3 mb-3">
                    <span
                      className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                      style={{ background: 'rgba(138,79,208,0.3)', border: '1px solid rgba(138,79,208,0.5)' }}
                    >
                      {sec}
                    </span>
                    <span className="text-white/30 text-xs">{i(m.sectionCount, { count: secQs.length })}</span>
                  </div>
                  <AnswerKeyGrid questions={secQs} />
                </div>
              );
            })}
          </div>
        )}

        {/* QUESTIONS TAB */}
        {tab === 'questions' && (
          <div className="p-5 space-y-6">
            {sections.map((sec) => {
              const secQs = questions.filter((q) => (q.section ?? 'General') === sec);
              const globalOffset = questions.indexOf(secQs[0]);
              return (
                <div key={sec} className="space-y-2">
                  <div className="flex items-center gap-3 mb-3">
                    <span
                      className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                      style={{ background: 'rgba(138,79,208,0.3)', border: '1px solid rgba(138,79,208,0.5)' }}
                    >
                      {sec}
                    </span>
                    <span className="text-white/30 text-xs">{i(m.sectionCount, { count: secQs.length })}</span>
                  </div>
                  {secQs.map((q, idx) => (
                    <QuestionRow
                      key={q.id}
                      q={q}
                      num={globalOffset + idx + 1}
                      expanded={expandedQ === q.id}
                      onToggle={() => setExpandedQ(expandedQ === q.id ? null : q.id)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* SKIPPED TAB */}
        {tab === 'skipped' && (
          <div className="p-5 space-y-4">
            {!quiz.skippedSections || quiz.skippedSections.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-12">{m.noSkipped}</p>
            ) : (
              <>
                <p className="text-white/40 text-xs leading-relaxed">
                  {m.skippedIntro}
                </p>
                {quiz.skippedSections.map((s, idx) => (
                  <SkippedCard key={idx} s={s} />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
