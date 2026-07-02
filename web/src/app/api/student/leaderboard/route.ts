import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { students, studentStats } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== 'student') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await db
    .select({
      displayName: students.displayName,
      totalCorrect: studentStats.totalCorrect,
      totalGames: studentStats.totalGames,
    })
    .from(studentStats)
    .innerJoin(students, eq(studentStats.studentId, students.id))
    .orderBy(desc(studentStats.totalCorrect))
    .limit(10);

  const result = rows.map((row, i) => ({ rank: i + 1, ...row }));
  return NextResponse.json(result);
}
