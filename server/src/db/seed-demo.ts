import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, eq, sql } from 'drizzle-orm';
import { normalizeEmail } from '@vv/shared';
import { hashPassword } from '../auth.ts';
import { hmac, randomToken, sha256 } from '../lib/crypto.ts';
import { processPhoto } from '../lib/photo.ts';
import type { Db } from './client.ts';
import { competitions, projectPhotos, projects, users, votes } from './schema.ts';
import { CLUBS, ENDED_PROJECTS, LIVE_PROJECTS, SUBMISSION_PROJECTS, type ProjectSeed } from './seed-data.ts';

export const DEMO_PASSWORD = 'demo1234';
export const DEMO_ADMIN_EMAIL = 'sponsor@demo.vereinsvote.de';
export const DEMO_CLUB_EMAIL = CLUBS[0]!.email;

const DAY = 24 * 3600 * 1000;

// server/seed-photos, from src/db/ in dev and from dist/ after the build
function findPhoto(name: string): Buffer | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const dir of [path.resolve(here, '../../seed-photos'), path.resolve(here, '../seed-photos')]) {
    for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
      const file = path.join(dir, `${name}.${ext}`);
      if (existsSync(file)) return readFileSync(file);
    }
  }
  return null;
}

// Dates are relative to now, so a fresh seed always has one competition in
// voting, one open for submissions and one that has ended.
export async function seedDemo(db: Db, opts: { reset?: boolean; secret: string; now?: Date }) {
  const now = opts.now ?? new Date();
  const at = (days: number) => new Date(now.getTime() + days * DAY);

  if (opts.reset) {
    await db.execute(sql`TRUNCATE project_photos, votes, projects, competitions, sessions, users CASCADE`);
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const [admin] = await db
    .insert(users)
    .values({ email: DEMO_ADMIN_EMAIL, passwordHash, role: 'admin', name: 'Stadtwerke Lindenau (Demo)', city: 'Cottbus' })
    .returning();
  const clubs = await db
    .insert(users)
    .values(CLUBS.map((c) => ({ ...c, passwordHash, role: 'club' as const })))
    .returning();

  const [live, submission, ended] = await db
    .insert(competitions)
    .values([
      {
        slug: 'vereinspreis-lausitz-2026',
        title: 'Vereinspreis Lausitz 2026',
        description:
          'Vereine machen die Lausitz lebenswert. Dieses Jahr gehen 15.000 Euro an Vereinsprojekte aus der Region. Alle können einmal für ihr Lieblingsprojekt abstimmen, die fünf Projekte mit den meisten Stimmen bekommen das Preisgeld.',
        sponsorName: admin!.name,
        region: 'Lausitz',
        budgetCents: 15_000_00,
        prizeShares: [40, 25, 15, 10, 10],
        submissionStartsAt: at(-30),
        votingStartsAt: at(-12),
        votingEndsAt: at(60),
        createdBy: admin!.id,
      },
      {
        slug: 'klimafonds-spreewald',
        title: 'Klimafonds Spreewald',
        description:
          'Kleine Klimaprojekte mit großer Wirkung: Regenwasser, Artenvielfalt, Energie sparen. Vereine aus dem Spreewald können jetzt Projekte einreichen. Danach wird öffentlich abgestimmt, drei Projekte teilen sich 8.000 Euro.',
        sponsorName: admin!.name,
        region: 'Spreewald',
        budgetCents: 8_000_00,
        prizeShares: [50, 30, 20],
        submissionStartsAt: at(-3),
        votingStartsAt: at(45),
        votingEndsAt: at(75),
        createdBy: admin!.id,
      },
      {
        slug: 'jugendsport-2026',
        title: 'Jugendsport-Förderung 2026',
        description:
          'Unser Sommerwettbewerb für den Jugendsport. Danke an alle, die abgestimmt haben! Das Ergebnis steht fest und das Preisgeld ist an die Vereine ausgezahlt.',
        sponsorName: admin!.name,
        region: 'Cottbus und Umgebung',
        budgetCents: 5_000_00,
        prizeShares: [50, 30, 20],
        submissionStartsAt: at(-120),
        votingStartsAt: at(-90),
        votingEndsAt: at(-60),
        createdBy: admin!.id,
      },
    ])
    .returning();

  async function insertProjects(
    competitionId: string,
    list: ProjectSeed[],
    submittedFrom: number,
    votingFrom: number,
    votingDays: number,
  ) {
    for (const [i, p] of list.entries()) {
      const [project] = await db
        .insert(projects)
        .values({
          competitionId,
          clubId: clubs[p.club]!.id,
          title: p.title,
          summary: p.summary,
          description: p.description,
          category: p.category,
          fundingGoalCents: p.goal * 100,
          status: p.status ?? 'approved',
          rejectionReason: p.reason ?? null,
          voteCount: p.votes,
          submittedAt: at(submittedFrom + i * 0.7),
          moderatedAt: p.status === 'pending' ? null : at(submittedFrom + i * 0.7 + 1),
        })
        .returning({ id: projects.id });

      const file = p.photo ? findPhoto(p.photo) : null;
      if (file) {
        await db.insert(projectPhotos).values({ projectId: project!.id, ...(await processPhoto(file)) });
      }

      // fake confirmation times: many votes in the first days, fewer later.
      // No Math.random, so every seed gives the same numbers.
      if (p.votes > 0) {
        const rows = Array.from({ length: p.votes }, (_, n) => {
          const spread = ((n * 7919) % 1000) / 1000;
          const dayOffset = Math.floor(spread ** 1.8 * votingDays);
          const confirmedAt = at(votingFrom + dayOffset + ((n * 37) % 100) / 100);
          return {
            competitionId,
            projectId: project!.id,
            emailHash: hmac(opts.secret, normalizeEmail(`voter${n}.${project!.id}@example.org`)),
            tokenHash: sha256(randomToken()),
            status: 'confirmed' as const,
            createdAt: confirmedAt,
            confirmedAt,
            expiresAt: at(votingFrom + dayOffset + 1),
          };
        });
        for (let k = 0; k < rows.length; k += 500) await db.insert(votes).values(rows.slice(k, k + 500));
      }
    }
  }

  await insertProjects(live!.id, LIVE_PROJECTS, -29, -12, 12);
  await insertProjects(submission!.id, SUBMISSION_PROJECTS, -2, 0, 0);
  await insertProjects(ended!.id, ENDED_PROJECTS, -118, -90, 30);

  // votes that were started but never confirmed: 110 expired, 20 still open
  const liveProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.competitionId, live!.id), eq(projects.status, 'approved')));
  const unconfirmed = Array.from({ length: 130 }, (_, n) => {
    const createdAt = n < 110 ? at(-12 + (n % 11)) : at(-0.5);
    return {
      competitionId: live!.id,
      projectId: liveProjects[n % liveProjects.length]!.id,
      emailHash: hmac(opts.secret, `unconfirmed${n}@example.org`),
      tokenHash: sha256(randomToken()),
      status: 'pending' as const,
      createdAt,
      expiresAt: new Date(createdAt.getTime() + DAY),
    };
  });
  await db.insert(votes).values(unconfirmed);
}
