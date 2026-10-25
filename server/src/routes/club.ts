import { desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { computePhase, submitProjectSchema, type ClubProject } from '@vv/shared';
import { currentUser, requireRole } from '../auth.ts';
import { competitions, projectPhotos, projects } from '../db/schema.ts';
import type { Deps } from '../deps.ts';
import { HttpError, conflict, forbidden, notFound } from '../lib/errors.ts';
import { MAX_UPLOAD_BYTES, photoUrl, processPhoto } from '../lib/photo.ts';
import { getCompetitionRow } from '../services/competitions.ts';

const idParams = z.object({ id: z.uuid() });

export async function clubRoutes(app: FastifyInstance, { db, now }: Deps) {
  const clubOnly = { preHandler: requireRole('club') };

  app.get('/api/club/projects', clubOnly, async (req): Promise<ClubProject[]> => {
    const me = currentUser(req);
    const rows = await db
      .select({ p: projects, c: competitions, photoUpdatedAt: projectPhotos.updatedAt })
      .from(projects)
      .innerJoin(competitions, eq(competitions.id, projects.competitionId))
      .leftJoin(projectPhotos, eq(projectPhotos.projectId, projects.id))
      .where(eq(projects.clubId, me.id))
      .orderBy(desc(projects.submittedAt));
    return rows.map(({ p, c, photoUpdatedAt }) => ({
      id: p.id,
      competitionId: p.competitionId,
      competitionTitle: c.title,
      competitionSlug: c.slug,
      title: p.title,
      category: p.category,
      status: p.status,
      rejectionReason: p.rejectionReason,
      votes: p.voteCount,
      submittedAt: p.submittedAt.toISOString(),
      photoUrl: photoUrl(p.id, photoUpdatedAt),
      phase: computePhase(c, now()),
    }));
  });

  app.post('/api/competitions/:id/projects', clubOnly, async (req, reply) => {
    const me = currentUser(req);
    const { id } = idParams.parse(req.params);
    const input = submitProjectSchema.parse(req.body);
    const competition = await getCompetitionRow(db, { id });
    if (computePhase(competition, now()) !== 'submission') {
      throw conflict('submissions_closed', 'Für diesen Wettbewerb können gerade keine Projekte eingereicht werden');
    }
    const [created] = await db
      .insert(projects)
      .values({
        competitionId: competition.id,
        clubId: me.id,
        title: input.title,
        summary: input.summary,
        description: input.description,
        category: input.category,
        fundingGoalCents: input.fundingGoalEuro * 100,
      })
      .onConflictDoNothing() // unique (competition, club)
      .returning({ id: projects.id, status: projects.status });
    if (!created) {
      throw conflict('already_submitted', 'Euer Verein hat für diesen Wettbewerb schon ein Projekt eingereicht');
    }
    return reply.code(201).send(created);
  });

  // The body is the image file itself (Content-Type image/jpeg, png or webp),
  // not a multipart form. A form on another site can't send that, so this
  // route is as safe from CSRF as the JSON ones.
  app.put(
    '/api/club/projects/:id/photo',
    { ...clubOnly, bodyLimit: MAX_UPLOAD_BYTES, config: { acceptsPhoto: true } },
    async (req) => {
      const { id } = idParams.parse(req.params);
      const [row] = await db
        .select({ clubId: projects.clubId, competition: competitions })
        .from(projects)
        .innerJoin(competitions, eq(competitions.id, projects.competitionId))
        .where(eq(projects.id, id));
      if (!row) throw notFound('Projekt nicht gefunden');
      if (row.clubId !== currentUser(req).id) throw forbidden();
      if (computePhase(row.competition, now()) === 'ended') {
        throw conflict('competition_ended', 'Der Wettbewerb ist beendet, das Foto kann nicht mehr geändert werden');
      }
      if (!Buffer.isBuffer(req.body)) throw new HttpError(400, 'no_photo', 'Bitte ein Foto auswählen');

      const photo = await processPhoto(req.body);
      const updatedAt = now();
      await db
        .insert(projectPhotos)
        .values({ projectId: id, ...photo, updatedAt })
        .onConflictDoUpdate({ target: projectPhotos.projectId, set: { ...photo, updatedAt } });
      return { photoUrl: photoUrl(id, updatedAt) };
    },
  );
}
