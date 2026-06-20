import type { MultipleChoiceQuestion } from '@/types/quiz';

const LABELS = ['A', 'B', 'C', 'D'];

const OPTION_COLORS = [
  { base: 'bg-violet-950 border-violet-800 text-violet-200', badge: 'bg-violet-700 text-white', hover: 'hover:bg-violet-900 hover:border-violet-600' },
  { base: 'bg-sky-950 border-sky-800 text-sky-200', badge: 'bg-sky-600 text-white', hover: 'hover:bg-sky-900 hover:border-sky-600' },
  { base: 'bg-amber-950 border-amber-800 text-amber-200', badge: 'bg-amber-600 text-white', hover: 'hover:bg-amber-900 hover:border-amber-600' },
  { base: 'bg-rose-950 border-rose-800 text-rose-200', badge: 'bg-rose-700 text-white', hover: 'hover:bg-rose-900 hover:border-rose-600' },
];

interface Props {
  question: MultipleChoiceQuestion;
  selected: string | null;
  revealed: boolean;
  onSelect: (option: string) => void;
}

export default function QuestionMultipleChoice({ question, selected, revealed, onSelect }: Props) {
  return (
    <div className="space-y-5">
      {question.context && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 text-slate-300 text-sm leading-relaxed whitespace-pre-line max-h-52 overflow-y-auto">
          {question.context}
        </div>
      )}

      <p className="text-white font-semibold text-lg leading-relaxed">{question.text}</p>

      <div className="grid gap-3">
        {question.options.map((opt, i) => {
          const label = LABELS[i] ?? String(i + 1);
          const color = OPTION_COLORS[i % OPTION_COLORS.length];
          const isSelected = selected === opt;
          const isCorrect = opt === question.answer;

          let containerStyle: string;
          let badgeStyle: string;

          if (revealed) {
            if (isCorrect) {
              containerStyle = 'bg-emerald-950 border-emerald-500 text-emerald-100 cursor-default scale-[1.01]';
              badgeStyle = 'bg-emerald-500 text-white';
            } else if (isSelected && !isCorrect) {
              containerStyle = 'bg-red-950 border-red-500 text-red-200 cursor-default opacity-80';
              badgeStyle = 'bg-red-500 text-white';
            } else {
              containerStyle = 'bg-slate-900 border-slate-800 text-slate-500 cursor-default opacity-40';
              badgeStyle = 'bg-slate-700 text-slate-400';
            }
          } else if (isSelected) {
            containerStyle = `${color.base} border-2 cursor-pointer shadow-lg shadow-black/20 scale-[1.01]`;
            badgeStyle = color.badge;
          } else {
            containerStyle = `bg-slate-900 border-slate-700 text-slate-300 ${color.hover} cursor-pointer transition-all`;
            badgeStyle = 'bg-slate-700 text-slate-300 group-hover:' + color.badge;
          }

          return (
            <button
              key={opt}
              disabled={revealed}
              onClick={() => onSelect(opt)}
              className={`group flex items-center gap-4 w-full text-left rounded-2xl border p-4 transition-all duration-150 ${containerStyle}`}
            >
              <span className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold transition-colors ${badgeStyle}`}>
                {revealed && isCorrect ? '✓' : revealed && isSelected ? '✗' : label}
              </span>
              <span className="text-sm font-medium flex-1">{opt}</span>
            </button>
          );
        })}
      </div>

      {revealed && question.explanation && (
        <div className="rounded-2xl bg-blue-950/60 border border-blue-800 p-4 text-sm text-blue-200 leading-relaxed">
          <span className="font-bold text-blue-400">Giải thích: </span>
          {question.explanation}
        </div>
      )}
    </div>
  );
}
