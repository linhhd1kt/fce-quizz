import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/db/client';
import { students, studentStats } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  let body: { display_name?: string; username?: string; pin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { display_name, username, pin } = body;

  if (!display_name || typeof display_name !== 'string' || display_name.trim().length === 0) {
    return NextResponse.json({ error: 'display_name is required.' }, { status: 400 });
  }
  if (!username || !/^[a-z0-9_]{3,20}$/.test(username)) {
    return NextResponse.json({ error: 'username must be 3–20 lowercase alphanumeric/underscore characters.' }, { status: 400 });
  }
  if (!pin || !/^\d{6}$/.test(pin)) {
    return NextResponse.json({ error: 'pin must be exactly 6 digits.' }, { status: 400 });
  }

  const [existing] = await db.select({ id: students.id }).from(students).where(eq(students.username, username));
  if (existing) {
    return NextResponse.json({ error: 'Username already taken.' }, { status: 409 });
  }

  const pinHash = await bcrypt.hash(pin, 12);
  const [student] = await db.insert(students).values({
    username,
    pinHash,
    displayName: display_name.trim(),
  }).returning({ id: students.id });

  await db.insert(studentStats).values({ studentId: student.id });

  return NextResponse.json({ ok: true }, { status: 201 });
}
