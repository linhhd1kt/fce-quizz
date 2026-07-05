import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { sessionProgress } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rows = await db
    .selectDistinct({ studentName: sessionProgress.studentName })
    .from(sessionProgress)
    .where(eq(sessionProgress.sessionId, id));
  return NextResponse.json({ players: rows.map((r) => r.studentName) });
}
