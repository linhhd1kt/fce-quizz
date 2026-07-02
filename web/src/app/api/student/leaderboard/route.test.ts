import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auth } from '@/auth';

const mockLimit = vi.fn();
const mockOrderBy = vi.fn(() => ({ limit: mockLimit }));
const mockInnerJoin = vi.fn(() => ({ orderBy: mockOrderBy }));
const mockFrom = vi.fn(() => ({ innerJoin: mockInnerJoin }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

vi.mock('@/db/client', () => ({
  db: { select: mockSelect },
}));

vi.mock('@/db/schema', () => ({
  students: { displayName: {}, id: {} },
  studentStats: { studentId: {}, totalCorrect: {}, totalGames: {} },
}));

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm');
  return { ...actual, eq: vi.fn(() => ({})), desc: vi.fn((c) => c) };
});

beforeEach(() => {
  vi.resetAllMocks();
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ innerJoin: mockInnerJoin });
  mockInnerJoin.mockReturnValue({ orderBy: mockOrderBy });
  mockOrderBy.mockReturnValue({ limit: mockLimit });
  vi.mocked(auth).mockResolvedValue({ user: { id: 'student-1', role: 'student' } } as never);
});

describe('GET /api/student/leaderboard', () => {
  it('returns 401 for unauthenticated request', async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const { GET } = await import('./route');
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 401 for teacher role', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 't-1', role: 'teacher' } } as never);
    const { GET } = await import('./route');
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns ranked list ordered by totalCorrect', async () => {
    mockLimit.mockResolvedValue([
      { displayName: 'Alice', totalCorrect: 100, totalGames: 10 },
      { displayName: 'Bob',   totalCorrect: 80,  totalGames: 8  },
    ]);
    const { GET } = await import('./route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0]).toEqual({ rank: 1, displayName: 'Alice', totalCorrect: 100, totalGames: 10 });
    expect(body[1]).toEqual({ rank: 2, displayName: 'Bob',   totalCorrect: 80,  totalGames: 8  });
  });

  it('returns empty array when no students have stats', async () => {
    mockLimit.mockResolvedValue([]);
    const { GET } = await import('./route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });
});
