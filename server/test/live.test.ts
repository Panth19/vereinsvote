import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, json, resetDb, seedVotingCompetition, tokenFrom, type TestContext } from './helpers.ts';

let t: TestContext;
let base: string;

beforeAll(async () => {
  t = await createTestApp();
  await t.app.listen({ port: 0, host: '127.0.0.1' });
  base = `http://127.0.0.1:${(t.app.server.address() as AddressInfo).port}`;
});
afterAll(async () => t.close());

/** Collects Server-Sent Events until `count` leaderboard frames arrived. */
function readLeaderboardEvents(url: string, count: number): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const frames: any[] = [];
    const req = http.get(url, (res) => {
      expect(res.headers['content-type']).toBe('text/event-stream');
      let buffer = '';
      res.on('data', (chunk) => {
        buffer += chunk;
        let i;
        while ((i = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, i);
          buffer = buffer.slice(i + 2);
          const data = block.split('\n').find((l) => l.startsWith('data: '));
          if (block.includes('event: leaderboard') && data) frames.push(JSON.parse(data.slice(6)));
          if (frames.length === count) {
            req.destroy();
            resolve(frames);
          }
        }
      });
    });
    req.on('error', (e) => (frames.length === count ? undefined : reject(e)));
  });
}

describe('live leaderboard stream', () => {
  it('pushes a new ranking to open browsers when a vote is confirmed', async () => {
    await resetDb(t.db);
    const s = await seedVotingCompetition(t.db);
    const events = readLeaderboardEvents(`${base}/api/competitions/test-preis/leaderboard/stream`, 2);
    await new Promise((r) => setTimeout(r, 100)); // let the stream connect

    const start = await t.app.inject({ method: 'POST', url: '/api/votes', payload: { projectId: s.b.id, email: 'live@web.de', consent: true } });
    await t.app.inject({ method: 'POST', url: '/api/votes/confirm', payload: { token: tokenFrom(start) } });

    const [initial, update] = await events;
    expect(initial.totalVotes).toBe(0);
    expect(update.totalVotes).toBe(1);
    expect(update.entries[0]).toMatchObject({ title: 'Project B', votes: 1, rank: 1 });
    expect(json(start).status).toBe('confirmation_sent');
  });
});
