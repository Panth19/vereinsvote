import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import compress from '@fastify/compress';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyReply, type FastifyServerOptions } from 'fastify';
import { ZodError } from 'zod';
import type { ApiError } from '@vv/shared';
import { SESSION_COOKIE, loadUserFromSession } from './auth.ts';
import type { Deps } from './deps.ts';
import { HttpError } from './lib/errors.ts';
import { PHOTO_TYPES } from './lib/photo.ts';
import { adminRoutes } from './routes/admin.ts';
import { authRoutes } from './routes/auth.ts';
import { clubRoutes } from './routes/club.ts';
import { publicRoutes } from './routes/public.ts';
import { voteRoutes } from './routes/votes.ts';

declare module 'fastify' {
  interface FastifyContextConfig {
    acceptsPhoto?: boolean; // route takes a raw image body
  }
}

interface BuildOptions {
  logger?: FastifyServerOptions['logger'];
  webDist?: string; // built React app, served when present
}

function toApiError(err: unknown): { status: number; body: ApiError } {
  if (err instanceof ZodError) {
    return {
      status: 400,
      body: {
        error: 'validation_error',
        message: err.issues[0]?.message ?? 'Ungültige Eingabe',
        issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    };
  }
  if (err instanceof HttpError) {
    return { status: err.statusCode, body: { error: err.code, message: err.message } };
  }
  // Fastify's own client errors: invalid JSON, body too large, rate limit
  const e = err as { statusCode?: number; error?: string; code?: string; message?: string };
  if (e.statusCode === 429) {
    return { status: 429, body: { error: 'rate_limited', message: e.message ?? 'Zu viele Anfragen' } };
  }
  if (e.statusCode && e.statusCode < 500) {
    return { status: e.statusCode, body: { error: e.code ?? 'bad_request', message: 'Ungültige Anfrage' } };
  }
  return { status: 500, body: { error: 'internal_error', message: 'Da ist etwas schiefgelaufen. Bitte später noch einmal versuchen.' } };
}

const apiNotFound = (reply: FastifyReply) =>
  reply.code(404).send({ error: 'not_found', message: 'Diese Adresse gibt es nicht' } satisfies ApiError);

export async function buildApp(deps: Deps, opts: BuildOptions = {}) {
  const app = Fastify({
    logger: opts.logger ?? false,
    // trust only our own proxies' X-Forwarded-For entries, not ones a client adds
    trustProxy: (_address: string, hop: number) => hop < deps.config.trustProxyHops,
    bodyLimit: 64 * 1024,
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        styleSrc: ["'self'"],
        fontSrc: ["'self'"],
      },
    },
  });
  // text/event-stream is left out on purpose: compressing it buffers the live updates
  await app.register(compress, {
    threshold: 1024,
    customTypes: /^(text\/(?!event-stream)|application\/json|application\/javascript|image\/svg)/,
  });
  await app.register(cookie);
  await app.register(rateLimit, {
    max: deps.config.rateLimitPerMinute,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'rate_limited',
      message: 'Zu viele Anfragen. Bitte etwas später noch einmal versuchen.',
    }),
  });

  // Request bodies must be JSON, or an image on the photo route. A form on
  // another site can send neither, so together with SameSite=Lax cookies
  // this is our CSRF protection.
  app.addContentTypeParser(PHOTO_TYPES, { parseAs: 'buffer' }, (_req, body, done) => done(null, body));
  app.addHook('preValidation', async (req) => {
    if (req.body === undefined || req.method === 'GET') return;
    const type = req.headers['content-type'] ?? '';
    const ok = type.startsWith('application/json') || (req.routeOptions.config.acceptsPhoto && type.startsWith('image/'));
    if (!ok) throw new HttpError(415, 'unsupported_media_type', 'Dieses Format wird nicht angenommen');
  });

  app.decorateRequest('user', null);
  app.addHook('onRequest', async (req) => {
    if (req.url.startsWith('/api/')) {
      req.user = await loadUserFromSession(deps.db, req.cookies[SESSION_COOKIE]);
    }
  });

  app.setErrorHandler((err, req, reply) => {
    const { status, body } = toApiError(err);
    if (status >= 500) req.log.error(err);
    return reply.code(status).send(body);
  });

  await app.register(async (api) => {
    await publicRoutes(api, deps);
    await authRoutes(api, deps);
    await voteRoutes(api, deps);
    await clubRoutes(api, deps);
    await adminRoutes(api, deps);
  });

  const webDist = opts.webDist ?? findWebDist();
  if (!webDist || !existsSync(path.join(webDist, 'index.html'))) {
    app.setNotFoundHandler((_req, reply) => apiNotFound(reply));
    return app;
  }

  await app.register(fastifyStatic, {
    root: webDist,
    wildcard: false,
    setHeaders: (res, filePath) => {
      // file names in /assets contain a content hash, so they never change
      const immutable = filePath.includes(`${path.sep}assets${path.sep}`);
      res.header('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
    },
  });
  // React Router handles all other paths in the browser. A missing file under
  // /assets/ is a real 404, otherwise the browser gets HTML instead of JS/CSS.
  app.setNotFoundHandler((req, reply) =>
    req.url.startsWith('/api/') || req.url.startsWith('/assets/')
      ? apiNotFound(reply)
      : reply.type('text/html').sendFile('index.html'),
  );
  return app;
}

function findWebDist() {
  // dev: server/src, build: server/dist. Both are two levels below the repo root.
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');
}
