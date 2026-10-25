import type { Config } from './config.ts';
import type { Db } from './db/client.ts';
import type { Mailer } from './lib/mailer.ts';
import type { LeaderboardHub } from './services/leaderboard-hub.ts';

// Passed into every route module, so tests can swap the mailer and the clock.
export interface Deps {
  db: Db;
  config: Config;
  mailer: Mailer;
  hub: LeaderboardHub;
  now: () => Date;
}
