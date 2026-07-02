import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Shared mock state ────────────────────────────────────────────────────────
let mockStudents: Array<{ id: string; username: string }> = [];

const mockSelect = vi.fn();
const mockInsert = vi.fn();

const makeChain = (rows: unknown[]) => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(rows),
  };
  return chain;
};

vi.mock('@/db/client', () => ({
  db: {
    select: () => makeChain(mockStudents),
    insert: () => makeChain([{ id: 'new-id' }]),
  },
}));
vi.mock('@/db/schema', () => ({
  students: 'students',
  studentStats: 'studentStats',
}));

import { POST } from './route';

function makeReq(body: unknown) {
  return { json: async () => body } as Parameters<typeof POST>[0];
}

describe('POST /api/student/register', () => {
  beforeEach(() => {
    mockStudents = [];
  });

  it('returns 201 for valid input', async () => {
    const res = await POST(makeReq({ display_name: 'Alice', username: 'alice_01', pin: '123456' }));
    expect(res.status).toBe(201);
  });

  it('returns 400 for bad username (spaces)', async () => {
    const res = await POST(makeReq({ display_name: 'Alice', username: 'alice 01', pin: '123456' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for username too short', async () => {
    const res = await POST(makeReq({ display_name: 'Alice', username: 'ab', pin: '123456' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-6-digit PIN', async () => {
    const res = await POST(makeReq({ display_name: 'Alice', username: 'alice_01', pin: '12345' }));
    expect(res.status).toBe(400);
    const res2 = await POST(makeReq({ display_name: 'Alice', username: 'alice_01', pin: 'abcdef' }));
    expect(res2.status).toBe(400);
  });

  it('returns 409 for duplicate username', async () => {
    mockStudents = [{ id: 'existing', username: 'alice_01' }];
    const res = await POST(makeReq({ display_name: 'Alice', username: 'alice_01', pin: '123456' }));
    expect(res.status).toBe(409);
  });
});
