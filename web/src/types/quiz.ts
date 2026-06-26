export type QuestionType = 'multiple-choice' | 'fill-blank' | 'word-formation' | 'true-false';

export interface SkippedSection {
  type: string;
  questions: string;
  points: number;
  description: string;
  examples?: string[];
}

export interface MultipleChoiceQuestion {
  id: string;
  type: 'multiple-choice';
  text: string;
  context?: string;
  section?: string;
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
  skippedSections?: SkippedSection[];
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

// Supabase row types
export interface QuizRow {
  id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  source: string | null;
  time_per_question: number;
  questions: Question[];
  skipped_sections: SkippedSection[] | null;
  created_at: string;
}

export interface SessionRow {
  id: string;
  quiz_id: string;
  teacher_id: string;
  code: string;
  is_active: boolean;
  created_at: string;
  quizzes?: QuizRow;
}

export interface AttemptRow {
  id: string;
  session_id: string;
  quiz_id: string;
  student_name: string;
  score: number;
  total_questions: number;
  time_spent_ms: number;
  answers: UserAnswer[];
  completed_at: string;
}
