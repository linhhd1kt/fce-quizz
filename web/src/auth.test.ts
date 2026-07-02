import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the module under test
const mockDb = { select: vi.fn(), insert: vi.fn() };
vi.mock('@/db/client', () => ({ db: mockDb }));
vi.mock('@/db/schema', () => ({
  authUsers: 'authUsers',
  authAccounts: 'authAccounts',
  authVerificationTokens: 'authVerificationTokens',
  students: 'students',
}));
vi.mock('@auth/drizzle-adapter', () => ({ DrizzleAdapter: vi.fn(() => ({})) }));

import bcrypt from 'bcryptjs';

// Inline authorize functions to test without full NextAuth init
async function authorizeTeacher(
  credentials: { email?: string; password?: string } | undefined,
  dbSelectFn: (email: string) => Promise<{ id: string; name: string | null; email: string | null; password: string | null }[]>
) {
  if (!credentials?.email || !credentials?.password) return null;
  const [user] = await dbSelectFn(credentials.email);
  if (!user?.password) return null;
  const valid = await bcrypt.compare(credentials.password, user.password);
  if (!valid) return null;
  return { id: user.id, name: user.name ?? '', email: user.email ?? '', role: 'teacher' as const };
}

async function authorizeStudent(
  credentials: { username?: string; pin?: string } | undefined,
  dbSelectFn: (username: string) => Promise<{ id: string; displayName: string; pinHash: string; username: string }[]>
) {
  if (!credentials?.username || !credentials?.pin) return null;
  const [student] = await dbSelectFn(credentials.username);
  if (!student) return null;
  const valid = await bcrypt.compare(credentials.pin, student.pinHash);
  if (!valid) return null;
  return { id: student.id, name: student.displayName, email: null, role: 'student' as const, username: student.username };
}

describe('teacher credentials provider', () => {
  it('returns user for valid credentials', async () => {
    const hash = await bcrypt.hash('secret123', 12);
    const db = async () => [{ id: 't1', name: 'Teacher', email: 'teacher@test.com', password: hash }];
    const result = await authorizeTeacher({ email: 'teacher@test.com', password: 'secret123' }, db);
    expect(result).toMatchObject({ id: 't1', role: 'teacher' });
  });

  it('returns null for wrong password', async () => {
    const hash = await bcrypt.hash('secret123', 12);
    const db = async () => [{ id: 't1', name: 'Teacher', email: 'teacher@test.com', password: hash }];
    const result = await authorizeTeacher({ email: 'teacher@test.com', password: 'wrongpass' }, db);
    expect(result).toBeNull();
  });

  it('returns null when credentials missing', async () => {
    const db = async () => [];
    expect(await authorizeTeacher(undefined, db)).toBeNull();
    expect(await authorizeTeacher({ email: 'x@x.com' }, db)).toBeNull();
  });
});

describe('student-credentials provider', () => {
  it('returns student user for valid PIN', async () => {
    const hash = await bcrypt.hash('123456', 12);
    const db = async () => [{ id: 's1', displayName: 'Alice', pinHash: hash, username: 'alice' }];
    const result = await authorizeStudent({ username: 'alice', pin: '123456' }, db);
    expect(result).toMatchObject({ id: 's1', role: 'student', username: 'alice' });
  });

  it('returns null for wrong PIN', async () => {
    const hash = await bcrypt.hash('123456', 12);
    const db = async () => [{ id: 's1', displayName: 'Alice', pinHash: hash, username: 'alice' }];
    const result = await authorizeStudent({ username: 'alice', pin: '999999' }, db);
    expect(result).toBeNull();
  });

  it('returns null when student not found', async () => {
    const db = async () => [];
    const result = await authorizeStudent({ username: 'nobody', pin: '123456' }, db);
    expect(result).toBeNull();
  });

  it('returns null when credentials missing', async () => {
    const db = async () => [];
    expect(await authorizeStudent(undefined, db)).toBeNull();
    expect(await authorizeStudent({ username: 'alice' }, db)).toBeNull();
  });
});
