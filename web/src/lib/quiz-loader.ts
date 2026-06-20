import type { QuizSet } from '@/types/quiz';

// Built-in quiz sets bundled with the app
const BUILT_IN_IDS = [
  // Nguyễn Huệ school exams
  'nguyen-hue-1',
  // Test 1
  'test1-part1',
  'test1-part5',
  'test1-listening',
  // Test 2
  'test2-part1',
  'test2-part5',
  'test2-listening',
  // Test 3
  'test3-part1',
  'test3-part5',
  'test3-listening',
  // Test 4
  'test4-part1',
  'test4-part5',
  'test4-listening',
];

export async function loadBuiltInQuizSets(): Promise<QuizSet[]> {
  const sets = await Promise.all(
    BUILT_IN_IDS.map(async (id) => {
      try {
        const mod = await import(`@/data/${id}.json`);
        return mod.default as QuizSet;
      } catch {
        return null;
      }
    })
  );
  return sets.filter(Boolean) as QuizSet[];
}

export function loadImportedQuizSets(): QuizSet[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('fce_imported_quizzes');
    if (!raw) return [];
    return JSON.parse(raw) as QuizSet[];
  } catch {
    return [];
  }
}

export function saveImportedQuizSet(quiz: QuizSet): void {
  const existing = loadImportedQuizSets();
  const updated = [quiz, ...existing.filter((q) => q.id !== quiz.id)];
  localStorage.setItem('fce_imported_quizzes', JSON.stringify(updated));
}

export function deleteImportedQuizSet(id: string): void {
  const existing = loadImportedQuizSets();
  const updated = existing.filter((q) => q.id !== id);
  localStorage.setItem('fce_imported_quizzes', JSON.stringify(updated));
}

export function validateQuizSet(data: unknown): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') return { valid: false, error: 'Invalid JSON object' };
  const d = data as Record<string, unknown>;
  if (typeof d.id !== 'string') return { valid: false, error: 'Missing or invalid "id" field' };
  if (typeof d.title !== 'string') return { valid: false, error: 'Missing or invalid "title" field' };
  if (!Array.isArray(d.questions)) return { valid: false, error: 'Missing or invalid "questions" array' };
  if (d.questions.length === 0) return { valid: false, error: 'Quiz must have at least one question' };
  for (const [i, q] of (d.questions as unknown[]).entries()) {
    const qi = q as Record<string, unknown>;
    if (!qi.id || !qi.type || !qi.text || !qi.answer)
      return { valid: false, error: `Question ${i + 1} missing required fields (id, type, text, answer)` };
    if (qi.type === 'multiple-choice' && !Array.isArray(qi.options))
      return { valid: false, error: `Question ${i + 1}: multiple-choice requires "options" array` };
  }
  return { valid: true };
}
