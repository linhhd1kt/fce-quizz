import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import path from 'path';

async function main() {
  const pg = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(pg);
  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: path.join(process.cwd(), 'src/db/migrations') });
  console.log('Migrations complete');
  await pg.end();
}

main().catch((e) => { console.error('Migration failed:', e); process.exit(1); });
