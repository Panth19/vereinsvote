import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, createUser, json, login, resetDb, seedVotingCompetition, tokenFrom, type TestContext } from './helpers.ts';

let t: TestContext;
let s: Awaited<ReturnType<typeof seedVotingCompetition>>;

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => t.close());
beforeEach(async () => {
  await resetDb(t.db);
  t.clock.now = new Date();
  s = await seedVotingCompetition(t.db);
});

const DAY = 86_400_000;
const competitionBody = (overrides: object = {}) => ({
  title: 'Klimapreis 2027',
  description: 'Small climate projects from local clubs in the region.',
  region: 'Spreewald',
  budgetEuro: 8000,
  prizeShares: [50, 30, 20],
  submissionStartsAt: new Date(Date.now() - DAY).toISOString(),
  votingStartsAt: new Date(Date.now() + 10 * DAY).toISOString(),
  votingEndsAt: new Date(Date.now() + 20 * DAY).toISOString(),
  ...overrides,
});

describe('auth', () => {
  it('registers a club and keeps it logged in with a session cookie', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'Neu@Verein.de', password: 'longenough', name: 'SV Neu', city: 'Guben' },
    });
    expect(res.statusCode).toBe(201);
    const cookie = res.cookies.find((c) => c.name === 'vv_session')!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('Lax');
    const me = json(await t.app.inject({ url: '/api/auth/me', headers: { cookie: `vv_session=${cookie.value}` } }));
    expect(me.user).toMatchObject({ email: 'neu@verein.de', role: 'club', name: 'SV Neu' });
  });

  it('explains invalid input in German, per field', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'kein-at-zeichen', password: 'kurz', name: 'SV', city: 'Guben' },
    });
    expect(res.statusCode).toBe(400);
    const byField = Object.fromEntries(json(res).issues.map((i: any) => [i.path, i.message]));
    expect(byField).toEqual({
      email: 'Bitte eine gültige E-Mail-Adresse eingeben',
      password: 'Das Passwort muss mindestens 8 Zeichen haben',
    });
  });

  it('does not allow two accounts with the same email', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'A@club.de', password: 'longenough', name: 'Copy', city: 'Guben' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('gives the same answer for wrong password and unknown email', async () => {
    const wrong = await t.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'a@club.de', password: 'nope' } });
    const unknown = await t.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'x@y.de', password: 'nope' } });
    expect(wrong.statusCode).toBe(401);
    expect(wrong.body).toBe(unknown.body);
  });

  it('logout ends the session on the server', async () => {
    const cookie = await login(t.app, 'a@club.de');
    await t.app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
    const me = json(await t.app.inject({ url: '/api/auth/me', headers: { cookie } }));
    expect(me.user).toBeNull();
  });
});

