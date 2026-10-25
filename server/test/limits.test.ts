import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, json, login, resetDb, seedVotingCompetition, type TestContext } from './helpers.ts';

let t: TestContext;
let s: Awaited<ReturnType<typeof seedVotingCompetition>>;

beforeAll(async () => {
  t = await createTestApp({ VOTE_RATE_LIMIT_PER_HOUR: '3' });
});
afterAll(async () => t.close());
beforeEach(async () => {
  await resetDb(t.db);
  s = await seedVotingCompetition(t.db);
});

const startVote = (email: string, headers: Record<string, string> = {}) =>
  t.app.inject({
    method: 'POST',
    url: '/api/votes',
    remoteAddress: '203.0.113.7',
    headers,
    payload: { projectId: s.a.id, email, consent: true },
  });

describe('rate limits', () => {
  it('limits how many votes one IP can start per hour', async () => {
    for (let i = 0; i < 3; i++) expect((await startVote(`v${i}@web.de`)).statusCode).toBe(202);
    const blocked = await startVote('v4@web.de');
    expect(blocked.statusCode).toBe(429);
    expect(json(blocked).error).toBe('rate_limited');
  });

  it('cannot be bypassed with a made-up X-Forwarded-For header', async () => {
    // The request reaches us through one proxy (the default). Whatever the
    // client puts at the start of the header must be ignored.
    const proxied = (email: string, fakeIp: string) =>
      t.app.inject({
        method: 'POST',
        url: '/api/votes',
        remoteAddress: '10.0.0.1', // the proxy
        headers: { 'x-forwarded-for': `${fakeIp}, 198.51.100.20` },
        payload: { projectId: s.a.id, email, consent: true },
      });
    for (let i = 0; i < 3; i++) expect((await proxied(`x${i}@web.de`, `1.1.1.${i}`)).statusCode).toBe(202);
    expect((await proxied('x9@web.de', '1.1.1.9')).statusCode).toBe(429);
  });
});

describe('ended competitions', () => {
  it('can no longer be moderated, so results stay final', async () => {
    t.clock.now = new Date(s.competition.votingEndsAt.getTime() + 1000);
    const cookie = await login(t.app, 'sponsor@test.de');
    const res = await t.app.inject({
      method: 'POST',
      url: `/api/admin/projects/${s.a.id}/moderate`,
      headers: { cookie },
      payload: { status: 'rejected', reason: 'Too late to change this' },
    });
    expect(res.statusCode).toBe(409);
    expect(json(res).error).toBe('competition_ended');
  });
});
