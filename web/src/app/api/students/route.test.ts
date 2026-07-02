import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── DB mock ──────────────────────────────────────────────────────────────────
const mockStudentRows: Array<{ id: string; username: string; displayName: string; createdBy: string; createdAt: Date }> = [];

function makeDbMock() {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => Promise.resolve([...mockStudentRows])),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'new-id', username: 'alice' }]),
      }),
    }),
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }),
  };
}

vi.mock('@/db/client', () => ({ db: makeDbMock() }));
vi.mock('@/db/schema', () => ({
  students: 'students',
  studentStats: 'studentStats',
}));
vi.mock('@/lib/server-auth', () => ({ getAuthUserId: vi.fn().mockResolvedValue('teacher-1') }));

import { GET, POST } from './route';

describe('GET /api/students', () => {
  it('returns 200 with student list', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });
});

describe('POST /api/students', () => {
  it('creates student and returns username + pin', async () => {
    const res = await POST({ json: async () => ({ display_name: 'Alice Smith' }) } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty('username');
    expect(body).toHaveProperty('pin');
    expect(body.pin).toMatch(/^\d{6}$/);
  });

  it('returns 400 when display_name missing', async () => {
    const res = await POST({ json: async () => ({}) } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
  });
});
