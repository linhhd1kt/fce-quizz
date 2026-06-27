import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/db/client';
import { authUsers } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json();
  if (!email || !password || password.length < 8) {
    return NextResponse.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 });
  }

  const [existing] = await db.select({ id: authUsers.id }).from(authUsers).where(eq(authUsers.email, email));
  if (existing) {
    return NextResponse.json({ error: 'Email đã được sử dụng.' }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 12);
  await db.insert(authUsers).values({ name: name || email, email, password: hashed });
  return NextResponse.json({ ok: true }, { status: 201 });
}
