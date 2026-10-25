import { loadConfig } from '../config.ts';
import { createDb } from './client.ts';
import { runMigrations } from './migrate.ts';
import { DEMO_ADMIN_EMAIL, DEMO_CLUB_EMAIL, DEMO_PASSWORD, seedDemo } from './seed-demo.ts';
import { users } from './schema.ts';

const reset = process.argv.includes('--reset');
const config = loadConfig();
const { db, pool } = createDb(config.databaseUrl);
await runMigrations(db);

const existing = await db.select({ id: users.id }).from(users).limit(1);
if (existing.length > 0 && !reset) {
  console.log('Database already has data. Run with --reset to wipe it and seed fresh demo data.');
} else {
  await seedDemo(db, { reset, secret: config.appSecret });
  console.log('Demo data created.');
  console.log(`  sponsor: ${DEMO_ADMIN_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  club:    ${DEMO_CLUB_EMAIL} / ${DEMO_PASSWORD}`);
}
await pool.end();
