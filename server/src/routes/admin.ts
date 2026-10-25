import { and, desc, eq, like, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  computePayouts,
  computePhase,
  createCompetitionSchema,
  moderateProjectSchema,
  rankProjects,
  type AdminProject,
  type CompetitionStats,
} from '@vv/shared';
import { currentUser, requireRole } from '../auth.ts';
import type { Db } from '../db/client.ts';
import { competitions, projectPhotos, projects, users, votes } from '../db/schema.ts';
import type { Deps } from '../deps.ts';
import { toCsv } from '../lib/csv.ts';
import { conflict, forbidden, notFound } from '../lib/errors.ts';
import { photoUrl } from '../lib/photo.ts';
import { slugify } from '../lib/slug.ts';
import { getCompetitionRow, getLeaderboard, listCompetitions } from '../services/competitions.ts';

const idParams = z.object({ id: z.uuid() });

// "vereinspreis-2027", or "vereinspreis-2027-2" if that is taken
async function uniqueSlug(db: Db, title: string) {
  const base = slugify(title) || 'competition';
  const rows = await db
    .select({ slug: competitions.slug })
    .from(competitions)
    .where(or(eq(competitions.slug, base), like(competitions.slug, `${base}-%`)));
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export async function adminRoutes(app: FastifyInstance, { db, now }: Deps) {
  const adminOnly = { preHandler: requireRole('admin') };

  // sponsors only see and change their own competitions
  async function ownCompetition(competitionId: string, adminId: string) {
    const c = await getCompetitionRow(db, { id: competitionId });
    if (c.createdBy !== adminId) throw forbidden();
    return c;
  }

  app.get('/api/admin/competitions', adminOnly, async (req) => listCompetitions(db, currentUser(req).id));

  app.post('/api/admin/competitions', adminOnly, async (req, reply) => {
    const me = currentUser(req);
    const input = createCompetitionSchema.parse(req.body);
    const [created] = await db
      .insert(competitions)
      .values({
        slug: await uniqueSlug(db, input.title),
        title: input.title,
        description: input.description,
        sponsorName: me.name,
        region: input.region,
        budgetCents: input.budgetEuro * 100,
        prizeShares: input.prizeShares,
        submissionStartsAt: input.submissionStartsAt,
        votingStartsAt: input.votingStartsAt,
        votingEndsAt: input.votingEndsAt,
        createdBy: me.id,
      })
      .returning({ id: competitions.id, slug: competitions.slug });
    return reply.code(201).send(created);
  });

  app.get('/api/admin/competitions/:id/projects', adminOnly, async (req): Promise<AdminProject[]> => {
    const { id } = idParams.parse(req.params);
    await ownCompetition(id, currentUser(req).id);
    const rows = await db
      .select({ p: projects, clubName: users.name, clubEmail: users.email, photoUpdatedAt: projectPhotos.updatedAt })
      .from(projects)
      .innerJoin(users, eq(users.id, projects.clubId))
      .leftJoin(projectPhotos, eq(projectPhotos.projectId, projects.id))
      .where(eq(projects.competitionId, id))
      .orderBy(desc(projects.voteCount), projects.submittedAt);
    return rows.map(({ p, clubName, clubEmail, photoUpdatedAt }) => ({
      id: p.id,
      title: p.title,
      summary: p.summary,
      description: p.description,
      category: p.category,
      fundingGoalCents: p.fundingGoalCents,
      clubName,
      clubEmail,
      status: p.status,
      rejectionReason: p.rejectionReason,
      votes: p.voteCount,
      submittedAt: p.submittedAt.toISOString(),
      photoUrl: photoUrl(p.id, photoUpdatedAt),
    }));
  });

  app.post('/api/admin/projects/:id/moderate', adminOnly, async (req) => {
    const { id } = idParams.parse(req.params);
    const input = moderateProjectSchema.parse(req.body);
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    if (!project) throw notFound('Projekt nicht gefunden');
    const competition = await ownCompetition(project.competitionId, currentUser(req).id);
    // after voting the result is final and the payout may already be made
    if (computePhase(competition, now()) === 'ended') {
      throw conflict('competition_ended', 'Der Wettbewerb ist beendet, die Projekte können nicht mehr geändert werden');
    }
    const [updated] = await db
      .update(projects)
      .set({
        status: input.status,
        rejectionReason: input.status === 'rejected' ? (input.reason ?? null) : null,
        moderatedAt: now(),
      })
      .where(eq(projects.id, id))
      .returning({ id: projects.id, status: projects.status });
    return updated;
  });

  app.get('/api/admin/competitions/:id/stats', adminOnly, async (req): Promise<CompetitionStats> => {
    const { id } = idParams.parse(req.params);
    const competition = await ownCompetition(id, currentUser(req).id);
    const t = now();

    const [projectCounts] = await db
      .select({
        total: sql<number>`count(*)::int`,
        pending: sql<number>`count(*) filter (where ${projects.status} = 'pending')::int`,
        approved: sql<number>`count(*) filter (where ${projects.status} = 'approved')::int`,
        rejected: sql<number>`count(*) filter (where ${projects.status} = 'rejected')::int`,
      })
      .from(projects)
      .where(eq(projects.competitionId, id));

    const [voteCounts] = await db
      .select({
        confirmed: sql<number>`count(*) filter (where ${votes.status} = 'confirmed')::int`,
        pending: sql<number>`count(*) filter (where ${votes.status} = 'pending' and ${votes.expiresAt} >= ${t})::int`,
        expired: sql<number>`count(*) filter (where ${votes.status} = 'pending' and ${votes.expiresAt} < ${t})::int`,
      })
      .from(votes)
      .where(eq(votes.competitionId, id));

    // grouped by German calendar day, since that is how sponsors read it
    const votesPerDay = await db
      .select({
        day: sql<string>`to_char(${votes.confirmedAt} at time zone 'Europe/Berlin', 'YYYY-MM-DD')`,
        votes: sql<number>`count(*)::int`,
      })
      .from(votes)
      .where(and(eq(votes.competitionId, id), eq(votes.status, 'confirmed')))
      .groupBy(sql`1`)
      .orderBy(sql`1`);

    const board = await getLeaderboard(db, competition, t);
    const byCategory = CATEGORIES.map((category) => {
      const entries = board.entries.filter((e) => e.category === category);
      return {
        category,
        projects: entries.length,
        votes: entries.reduce((sum, e) => sum + e.votes, 0),
        payoutCents: entries.reduce((sum, e) => sum + e.payoutCents, 0),
      };
    }).filter((c) => c.projects > 0);

    const v = voteCounts!;
    const started = v.confirmed + v.pending + v.expired;
    return {
      competitionId: id,
      phase: computePhase(competition, t),
      projects: projectCounts!,
      votes: { ...v, confirmationRate: started === 0 ? 0 : v.confirmed / started },
      votesPerDay,
      byCategory,
    };
  });

  app.get('/api/admin/competitions/:id/export.csv', adminOnly, async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const competition = await ownCompetition(id, currentUser(req).id);
    const rows = await db
      .select({
        id: projects.id,
        votes: projects.voteCount,
        submittedAt: projects.submittedAt,
        title: projects.title,
        category: projects.category,
        fundingGoalCents: projects.fundingGoalCents,
        clubName: users.name,
        clubCity: users.city,
        clubEmail: users.email,
      })
      .from(projects)
      .innerJoin(users, eq(users.id, projects.clubId))
      .where(and(eq(projects.competitionId, id), eq(projects.status, 'approved')));

    // same ranking and payout rules as the website, so both always agree
    const payouts = new Map(
      computePayouts(competition.budgetCents, competition.prizeShares, rows).map((p) => [p.projectId, p.amountCents]),
    );
    const euro = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
    const csv = toCsv(
      ['Platz', 'Projekt', 'Verein', 'Ort', 'Kontakt', 'Kategorie', 'Stimmen', 'Förderziel (EUR)', 'Preisgeld (EUR)'],
      rankProjects(rows).map(({ rank, project: p }) => [
        rank,
        p.title,
        p.clubName,
        p.clubCity ?? '',
        p.clubEmail,
        CATEGORY_LABELS[p.category],
        p.votes,
        euro(p.fundingGoalCents),
        euro(payouts.get(p.id) ?? 0),
      ]),
    );
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${competition.slug}-ergebnis.csv"`)
      .send(csv);
  });
}
