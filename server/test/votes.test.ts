import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { projects, votes } from '../src/db/schema.ts';
import { createTestApp, json, resetDb, seedVotingCompetition, tokenFrom, type TestContext } from './helpers.ts';

let t: TestContext;
let s: Awaited<ReturnType<typeof seedVotingCompetition>>;

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => t.close());
beforeEach(async () => {
  await resetDb(t.db);
  t.mails.length = 0;
  t.clock.now = new Date();
  s = await seedVotingCompetition(t.db);
});

const startVote = (projectId: string, email: string, extra: object = {}) =>
  t.app.inject({ method: 'POST', url: '/api/votes', payload: { projectId, email, consent: true, ...extra } });
const confirm = (token: string) => t.app.inject({ method: 'POST', url: '/api/votes/confirm', payload: { token } });
const voteCount = async (id: string) =>
  (await t.db.select({ n: projects.voteCount }).from(projects).where(eq(projects.id, id)))[0]!.n;

describe('voting with double opt-in', () => {
  it('counts a vote only after the email link is confirmed', async () => {
    const res = await startVote(s.a.id, 'anna@web.de');
    expect(res.statusCode).toBe(202);
    expect(t.mails).toHaveLength(1);
    expect(t.mails[0]!.text).toContain('https://vote.test/vote/confirm?token=');
    expect(await voteCount(s.a.id)).toBe(0);

    const ok = await confirm(tokenFrom(res));
    expect(ok.statusCode).toBe(200);
    expect(json(ok)).toMatchObject({ status: 'confirmed', projectTitle: 'Project A', competitionSlug: 'test-preis' });
    expect(await voteCount(s.a.id)).toBe(1);
  });

  it('never stores the email address', async () => {
    await startVote(s.a.id, 'anna@web.de');
    const rows = await t.db.select().from(votes);
    expect(JSON.stringify(rows)).not.toContain('anna');
  });

  it('confirming the same link twice counts once', async () => {
    const token = tokenFrom(await startVote(s.a.id, 'anna@web.de'));
    await confirm(token);
    const again = await confirm(token);
    expect(json(again).status).toBe('already_confirmed');
    expect(await voteCount(s.a.id)).toBe(1);
  });

  it('two simultaneous clicks on the same link count once', async () => {
    const token = tokenFrom(await startVote(s.a.id, 'anna@web.de'));
    const results = await Promise.all(Array.from({ length: 5 }, () => confirm(token)));
    expect(results.filter((r) => json(r).status === 'confirmed')).toHaveLength(1);
    expect(await voteCount(s.a.id)).toBe(1);
  });

  it('allows only one vote per email per competition, across spellings', async () => {
    await confirm(tokenFrom(await startVote(s.a.id, 'Anna.Muster@gmail.com')));
    for (const variant of ['annamuster@gmail.com', 'anna.muster+2@googlemail.com', ' ANNA.MUSTER@GMAIL.COM ']) {
      const res = await startVote(s.b.id, variant);
      expect(res.statusCode).toBe(409);
      expect(json(res).error).toBe('already_voted');
    }
    expect(await voteCount(s.b.id)).toBe(0);
  });

  it('lets a person change a vote that is not confirmed yet; the old link stops working', async () => {
    const first = tokenFrom(await startVote(s.a.id, 'anna@web.de'));
    const second = tokenFrom(await startVote(s.b.id, 'anna@web.de'));
    expect((await confirm(first)).statusCode).toBe(404);
    expect(json(await confirm(second)).status).toBe('confirmed');
    expect(await voteCount(s.a.id)).toBe(0);
    expect(await voteCount(s.b.id)).toBe(1);
  });

  it('rejects expired links', async () => {
    const token = tokenFrom(await startVote(s.a.id, 'anna@web.de'));
    t.clock.now = new Date(Date.now() + 25 * 3600 * 1000);
    const res = await confirm(token);
    expect(res.statusCode).toBe(410);
  });

  it('rejects votes outside the voting phase', async () => {
    t.clock.now = new Date(Date.now() + 6 * s.DAY);
    const res = await startVote(s.a.id, 'anna@web.de');
    expect(res.statusCode).toBe(409);
    expect(json(res).error).toBe('voting_closed');
  });

  it('does not count a link confirmed after voting closed', async () => {
    const token = tokenFrom(await startVote(s.a.id, 'anna@web.de'));
    t.clock.now = new Date(Date.now() + 5 * s.DAY + 60_000);
    expect((await confirm(token)).statusCode).toBe(409);
    expect(await voteCount(s.a.id)).toBe(0);
  });

  it('rejects votes for projects that are not approved', async () => {
    expect((await startVote(s.pending.id, 'anna@web.de')).statusCode).toBe(404);
  });

  it('blocks disposable email providers', async () => {
    const res = await startVote(s.a.id, 'bot@mailinator.com');
    expect(res.statusCode).toBe(422);
  });

  it('silently ignores bots that fill the honeypot field', async () => {
    const res = await startVote(s.a.id, 'bot@web.de', { website: 'http://spam.example' });
    expect(res.statusCode).toBe(202);
    expect(t.mails).toHaveLength(0);
    expect(await t.db.select().from(votes)).toHaveLength(0);
  });

  it('requires privacy consent', async () => {
    const res = await startVote(s.a.id, 'anna@web.de', { consent: false });
    expect(res.statusCode).toBe(400);
    expect(json(res).issues[0].path).toBe('consent');
  });

  it('does not reveal the confirmation link when demo mode is off', async () => {
    const strict = await createTestApp({ DEMO_MODE: 'false' });
    try {
      const res = await strict.app.inject({
        method: 'POST',
        url: '/api/votes',
        payload: { projectId: s.a.id, email: 'anna@web.de', consent: true },
      });
      expect(res.statusCode).toBe(202);
      expect(json(res).demoConfirmUrl).toBeUndefined();
    } finally {
      await strict.close();
    }
  });
});

describe('leaderboard', () => {
  it('ranks by votes and shows the current payout', async () => {
    for (const email of ['a1@web.de', 'a2@web.de']) await confirm(tokenFrom(await startVote(s.b.id, email)));
    await confirm(tokenFrom(await startVote(s.a.id, 'a3@web.de')));
    const board = json(await t.app.inject({ url: '/api/competitions/test-preis/leaderboard' }));
    expect(board.totalVotes).toBe(3);
    expect(board.entries.map((e: any) => [e.title, e.votes, e.payoutCents])).toEqual([
      ['Project B', 2, 6_000_00],
      ['Project A', 1, 4_000_00],
    ]);
  });

  it('does not list pending projects publicly', async () => {
    const list = json(await t.app.inject({ url: '/api/competitions/test-preis/projects' }));
    expect(list.map((p: any) => p.title).sort()).toEqual(['Project A', 'Project B']);
  });
});

describe('security basics', () => {
  it('only accepts JSON for POST requests (blocks cross-site form posts)', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/votes',
      headers: { 'content-type': 'text/plain' },
      payload: JSON.stringify({ projectId: s.a.id, email: 'x@web.de', consent: true }),
    });
    expect(res.statusCode).toBe(415);
  });

  it('returns JSON 404s for unknown API routes', async () => {
    const res = await t.app.inject({ url: '/api/nope' });
    expect(res.statusCode).toBe(404);
    expect(json(res).error).toBe('not_found');
  });
});
