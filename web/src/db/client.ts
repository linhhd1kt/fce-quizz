import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

declare global {
  // eslint-disable-next-line no-var
  var _pg: postgres.Sql | undefined;
}

const pg = global._pg ?? postgres(process.env.DATABASE_URL!);
if (process.env.NODE_ENV !== 'production') global._pg = pg;

export const db = drizzle(pg, { schema });
