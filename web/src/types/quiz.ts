export type QuestionType = 'multiple-choice' | 'fill-blank' | 'word-formation' | 'true-false';

export interface MultipleChoiceQuestion {
  id: string;
  type: 'multiple-choice';
  text: string;
  context?: string;
  options: string[];
  answer: string;
  explanation?: string;
}

export type Question = MultipleChoiceQuestion;

export interface QuizSet {
  id: string;
  title: string;
  description: string;
  source: string;
  totalQuestions: number;
  timePerQuestion?: number;
  questions: Question[];
}

export interface UserAnswer {
  questionId: string;
  selected: string;
  correct: boolean;
  timeSpent: number;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  quizTitle: string;
  startedAt: number;
  completedAt: number;
  score: number;
  totalQuestions: number;
  totalTimeSpent: number;
  answers: UserAnswer[];
}
