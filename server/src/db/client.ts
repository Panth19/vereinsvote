import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.ts';

export type Db = NodePgDatabase<typeof schema>;

// Hosted databases need TLS: add ?sslmode=require to DATABASE_URL (Neon URLs already have it).
export function createDb(databaseUrl: string) {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 10 });
  return { db: drizzle(pool, { schema }) as Db, pool };
}
