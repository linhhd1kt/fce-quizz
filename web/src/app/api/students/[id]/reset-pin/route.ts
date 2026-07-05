import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/db/client';
import { students } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthTeacherId } from '@/lib/server-auth';

function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const teacherId = await getAuthTeacherId();
  if (!teacherId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const [student] = await db.select({ createdBy: students.createdBy }).from(students).where(eq(students.id, id));
  if (!student) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (student.createdBy !== teacherId) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  const pin = generatePin();
  const pinHash = await bcrypt.hash(pin, 12);

  await db.update(students).set({ pinHash }).where(and(eq(students.id, id), eq(students.createdBy, teacherId)));

  return NextResponse.json({ pin });
}
