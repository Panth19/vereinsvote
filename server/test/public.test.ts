import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEMO_ADMIN_EMAIL, DEMO_PASSWORD, seedDemo } from '../src/db/seed-demo.ts';
import { createTestApp, json, resetDb, type TestContext } from './helpers.ts';

let t: TestContext;

beforeAll(async () => {
  t = await createTestApp();
  await resetDb(t.db);
  await seedDemo(t.db, { secret: 'test-secret-1234567' });
});
afterAll(async () => t.close());

describe('demo data and public pages', () => {
  it('has one competition in each phase, active ones first', async () => {
    const list = json(await t.app.inject({ url: '/api/competitions' }));
    expect(list.map((c: any) => c.phase)).toEqual(['voting', 'submission', 'ended']);
    const live = list[0];
    expect(live).toMatchObject({ slug: 'vereinspreis-lausitz-2026', projectCount: 8, totalVotes: 1221 });
  });

  it('serves a competition, its projects filtered by category, and a project page', async () => {
    const detail = json(await t.app.inject({ url: '/api/competitions/vereinspreis-lausitz-2026' }));
    expect(detail.description.length).toBeGreaterThan(50);

    const sport = json(await t.app.inject({ url: '/api/competitions/vereinspreis-lausitz-2026/projects?category=sport' }));
    expect(sport.length).toBeGreaterThan(0);
    expect(sport.every((p: any) => p.category === 'sport')).toBe(true);

    const page = json(await t.app.inject({ url: `/api/projects/${sport[0].id}` }));
    expect(page.project.id).toBe(sport[0].id);
    expect(page.competition.slug).toBe('vereinspreis-lausitz-2026');
  });

  it('pays out exactly the budget in the ended competition', async () => {
    const board = json(await t.app.inject({ url: '/api/competitions/jugendsport-2026/leaderboard' }));
    expect(board.phase).toBe('ended');
    expect(board.entries.reduce((s: number, e: any) => s + e.payoutCents, 0)).toBe(5_000_00);
  });

  it('returns 404 for unknown competitions and hidden projects', async () => {
    expect((await t.app.inject({ url: '/api/competitions/does-not-exist' })).statusCode).toBe(404);
    expect((await t.app.inject({ url: '/api/projects/00000000-0000-4000-8000-000000000000' })).statusCode).toBe(404);
    expect((await t.app.inject({ url: '/api/projects/not-a-uuid' })).statusCode).toBe(400);
  });

  it('lets the demo sponsor log in', async () => {
    const res = await t.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: DEMO_ADMIN_EMAIL, password: DEMO_PASSWORD } });
    expect(res.statusCode).toBe(200);
  });

  it('reports healthy', async () => {
    expect(json(await t.app.inject({ url: '/api/health' }))).toEqual({ status: 'ok' });
  });
});
