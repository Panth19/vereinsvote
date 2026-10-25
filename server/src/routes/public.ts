import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CATEGORIES, computePhase, type ProjectDetailResponse } from '@vv/shared';
import { projectPhotos, projects } from '../db/schema.ts';
import type { Deps } from '../deps.ts';
import { notFound } from '../lib/errors.ts';
import {
  getCompetitionDetail,
  getCompetitionRow,
  getLeaderboard,
  listCompetitions,
  listPublicProjects,
} from '../services/competitions.ts';

const slugParams = z.object({ slug: z.string().min(1).max(80) });
const idParams = z.object({ id: z.uuid() });

export async function publicRoutes(app: FastifyInstance, { db, hub, now }: Deps) {
  app.get('/api/health', async () => {
    await db.execute('select 1');
    return { status: 'ok' };
  });

  app.get('/api/competitions', async () => listCompetitions(db));

  app.get('/api/competitions/:slug', async (req) => {
    const { slug } = slugParams.parse(req.params);
    return getCompetitionDetail(db, slug);
  });

  app.get('/api/competitions/:slug/projects', async (req) => {
    const { slug } = slugParams.parse(req.params);
    const { category } = z.object({ category: z.enum(CATEGORIES).optional() }).parse(req.query);
    const competition = await getCompetitionRow(db, { slug });
    const list = await listPublicProjects(db, competition.id);
    return category ? list.filter((p) => p.category === category) : list;
  });

  app.get('/api/projects/:id', async (req): Promise<ProjectDetailResponse> => {
    const { id } = idParams.parse(req.params);
    const [row] = await db
      .select({ competitionId: projects.competitionId })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.status, 'approved')));
    if (!row) throw notFound('Projekt nicht gefunden');
    // the rank is only known relative to the other projects
    const list = await listPublicProjects(db, row.competitionId);
    const project = list.find((p) => p.id === id)!;
    const competition = await getCompetitionRow(db, { id: row.competitionId });
    return {
      project,
      competition: {
        slug: competition.slug,
        title: competition.title,
        phase: computePhase(competition, now()),
        votingEndsAt: competition.votingEndsAt.toISOString(),
      },
    };
  });

  // The URL contains the upload time (?v=...), so a new photo gets a new URL
  // and the old one can be cached forever.
  app.get('/api/projects/:id/photo', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const [photo] = await db.select({ data: projectPhotos.data }).from(projectPhotos).where(eq(projectPhotos.projectId, id));
    if (!photo) throw notFound('Kein Foto vorhanden');
    return reply
      .header('Content-Type', 'image/webp')
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .send(photo.data);
  });

  app.get('/api/competitions/:slug/leaderboard', async (req) => {
    const { slug } = slugParams.parse(req.params);
    return getLeaderboard(db, await getCompetitionRow(db, { slug }), now());
  });

  // live leaderboard as Server-Sent Events, the browser reconnects by itself
  app.get('/api/competitions/:slug/leaderboard/stream', async (req, reply) => {
    const { slug } = slugParams.parse(req.params);
    const competition = await getCompetitionRow(db, { slug });
    const initial = await getLeaderboard(db, competition, now());

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // otherwise nginx-style proxies buffer the stream
    });
    reply.raw.write('retry: 5000\n\n');
    reply.raw.write(`event: leaderboard\ndata: ${JSON.stringify(initial)}\n\n`);
    const unsubscribe = hub.subscribe(competition.id, reply.raw);
    req.raw.on('close', unsubscribe);
  });
}
