import { and, desc, eq, sql } from 'drizzle-orm';
import {
  computePayouts,
  computePhase,
  rankProjects,
  type CompetitionDetail,
  type CompetitionSummary,
  type Leaderboard,
  type PublicProject,
} from '@vv/shared';
import type { Db } from '../db/client.ts';
import { competitions, projectPhotos, projects, users } from '../db/schema.ts';
import { notFound } from '../lib/errors.ts';
import { photoUrl } from '../lib/photo.ts';

type CompetitionRow = typeof competitions.$inferSelect;

// number of approved projects and their votes, per competition
function totalsSubquery(db: Db) {
  return db
    .select({
      competitionId: projects.competitionId,
      projectCount: sql<number>`count(*)::int`.as('project_count'),
      totalVotes: sql<number>`coalesce(sum(${projects.voteCount}), 0)::int`.as('total_votes'),
    })
    .from(projects)
    .where(eq(projects.status, 'approved'))
    .groupBy(projects.competitionId)
    .as('totals');
}

function toSummary(c: CompetitionRow, projectCount: number | null, totalVotes: number | null): CompetitionSummary {
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    sponsorName: c.sponsorName,
    region: c.region,
    budgetCents: c.budgetCents,
    prizeShares: c.prizeShares,
    submissionStartsAt: c.submissionStartsAt.toISOString(),
    votingStartsAt: c.votingStartsAt.toISOString(),
    votingEndsAt: c.votingEndsAt.toISOString(),
    phase: computePhase(c),
    projectCount: projectCount ?? 0,
    totalVotes: totalVotes ?? 0,
  };
}

// open competitions first
const PHASE_ORDER = { voting: 0, submission: 1, upcoming: 2, ended: 3 } as const;

export async function listCompetitions(db: Db, createdBy?: string): Promise<CompetitionSummary[]> {
  const totals = totalsSubquery(db);
  const rows = await db
    .select({ c: competitions, projectCount: totals.projectCount, totalVotes: totals.totalVotes })
    .from(competitions)
    .leftJoin(totals, eq(totals.competitionId, competitions.id))
    .where(createdBy ? eq(competitions.createdBy, createdBy) : undefined)
    .orderBy(desc(competitions.votingEndsAt));
  return rows
    .map((r) => toSummary(r.c, r.projectCount, r.totalVotes))
    .sort((a, b) => PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase]);
}

export async function getCompetitionRow(db: Db, by: { slug: string } | { id: string }): Promise<CompetitionRow> {
  const [row] = await db
    .select()
    .from(competitions)
    .where('slug' in by ? eq(competitions.slug, by.slug) : eq(competitions.id, by.id))
    .limit(1);
  if (!row) throw notFound('Wettbewerb nicht gefunden');
  return row;
}

export async function getCompetitionDetail(db: Db, slug: string): Promise<CompetitionDetail> {
  const totals = totalsSubquery(db);
  const [r] = await db
    .select({ c: competitions, projectCount: totals.projectCount, totalVotes: totals.totalVotes })
    .from(competitions)
    .leftJoin(totals, eq(totals.competitionId, competitions.id))
    .where(eq(competitions.slug, slug))
    .limit(1);
  if (!r) throw notFound('Wettbewerb nicht gefunden');
  return { ...toSummary(r.c, r.projectCount, r.totalVotes), description: r.c.description };
}

export async function listPublicProjects(db: Db, competitionId: string): Promise<PublicProject[]> {
  const rows = await db
    .select({
      id: projects.id,
      competitionId: projects.competitionId,
      title: projects.title,
      summary: projects.summary,
      description: projects.description,
      category: projects.category,
      fundingGoalCents: projects.fundingGoalCents,
      clubName: users.name,
      clubCity: users.city,
      votes: projects.voteCount,
      submittedAt: projects.submittedAt,
      photoUpdatedAt: projectPhotos.updatedAt,
    })
    .from(projects)
    .innerJoin(users, eq(users.id, projects.clubId))
    .leftJoin(projectPhotos, eq(projectPhotos.projectId, projects.id))
    .where(and(eq(projects.competitionId, competitionId), eq(projects.status, 'approved')));
  return rankProjects(rows).map(({ rank, project: { photoUpdatedAt, ...project } }) => ({
    ...project,
    rank,
    submittedAt: project.submittedAt.toISOString(),
    photoUrl: photoUrl(project.id, photoUpdatedAt),
  }));
}

export async function getLeaderboard(db: Db, competition: CompetitionRow, now = new Date()): Promise<Leaderboard> {
  const list = await listPublicProjects(db, competition.id);
  const payouts = new Map(
    computePayouts(competition.budgetCents, competition.prizeShares, list).map((p) => [p.projectId, p.amountCents]),
  );
  return {
    competitionId: competition.id,
    phase: computePhase(competition, now),
    totalVotes: list.reduce((s, p) => s + p.votes, 0),
    updatedAt: now.toISOString(),
    entries: list.map((p) => ({
      projectId: p.id,
      title: p.title,
      clubName: p.clubName,
      category: p.category,
      votes: p.votes,
      rank: p.rank,
      payoutCents: payouts.get(p.id) ?? 0,
    })),
  };
}
