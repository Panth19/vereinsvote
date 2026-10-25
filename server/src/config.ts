import { z } from 'zod';

const DEV_SECRET = 'dev-secret-change-me-please';
const bool = (fallback: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(fallback)
    .transform((v) => v === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1).default('postgres://vv:vv@localhost:5432/vereinsvote'),
  // used to build the link in the confirmation email
  APP_URL: z.url().default('http://localhost:5173'),
  // used to hash voter emails, so it must not change after launch
  APP_SECRET: z.string().min(16).default(DEV_SECRET),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('VereinsVote <no-reply@vereinsvote.local>'),
  // without SMTP the API returns the confirmation link instead of mailing it
  DEMO_MODE: z.enum(['true', 'false']).optional(),
  RUN_MIGRATIONS: bool('true'),
  SEED_DEMO_DATA: bool('false'),
  // number of proxies in front of the app (Render, a load balancer, ...).
  // Only those hops are trusted for X-Forwarded-For, so clients can't fake their IP.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(1),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().default(300),
  VOTE_RATE_LIMIT_PER_HOUR: z.coerce.number().int().default(20),
  LOGIN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().default(10),
});

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const e = envSchema.parse(env);
  if (e.NODE_ENV === 'production' && e.APP_SECRET === DEV_SECRET) {
    throw new Error('APP_SECRET must be set in production');
  }
  const smtpUrl = e.SMTP_URL || undefined;
  return {
    env: e.NODE_ENV,
    port: e.PORT,
    host: e.HOST,
    databaseUrl: e.DATABASE_URL,
    appUrl: e.APP_URL.replace(/\/$/, ''),
    appSecret: e.APP_SECRET,
    smtpUrl,
    mailFrom: e.MAIL_FROM,
    demoMode: e.DEMO_MODE ? e.DEMO_MODE === 'true' : !smtpUrl,
    runMigrations: e.RUN_MIGRATIONS,
    seedDemoData: e.SEED_DEMO_DATA,
    trustProxyHops: e.TRUST_PROXY_HOPS,
    rateLimitPerMinute: e.RATE_LIMIT_PER_MINUTE,
    voteRateLimitPerHour: e.VOTE_RATE_LIMIT_PER_HOUR,
    loginRateLimitPerMinute: e.LOGIN_RATE_LIMIT_PER_MINUTE,
  };
}

export type Config = ReturnType<typeof loadConfig>;
