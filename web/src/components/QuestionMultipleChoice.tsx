import type { MultipleChoiceQuestion } from '@/types/quiz';

const LABELS = ['A', 'B', 'C', 'D'];

interface Props {
  question: MultipleChoiceQuestion;
  selected: string | null;
  revealed: boolean;
  onSelect: (option: string) => void;
}

export default function QuestionMultipleChoice({ question, selected, revealed, onSelect }: Props) {
  return (
    <div className="space-y-4">
      {question.context && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-slate-300 text-sm leading-relaxed whitespace-pre-line">
          {question.context}
        </div>
      )}

      <p className="text-white font-medium text-lg">{question.text}</p>

      <div className="grid gap-2.5">
        {question.options.map((opt, i) => {
          const label = LABELS[i] ?? String(i + 1);
          const isSelected = selected === opt;
          const isCorrect = opt === question.answer;

          let optionStyle =
            'border-slate-700 bg-slate-800 hover:border-blue-500 hover:bg-slate-700 cursor-pointer';

          if (revealed) {
            if (isCorrect) {
              optionStyle = 'border-emerald-500 bg-emerald-950 cursor-default';
            } else if (isSelected && !isCorrect) {
              optionStyle = 'border-red-500 bg-red-950 cursor-default';
            } else {
              optionStyle = 'border-slate-700 bg-slate-800/50 opacity-50 cursor-default';
            }
          } else if (isSelected) {
            optionStyle = 'border-blue-500 bg-blue-950 cursor-pointer';
          }

          return (
            <button
              key={opt}
              disabled={revealed}
              onClick={() => onSelect(opt)}
              className={`flex items-center gap-3 w-full text-left rounded-xl border p-3.5 transition-all ${optionStyle}`}
            >
              <span className="shrink-0 w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                {label}
              </span>
              <span className="text-sm text-slate-200">{opt}</span>
              {revealed && isCorrect && (
                <span className="ml-auto text-emerald-400 text-lg">✓</span>
              )}
              {revealed && isSelected && !isCorrect && (
                <span className="ml-auto text-red-400 text-lg">✗</span>
              )}
            </button>
          );
        })}
      </div>

      {revealed && question.explanation && (
        <div className="mt-2 rounded-xl bg-slate-800 border border-slate-700 p-3.5 text-sm text-slate-300">
          <span className="font-semibold text-blue-400">Explanation: </span>
          {question.explanation}
        </div>
      )}
    </div>
  );
}
