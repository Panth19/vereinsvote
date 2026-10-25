import { createDb } from '../src/db/client.ts';
import { runMigrations } from '../src/db/migrate.ts';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://vv:vv@localhost:5432/vereinsvote_test';

export default async function setup() {
  const { db, pool } = createDb(TEST_DATABASE_URL);
  await runMigrations(db);
  await pool.end();
}
