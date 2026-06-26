import { supabase } from './supabase';
import type { QuizRow, SessionRow, UserAnswer } from '@/types/quiz';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateCode(): string {
  return Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}

export async function createSession(quizId: string, teacherId: string): Promise<SessionRow | null> {
  // Retry up to 5 times in case of code collision
  for (let i = 0; i < 5; i++) {
    const code = generateCode();
    const { data, error } = await supabase
      .from('sessions')
      .insert({ quiz_id: quizId, teacher_id: teacherId, code })
      .select()
      .single();
    if (!error) return data as SessionRow;
    if (!error.message.includes('duplicate')) break;
  }
  return null;
}

export async function getSessionByCode(code: string): Promise<(SessionRow & { quizzes: QuizRow }) | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*, quizzes(*)')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .single();
  if (error || !data) return null;
  return data as SessionRow & { quizzes: QuizRow };
}

export async function saveAttemptToSupabase(params: {
  sessionId: string;
  quizId: string;
  studentName: string;
  score: number;
  totalQuestions: number;
  timeSpentMs: number;
  answers: UserAnswer[];
}): Promise<string | null> {
  const { data, error } = await supabase
    .from('attempts')
    .insert({
      session_id: params.sessionId,
      quiz_id: params.quizId,
      student_name: params.studentName,
      score: params.score,
      total_questions: params.totalQuestions,
      time_spent_ms: params.timeSpentMs,
      answers: params.answers,
    })
    .select('id')
    .single();
  if (error) return null;
  return data.id;
}

export async function getAttemptsForSession(sessionId: string) {
  const { data } = await supabase
    .from('attempts')
    .select('*')
    .eq('session_id', sessionId)
    .order('completed_at', { ascending: false });
  return data ?? [];
}

export async function getStudentAttempts(sessionId: string, studentName: string) {
  const { data } = await supabase
    .from('attempts')
    .select('*')
    .eq('session_id', sessionId)
    .eq('student_name', studentName)
    .order('completed_at', { ascending: false });
  return data ?? [];
}