describe('sponsor (admin)', () => {
  it('creates a competition with a readable URL slug', async () => {
    const cookie = await login(t.app, 'sponsor@test.de');
    const res = await t.app.inject({ method: 'POST', url: '/api/admin/competitions', headers: { cookie }, payload: competitionBody({ title: 'Förderpreis Süd 2027' }) });
    expect(res.statusCode).toBe(201);
    expect(json(res).slug).toBe('foerderpreis-sued-2027');
    const second = await t.app.inject({ method: 'POST', url: '/api/admin/competitions', headers: { cookie }, payload: competitionBody({ title: 'Förderpreis Süd 2027' }) });
    expect(json(second).slug).toBe('foerderpreis-sued-2027-2');
  });

  it('rejects prize shares that do not add up to 100% and dates in the wrong order', async () => {
    const cookie = await login(t.app, 'sponsor@test.de');
    const shares = await t.app.inject({ method: 'POST', url: '/api/admin/competitions', headers: { cookie }, payload: competitionBody({ prizeShares: [50, 30] }) });
    expect(shares.statusCode).toBe(400);
    const dates = await t.app.inject({
      method: 'POST',
      url: '/api/admin/competitions',
      headers: { cookie },
      payload: competitionBody({ votingEndsAt: new Date(Date.now()).toISOString() }),
    });
    expect(dates.statusCode).toBe(400);
    expect(json(dates).issues[0].path).toBe('votingEndsAt');
  });

  it('approves a pending project, which then appears publicly', async () => {
    const cookie = await login(t.app, 'sponsor@test.de');
    const res = await t.app.inject({ method: 'POST', url: `/api/admin/projects/${s.pending.id}/moderate`, headers: { cookie }, payload: { status: 'approved' } });
    expect(res.statusCode).toBe(200);
    const list = json(await t.app.inject({ url: '/api/competitions/test-preis/projects' }));
    expect(list.map((p: any) => p.title)).toContain('Project C');
  });

  it('requires a reason when rejecting', async () => {
    const cookie = await login(t.app, 'sponsor@test.de');
    const res = await t.app.inject({ method: 'POST', url: `/api/admin/projects/${s.pending.id}/moderate`, headers: { cookie }, payload: { status: 'rejected' } });
    expect(res.statusCode).toBe(400);
  });

  it("cannot see or change another sponsor's competition", async () => {
    await createUser(t.db, 'admin', 'other@sponsor.de');
    const cookie = await login(t.app, 'other@sponsor.de');
    const stats = await t.app.inject({ url: `/api/admin/competitions/${s.competition.id}/stats`, headers: { cookie } });
    expect(stats.statusCode).toBe(403);
    const mod = await t.app.inject({ method: 'POST', url: `/api/admin/projects/${s.pending.id}/moderate`, headers: { cookie }, payload: { status: 'approved' } });
    expect(mod.statusCode).toBe(403);
  });

  it('reports stats and exports a CSV that German Excel opens correctly', async () => {
    const vote = (projectId: string, email: string) =>
      t.app.inject({ method: 'POST', url: '/api/votes', payload: { projectId, email, consent: true } });
    for (const email of ['v1@web.de', 'v2@web.de', 'v3@web.de']) {
      await t.app.inject({ method: 'POST', url: '/api/votes/confirm', payload: { token: tokenFrom(await vote(s.a.id, email)) } });
    }
    await vote(s.b.id, 'never-confirms@web.de');

    const cookie = await login(t.app, 'sponsor@test.de');
    const stats = json(await t.app.inject({ url: `/api/admin/competitions/${s.competition.id}/stats`, headers: { cookie } }));
    expect(stats.votes).toMatchObject({ confirmed: 3, pending: 1, expired: 0, confirmationRate: 0.75 });
    expect(stats.projects).toMatchObject({ total: 3, approved: 2, pending: 1 });
    expect(stats.votesPerDay.reduce((n: number, d: any) => n + d.votes, 0)).toBe(3);

    const csv = await t.app.inject({ url: `/api/admin/competitions/${s.competition.id}/export.csv`, headers: { cookie } });
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.body.startsWith('\uFEFFPlatz;Projekt;')).toBe(true);
    expect(csv.body).toContain('1;Project A;Club A;Cottbus;a@club.de;Sport;3;1000,00;10000,00');
  });

  it('is not reachable for clubs or anonymous users', async () => {
    const club = await login(t.app, 'a@club.de');
    expect((await t.app.inject({ url: '/api/admin/competitions', headers: { cookie: club } })).statusCode).toBe(403);
    expect((await t.app.inject({ url: '/api/admin/competitions' })).statusCode).toBe(401);
  });
});

describe('club', () => {
  async function openCompetition() {
    const cookie = await login(t.app, 'sponsor@test.de');
    return json(await t.app.inject({ method: 'POST', url: '/api/admin/competitions', headers: { cookie }, payload: competitionBody() }));
  }
  const project = {
    title: 'Floodlights for training',
    summary: 'LED floodlights for evening training in winter.',
    description: 'Our halogen lights are broken and use a lot of energy. New LED lights let the youth teams train after school.',
    category: 'sport',
    fundingGoalEuro: 2500,
  };

  it('submits one project per competition, which starts in review', async () => {
    const comp = await openCompetition();
    const cookie = await login(t.app, 'a@club.de');
    const res = await t.app.inject({ method: 'POST', url: `/api/competitions/${comp.id}/projects`, headers: { cookie }, payload: project });
    expect(res.statusCode).toBe(201);
    expect(json(res).status).toBe('pending');
    const again = await t.app.inject({ method: 'POST', url: `/api/competitions/${comp.id}/projects`, headers: { cookie }, payload: project });
    expect(again.statusCode).toBe(409);
    const mine = json(await t.app.inject({ url: '/api/club/projects', headers: { cookie } }));
    expect(mine.find((p: any) => p.competitionId === comp.id)).toMatchObject({ title: project.title, status: 'pending' });
  });

  it('cannot submit once voting has started', async () => {
    const cookie = await login(t.app, 'a@club.de');
    const res = await t.app.inject({ method: 'POST', url: `/api/competitions/${s.competition.id}/projects`, headers: { cookie }, payload: project });
    expect(res.statusCode).toBe(409);
    expect(json(res).error).toBe('submissions_closed');
  });

  it('sponsors cannot submit projects', async () => {
    const comp = await openCompetition();
    const cookie = await login(t.app, 'sponsor@test.de');
    const res = await t.app.inject({ method: 'POST', url: `/api/competitions/${comp.id}/projects`, headers: { cookie }, payload: project });
    expect(res.statusCode).toBe(403);
  });
});
