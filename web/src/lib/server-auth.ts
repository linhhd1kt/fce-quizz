import { auth } from '@/auth';

export async function getAuthUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function getAuthTeacherId(): Promise<string | null> {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== 'teacher') return null;
  return session?.user?.id ?? null;
}
