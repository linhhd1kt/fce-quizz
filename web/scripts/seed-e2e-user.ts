// One-shot script: create E2E test teacher account
// Run: npx tsx scripts/seed-e2e-user.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { authUsers } from '../src/db/schema';
import { eq } from 'drizzle-orm';

const E2E_EMAIL = 'e2e-test@fce-quiz.local';
const E2E_PASSWORD = 'e2e-test-2026';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

async function main() {
  const existing = await db.select({ id: authUsers.id }).from(authUsers).where(eq(authUsers.email, E2E_EMAIL));
  if (existing.length > 0) {
    console.log(`Test user already exists: ${E2E_EMAIL}`);
    await client.end();
    return;
  }

  const hash = await bcrypt.hash(E2E_PASSWORD, 10);
  await db.insert(authUsers).values({
    email: E2E_EMAIL,
    name: 'E2E Test Teacher',
    password: hash,
  });

  console.log(`Created test user: ${E2E_EMAIL} / ${E2E_PASSWORD}`);
  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
