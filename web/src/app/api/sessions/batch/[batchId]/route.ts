import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { sessions } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const parts = await db
    .select({ id: sessions.id, code: sessions.code, batchOrder: sessions.batchOrder })
    .from(sessions)
    .where(eq(sessions.batchId, batchId))
    .orderBy(asc(sessions.batchOrder));
  return NextResponse.json(parts);
}
