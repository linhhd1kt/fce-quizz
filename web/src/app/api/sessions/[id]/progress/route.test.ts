import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelectResult = vi.fn();
const mockInsertValues = vi.fn();
const mockOnConflictDoUpdate = vi.fn();

vi.mock('@/db/client', () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: mockSelectResult })) })),
    insert: vi.fn(() => ({ values: mockInsertValues })),
  },
}));

vi.mock('@/db/schema', () => ({
  sessions: {},
  sessionProgress: {},
}));

vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm');
  return { ...actual, eq: vi.fn(() => ({})), sql: vi.fn((s: TemplateStringsArray) => s[0]) };
});

beforeEach(() => {
  vi.resetModules();
  mockSelectResult.mockResolvedValue([{ id: 'sess-1', isActive: true }]);
  mockInsertValues.mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
  mockOnConflictDoUpdate.mockResolvedValue(undefined);
});

describe('POST /api/sessions/[id]/progress', () => {
  it('returns 400 when studentName is missing', async () => {
    const { POST } = await import('./route');
    const req = new Request('http://localhost/api/sessions/sess-1/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionIndex: 0, isCorrect: true, totalQuestions: 10 }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'sess-1' }) });
    expect(res.status).toBe(400);
  });

  it('returns 404 when session is inactive', async () => {
    mockSelectResult.mockResolvedValue([{ id: 'sess-1', isActive: false }]);
    const { POST } = await import('./route');
    const req = new Request('http://localhost/api/sessions/sess-1/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentName: 'Alice', questionIndex: 0, isCorrect: true, totalQuestions: 10 }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'sess-1' }) });
    expect(res.status).toBe(404);
  });

  it('returns 404 when session does not exist', async () => {
    mockSelectResult.mockResolvedValue([]);
    const { POST } = await import('./route');
    const req = new Request('http://localhost/api/sessions/sess-1/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentName: 'Alice', questionIndex: 0, isCorrect: true, totalQuestions: 10 }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'sess-1' }) });
    expect(res.status).toBe(404);
  });

  it('upserts progress and returns ok:true on valid request', async () => {
    const { POST } = await import('./route');
    const req = new Request('http://localhost/api/sessions/sess-1/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentName: 'Alice', questionIndex: 4, isCorrect: true, totalQuestions: 15 }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'sess-1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockOnConflictDoUpdate).toHaveBeenCalled();
  });

  it('sets isFinished when last question answered', async () => {
    const { POST } = await import('./route');
    const req = new Request('http://localhost/api/sessions/sess-1/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentName: 'Alice', questionIndex: 14, isCorrect: false, totalQuestions: 15 }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'sess-1' }) });
    expect(res.status).toBe(200);
    const insertCall = mockInsertValues.mock.lastCall?.[0];
    expect(insertCall.isFinished).toBe(true);
  });
});
