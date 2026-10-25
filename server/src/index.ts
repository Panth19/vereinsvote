import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createDb } from './db/client.ts';
import { runMigrations } from './db/migrate.ts';
import { users } from './db/schema.ts';
import { seedDemo } from './db/seed-demo.ts';
import { createMailer } from './lib/mailer.ts';
import { getCompetitionRow, getLeaderboard } from './services/competitions.ts';
import { LeaderboardHub } from './services/leaderboard-hub.ts';

const config = loadConfig();
const { db, pool } = createDb(config.databaseUrl);
const hub = new LeaderboardHub(async (id) => getLeaderboard(db, await getCompetitionRow(db, { id })));

const app = await buildApp(
  { db, config, hub, mailer: createMailer(config.smtpUrl, config.mailFrom), now: () => new Date() },
  { logger: { level: 'info', redact: ['req.headers.cookie'] } },
);

if (config.runMigrations) await runMigrations(db);

// for demo deployments: fill an empty database on first start
if (config.seedDemoData) {
  const [anyUser] = await db.select({ id: users.id }).from(users).limit(1);
  if (!anyUser) {
    await seedDemo(db, { secret: config.appSecret });
    app.log.info('empty database, demo data created');
  }
}

if (config.demoMode) app.log.warn('demo mode: confirmation links are returned by the API, not emailed');

async function shutdown() {
  hub.close();
  await app.close();
  await pool.end();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.listen({ port: config.port, host: config.host });
