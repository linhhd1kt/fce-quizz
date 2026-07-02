import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/db/client';
import { students, studentStats } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthUserId } from '@/lib/server-auth';

function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateUsername(displayName: string): string {
  return displayName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

export async function GET() {
  const teacherId = await getAuthUserId();
  if (!teacherId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await db
    .select({
      id: students.id,
      username: students.username,
      displayName: students.displayName,
      createdAt: students.createdAt,
    })
    .from(students)
    .where(eq(students.createdBy, teacherId));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const teacherId = await getAuthUserId();
  if (!teacherId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { display_name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { display_name } = body;
  if (!display_name || typeof display_name !== 'string' || display_name.trim().length === 0) {
    return NextResponse.json({ error: 'display_name is required.' }, { status: 400 });
  }

  const base = generateUsername(display_name.trim()) || 'student';
  let username = base;
  let suffix = 1;

  while (true) {
    const [existing] = await db.select({ id: students.id }).from(students).where(eq(students.username, username));
    if (!existing) break;
    username = `${base}_${suffix++}`;
  }

  const pin = generatePin();
  const pinHash = await bcrypt.hash(pin, 12);

  const [student] = await db.insert(students).values({
    username,
    pinHash,
    displayName: display_name.trim(),
    createdBy: teacherId,
  }).returning({ id: students.id, username: students.username });

  await db.insert(studentStats).values({ studentId: student.id });

  return NextResponse.json({ id: student.id, username: student.username, pin }, { status: 201 });
}
