import { loadConfig } from '../config.ts';
import { createDb } from './client.ts';
import { runMigrations } from './migrate.ts';

const config = loadConfig();
const { db, pool } = createDb(config.databaseUrl);
await runMigrations(db);
await pool.end();
console.log('migrations applied');
