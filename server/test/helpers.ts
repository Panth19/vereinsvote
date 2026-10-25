import { sql } from 'drizzle-orm';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { buildApp } from '../src/app.ts';
import { hashPassword } from '../src/auth.ts';
import { loadConfig } from '../src/config.ts';
import { createDb, type Db } from '../src/db/client.ts';
import { competitions, projects, users } from '../src/db/schema.ts';
import type { Mail } from '../src/lib/mailer.ts';
import { LeaderboardHub } from '../src/services/leaderboard-hub.ts';
import { getCompetitionRow, getLeaderboard } from '../src/services/competitions.ts';
import { TEST_DATABASE_URL } from './global-setup.ts';

const DAY = 86_400_000;

export interface TestContext {
  app: FastifyInstance;
  db: Db;
  mails: Mail[];
  clock: { now: Date };
  close: () => Promise<void>;
}

// `env` overrides settings, e.g. { VOTE_RATE_LIMIT_PER_HOUR: '3' }
export async function createTestApp(env: Record<string, string> = {}): Promise<TestContext> {
  const config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    APP_URL: 'https://vote.test',
    // high limits by default, so only the rate limit tests hit them
    RATE_LIMIT_PER_MINUTE: '100000',
    VOTE_RATE_LIMIT_PER_HOUR: '100000',
    LOGIN_RATE_LIMIT_PER_MINUTE: '100000',
    ...env,
  });
  const { db, pool } = createDb(TEST_DATABASE_URL);
  const mails: Mail[] = [];
  const clock = { now: new Date() };
  const hub = new LeaderboardHub(async (id) => getLeaderboard(db, await getCompetitionRow(db, { id })), 10);
  const app = await buildApp({
    db,
    config,
    hub,
    mailer: { send: async (m) => void mails.push(m) },
    now: () => clock.now,
  }, { webDist: '/nonexistent' });
  return {
    app,
    db,
    mails,
    clock,
    close: async () => {
      hub.close();
      await app.close();
      await pool.end();
    },
  };
}

export async function resetDb(db: Db) {
  await db.execute(sql`TRUNCATE votes, projects, competitions, sessions, users RESTART IDENTITY CASCADE`);
}

export async function createUser(db: Db, role: 'admin' | 'club', email: string, name = email.split('@')[0]!) {
  const [u] = await db
    .insert(users)
    .values({ email, passwordHash: await hashPassword('password123'), role, name, city: 'Cottbus' })
    .returning();
  return u!;
}

export async function login(app: FastifyInstance, email: string): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: 'password123' } });
  if (res.statusCode !== 200) throw new Error(`login failed: ${res.body}`);
  const c = res.cookies.find((c) => c.name === 'vv_session')!;
  return `vv_session=${c.value}`;
}

// a competition in the voting phase with two approved projects and one pending
export async function seedVotingCompetition(db: Db) {
  const admin = await createUser(db, 'admin', 'sponsor@test.de', 'Sponsor AG');
  const clubA = await createUser(db, 'club', 'a@club.de', 'Club A');
  const clubB = await createUser(db, 'club', 'b@club.de', 'Club B');
  const clubC = await createUser(db, 'club', 'c@club.de', 'Club C');
  const now = Date.now();
  const [competition] = await db
    .insert(competitions)
    .values({
      slug: 'test-preis',
      title: 'Test Preis',
      description: 'A competition used in tests.',
      sponsorName: admin.name,
      region: 'Lausitz',
      budgetCents: 10_000_00,
      prizeShares: [60, 40],
      submissionStartsAt: new Date(now - 20 * DAY),
      votingStartsAt: new Date(now - 5 * DAY),
      votingEndsAt: new Date(now + 5 * DAY),
      createdBy: admin.id,
    })
    .returning();
  const base = { competitionId: competition!.id, summary: 'A summary that is long enough.', description: 'x'.repeat(60), fundingGoalCents: 100000 };
  const [a, b, pending] = await db
    .insert(projects)
    .values([
      { ...base, clubId: clubA.id, title: 'Project A', category: 'sport', status: 'approved' },
      { ...base, clubId: clubB.id, title: 'Project B', category: 'youth', status: 'approved' },
      { ...base, clubId: clubC.id, title: 'Project C', category: 'culture', status: 'pending' },
    ])
    .returning();
  return { admin, clubA, clubB, clubC, competition: competition!, a: a!, b: b!, pending: pending!, DAY };
}

export const json = (res: LightMyRequestResponse): any => JSON.parse(res.body);

export function tokenFrom(res: LightMyRequestResponse): string {
  return new URL(json(res).demoConfirmUrl).searchParams.get('token')!;
}
