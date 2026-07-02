import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auth } from '@/auth';

const mockWhere = vi.fn();
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

const mockOnConflict = vi.fn().mockResolvedValue(undefined);
const mockValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflict }));
const mockInsert = vi.fn(() => ({ values: mockValues }));

vi.mock('@/db/client', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
  },
}));

vi.mock('@/db/schema', () => ({
  quizzes: {},
  studentQuestionStats: { studentId: {}, quizId: {}, questionId: {} },
}));

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm');
  return {
    ...actual,
    eq: vi.fn(() => ({})),
    and: vi.fn(() => ({})),
    inArray: vi.fn(() => ({})),
    sql: vi.fn((s: TemplateStringsArray) => s[0]),
  };
});

const pastDate = new Date(Date.now() - 1000);
const futureDate = new Date(Date.now() + 86400000);

const mockQuiz = {
  id: 'quiz-1',
  title: 'Test Quiz',
  questions: [
    { id: 'q1', text: 'Q1', options: ['A','B','C','D'], answer: 'A', explanation: null },
    { id: 'q2', text: 'Q2', options: ['A','B','C','D'], answer: 'B', explanation: null },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockInsert.mockReturnValue({ values: mockValues });
  mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflict });
  mockOnConflict.mockResolvedValue(undefined);
  vi.mocked(auth).mockResolvedValue({ user: { id: 'student-1', role: 'student' } } as never);
});

describe('GET /api/student/practice/[quizId]', () => {
  it('returns 401 for unauthenticated request', async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const { GET } = await import('./route');
    const req = new Request('http://localhost/api/student/practice/quiz-1');
    const res = await GET(req, { params: Promise.resolve({ quizId: 'quiz-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 401 for teacher role', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'teacher-1', role: 'teacher' } } as never);
    const { GET } = await import('./route');
    const req = new Request('http://localhost/api/student/practice/quiz-1');
    const res = await GET(req, { params: Promise.resolve({ quizId: 'quiz-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when quiz not found', async () => {
    mockWhere.mockResolvedValue([]);
    const { GET } = await import('./route');
    const req = new Request('http://localhost/api/student/practice/quiz-1');
    const res = await GET(req, { params: Promise.resolve({ quizId: 'quiz-1' }) });
    expect(res.status).toBe(404);
  });

  it('returns all questions as due when no stats exist', async () => {
    mockWhere
      .mockResolvedValueOnce([mockQuiz])
      .mockResolvedValueOnce([]);
    const { GET } = await import('./route');
    const req = new Request('http://localhost/api/student/practice/quiz-1');
    const res = await GET(req, { params: Promise.resolve({ quizId: 'quiz-1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dueCount).toBe(2);
    expect(body.questions).toHaveLength(2);
  });

  it('returns empty when all questions have future next_review_at', async () => {
    mockWhere
      .mockResolvedValueOnce([mockQuiz])
      .mockResolvedValueOnce([
        { questionId: 'q1', nextReviewAt: futureDate, easeFactor: 2.5, repetitions: 1 },
        { questionId: 'q2', nextReviewAt: futureDate, easeFactor: 2.5, repetitions: 1 },
      ]);
    const { GET } = await import('./route');
    const req = new Request('http://localhost/api/student/practice/quiz-1');
    const res = await GET(req, { params: Promise.resolve({ quizId: 'quiz-1' }) });
    const body = await res.json();
    expect(body.dueCount).toBe(0);
    expect(body.questions).toHaveLength(0);
    expect(body.nextReviewAt).toBeTruthy();
  });

  it('includes questions with past next_review_at', async () => {
    mockWhere
      .mockResolvedValueOnce([mockQuiz])
      .mockResolvedValueOnce([
        { questionId: 'q1', nextReviewAt: pastDate, easeFactor: 2.0, repetitions: 2 },
        { questionId: 'q2', nextReviewAt: futureDate, easeFactor: 2.5, repetitions: 1 },
      ]);
    const { GET } = await import('./route');
    const req = new Request('http://localhost/api/student/practice/quiz-1');
    const res = await GET(req, { params: Promise.resolve({ quizId: 'quiz-1' }) });
    const body = await res.json();
    expect(body.dueCount).toBe(1);
    expect(body.questions[0].id).toBe('q1');
  });
});

describe('POST /api/student/practice/[quizId]', () => {
  it('returns 400 when answers missing', async () => {
    const { POST } = await import('./route');
    const req = new Request('http://localhost/api/student/practice/quiz-1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req, { params: Promise.resolve({ quizId: 'quiz-1' }) });
    expect(res.status).toBe(400);
  });

  it('upserts SM-2 for each answer and returns ok', async () => {
    mockWhere.mockResolvedValue([]);
    const { POST } = await import('./route');
    const req = new Request('http://localhost/api/student/practice/quiz-1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answers: [
          { questionId: 'q1', isCorrect: true },
          { questionId: 'q2', isCorrect: false },
        ],
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ quizId: 'quiz-1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.updatedCount).toBe(2);
    expect(mockOnConflict).toHaveBeenCalledTimes(2);
  });
});
