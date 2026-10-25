// Load test against a running server with demo data.
//  1. leaderboard reads with autocannon
//  2. the whole vote flow (start + confirm) for N fake voters, then a check
//     that the vote count grew by exactly N
//
// Start the server with high limits, or you are testing the rate limiter:
//   RATE_LIMIT_PER_MINUTE=10000000 VOTE_RATE_LIMIT_PER_HOUR=10000000
// Usage: npm run loadtest -w server -- [baseUrl] [voters] [concurrency]

import os from 'node:os';
import autocannon from 'autocannon';

const base = process.argv[2] ?? 'http://localhost:3000';
const voters = Number(process.argv[3] ?? 2000);
const concurrency = Number(process.argv[4] ?? 50);
const slug = 'vereinspreis-lausitz-2026';

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(base + path, init);
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

console.log(`Machine: ${os.cpus().length} CPU cores, ${os.cpus()[0]?.model.trim()}, Node ${process.version}`);

// 1. Leaderboard reads
const read = await autocannon({ url: `${base}/api/competitions/${slug}/leaderboard`, connections: 50, duration: 15 });
console.log('\nLeaderboard reads (50 connections, 15 s)');
console.log(`  requests/s  avg ${read.requests.average.toFixed(0)}`);
console.log(`  latency     p50 ${read.latency.p50} ms, p99 ${read.latency.p99} ms`);
console.log(`  errors      ${read.errors + read.non2xx}`);

// 2. Full vote flow
type Board = { totalVotes: number; entries: { projectId: string }[] };
const before = await getJson<Board>(`/api/competitions/${slug}/leaderboard`);
const projectIds = before.entries.map((e) => e.projectId);
const runId = Date.now().toString(36);
const latencies: number[] = [];
let failures = 0;
let next = 0;

async function voter() {
  while (next < voters) {
    const i = next++;
    const t0 = performance.now();
    try {
      const started = await getJson<{ demoConfirmUrl?: string }>('/api/votes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId: projectIds[i % projectIds.length], email: `load-${runId}-${i}@example.org`, consent: true }),
      });
      if (!started.demoConfirmUrl) throw new Error('Server is not in demo mode, cannot read the confirmation token');
      const token = new URL(started.demoConfirmUrl).searchParams.get('token');
      await getJson('/api/votes/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      latencies.push(performance.now() - t0);
    } catch (e) {
      failures++;
      if (failures <= 3) console.error(String(e));
    }
  }
}

const t0 = performance.now();
await Promise.all(Array.from({ length: concurrency }, voter));
const seconds = (performance.now() - t0) / 1000;
const after = await getJson<Board>(`/api/competitions/${slug}/leaderboard`);
latencies.sort((a, b) => a - b);
const pct = (p: number) => latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))]!.toFixed(0);

console.log(`\nFull vote flow (start + confirm), ${voters} voters, ${concurrency} in parallel`);
console.log(`  confirmed votes/s   ${(latencies.length / seconds).toFixed(0)}`);
console.log(`  flow latency        p50 ${pct(50)} ms, p95 ${pct(95)} ms, p99 ${pct(99)} ms`);
console.log(`  failures            ${failures}`);
console.log(`  vote count grew by  ${after.totalVotes - before.totalVotes} (expected ${voters - failures})`);
if (after.totalVotes - before.totalVotes !== voters - failures) {
  console.error('MISMATCH: votes were lost or double-counted');
  process.exit(1);
}
