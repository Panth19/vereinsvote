import type { ServerResponse } from 'node:http';
import type { Leaderboard } from '@vv/shared';

// Keeps the open SSE connections per competition and pushes a new leaderboard
// after votes come in. At most one recompute per `throttleMs`, so a rush of
// votes doesn't mean a query per vote.
//
// Connections are kept in memory, which is fine for one server instance.
// With several instances this needs Postgres LISTEN/NOTIFY or Redis.
export class LeaderboardHub {
  private subscribers = new Map<string, Set<ServerResponse>>();
  private pending = new Map<string, NodeJS.Timeout>();
  private heartbeat: NodeJS.Timeout;

  constructor(
    private readonly load: (competitionId: string) => Promise<Leaderboard>,
    private readonly throttleMs = 1000,
  ) {
    // a comment line every 25 s stops proxies from closing idle connections
    this.heartbeat = setInterval(() => this.writeAll(': ping\n\n'), 25_000);
    this.heartbeat.unref();
  }

  subscribe(competitionId: string, res: ServerResponse) {
    let set = this.subscribers.get(competitionId);
    if (!set) {
      set = new Set();
      this.subscribers.set(competitionId, set);
    }
    set.add(res);
    return () => {
      set.delete(res);
      if (set.size === 0) this.subscribers.delete(competitionId);
    };
  }

  notify(competitionId: string) {
    if (!this.subscribers.has(competitionId) || this.pending.has(competitionId)) return;
    const timer = setTimeout(async () => {
      this.pending.delete(competitionId);
      try {
        const payload = `event: leaderboard\ndata: ${JSON.stringify(await this.load(competitionId))}\n\n`;
        for (const res of this.subscribers.get(competitionId) ?? []) res.write(payload);
      } catch (err) {
        // not fatal, the browsers get the numbers with the next update
        console.error('leaderboard push failed', err);
      }
    }, this.throttleMs);
    timer.unref();
    this.pending.set(competitionId, timer);
  }

  private writeAll(chunk: string) {
    for (const set of this.subscribers.values()) for (const res of set) res.write(chunk);
  }

  close() {
    clearInterval(this.heartbeat);
    for (const t of this.pending.values()) clearTimeout(t);
    for (const set of this.subscribers.values()) for (const res of set) res.end();
    this.subscribers.clear();
  }
}
