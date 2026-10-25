import { and, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
  computePhase,
  confirmVoteSchema,
  isDisposableEmail,
  normalizeEmail,
  startVoteSchema,
  type ConfirmVoteResponse,
  type StartVoteResponse,
} from '@vv/shared';
import { competitions, projects, votes } from '../db/schema.ts';
import type { Deps } from '../deps.ts';
import { hmac, randomToken, sha256 } from '../lib/crypto.ts';
import { HttpError, conflict, notFound } from '../lib/errors.ts';

const CONFIRM_HOURS = 24;

// Voting is double opt-in: POST /api/votes stores a pending vote and mails a
// link, POST /api/votes/confirm with the token from that link counts it.
export async function voteRoutes(app: FastifyInstance, { db, config, mailer, hub, now }: Deps) {
  app.post(
    '/api/votes',
    { config: { rateLimit: { max: config.voteRateLimitPerHour, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const input = startVoteSchema.parse(req.body);

      // honeypot field: only bots fill it. Answer as usual so they don't notice.
      if (input.website) {
        req.log.warn('honeypot filled, vote ignored');
        return reply.code(202).send({ status: 'confirmation_sent' } satisfies StartVoteResponse);
      }

      const [target] = await db
        .select({ project: projects, competition: competitions })
        .from(projects)
        .innerJoin(competitions, eq(competitions.id, projects.competitionId))
        .where(and(eq(projects.id, input.projectId), eq(projects.status, 'approved')));
      if (!target) throw notFound('Projekt nicht gefunden');
      if (computePhase(target.competition, now()) !== 'voting') {
        throw conflict('voting_closed', 'Für diesen Wettbewerb läuft gerade keine Abstimmung');
      }
      if (isDisposableEmail(input.email)) {
        throw new HttpError(422, 'disposable_email', 'Bitte eine normale E-Mail-Adresse verwenden, keine Wegwerf-Adresse');
      }

      const emailHash = hmac(config.appSecret, normalizeEmail(input.email));
      const token = randomToken();
      const tokenHash = sha256(token);
      const expiresAt = new Date(now().getTime() + CONFIRM_HOURS * 3600_000);

      // One row per email and competition (unique index). A pending vote gets
      // replaced, e.g. when someone changes their mind or lost the mail. A
      // confirmed one is left alone, so nothing comes back.
      const saved = await db
        .insert(votes)
        .values({ competitionId: target.competition.id, projectId: target.project.id, emailHash, tokenHash, expiresAt })
        .onConflictDoUpdate({
          target: [votes.competitionId, votes.emailHash],
          set: { projectId: target.project.id, tokenHash, expiresAt, createdAt: now() },
          setWhere: sql`${votes.status} = 'pending'`,
        })
        .returning({ id: votes.id });
      if (saved.length === 0) {
        throw conflict('already_voted', 'Mit dieser E-Mail-Adresse wurde in diesem Wettbewerb schon abgestimmt');
      }

      const confirmUrl = `${config.appUrl}/vote/confirm?token=${token}`;
      await mailer.send({
        to: input.email,
        subject: `Bitte bestätige deine Stimme für "${target.project.title}"`,
        text: `Hallo,

danke, dass du "${target.project.title}" unterstützt (${target.competition.title}).
Bitte bestätige deine Stimme innerhalb von ${CONFIRM_HOURS} Stunden:

${confirmUrl}

Wenn du nicht abgestimmt hast, ignoriere diese E-Mail einfach. Dann wird nichts gezählt.
`,
      });

      const body: StartVoteResponse = { status: 'confirmation_sent' };
      if (config.demoMode) body.demoConfirmUrl = confirmUrl;
      return reply.code(202).send(body);
    },
  );

  app.post('/api/votes/confirm', async (req): Promise<ConfirmVoteResponse> => {
    const { token } = confirmVoteSchema.parse(req.body);

    const result = await db.transaction(async (tx) => {
      // row lock: two clicks on the same link at the same time must count once
      const [row] = await tx
        .select({ vote: votes, project: projects, competition: competitions })
        .from(votes)
        .innerJoin(projects, eq(projects.id, votes.projectId))
        .innerJoin(competitions, eq(competitions.id, votes.competitionId))
        .where(eq(votes.tokenHash, sha256(token)))
        .for('update', { of: votes });
      if (!row) {
        throw new HttpError(404, 'invalid_token', 'Der Link ist ungültig oder wurde durch einen neueren ersetzt');
      }

      const info = { projectTitle: row.project.title, competitionSlug: row.competition.slug };
      if (row.vote.status === 'confirmed') return { ...info, status: 'already_confirmed' as const };
      if (computePhase(row.competition, now()) !== 'voting') {
        throw conflict('voting_closed', 'Die Abstimmung ist schon beendet');
      }
      if (row.vote.expiresAt < now()) {
        throw new HttpError(410, 'token_expired', 'Der Link ist abgelaufen. Einfach noch einmal abstimmen, dann kommt ein neuer');
      }
      if (row.project.status !== 'approved') throw notFound('Projekt nicht gefunden');

      await tx.update(votes).set({ status: 'confirmed', confirmedAt: now() }).where(eq(votes.id, row.vote.id));
      await tx
        .update(projects)
        .set({ voteCount: sql`${projects.voteCount} + 1` })
        .where(eq(projects.id, row.project.id));
      return { ...info, status: 'confirmed' as const, competitionId: row.competition.id };
    });

    if (result.status === 'confirmed') hub.notify(result.competitionId);
    return { status: result.status, projectTitle: result.projectTitle, competitionSlug: result.competitionSlug };
  });
}
