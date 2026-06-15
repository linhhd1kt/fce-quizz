import Link from 'next/link';
import type { QuizSet } from '@/types/quiz';

interface QuizCardProps {
  quiz: QuizSet;
  bestScore?: number;
}

export default function QuizCard({ quiz, bestScore }: QuizCardProps) {
  return (
    <div className="group bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-2xl p-5 transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{quiz.title}</h3>
          <p className="text-sm text-slate-400 mt-1 line-clamp-2">{quiz.description}</p>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-xs bg-slate-800 border border-slate-700 text-slate-400 px-2 py-0.5 rounded-md">
              {quiz.totalQuestions} questions
            </span>
            {quiz.timePerQuestion && (
              <span className="text-xs bg-slate-800 border border-slate-700 text-slate-400 px-2 py-0.5 rounded-md">
                {quiz.timePerQuestion}s / question
              </span>
            )}
            {bestScore !== undefined && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                bestScore >= 75 ? 'bg-emerald-950 border border-emerald-800 text-emerald-400' :
                bestScore >= 60 ? 'bg-yellow-950 border border-yellow-800 text-yellow-400' :
                'bg-red-950 border border-red-800 text-red-400'
              }`}>
                Best: {bestScore}%
              </span>
            )}
          </div>
        </div>
        <Link
          href={`/quiz/${quiz.id}`}
          className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Start
        </Link>
      </div>
      <p className="text-xs text-slate-600 mt-3">{quiz.source}</p>
    </div>
  );
}
