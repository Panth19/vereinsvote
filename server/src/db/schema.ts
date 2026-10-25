import { sql } from 'drizzle-orm';
import {
  check,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { CATEGORIES } from '@vv/shared';

export const roleEnum = pgEnum('role', ['admin', 'club']);
export const categoryEnum = pgEnum('category', CATEGORIES);
export const moderationEnum = pgEnum('moderation_status', ['pending', 'approved', 'rejected']);
export const voteStatusEnum = pgEnum('vote_status', ['pending', 'confirmed']);

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull(),
  name: text('name').notNull(), // club name, or company name for sponsors
  city: text('city'),
  createdAt: createdAt(),
});

// the cookie holds a random token, we only store its hash
export const sessions = pgTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const competitions = pgTable(
  'competitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    sponsorName: text('sponsor_name').notNull(),
    region: text('region').notNull(),
    budgetCents: integer('budget_cents').notNull(),
    prizeShares: jsonb('prize_shares').$type<number[]>().notNull(), // percent per rank, e.g. [50, 30, 20]
    submissionStartsAt: timestamp('submission_starts_at', { withTimezone: true }).notNull(),
    votingStartsAt: timestamp('voting_starts_at', { withTimezone: true }).notNull(),
    votingEndsAt: timestamp('voting_ends_at', { withTimezone: true }).notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    check('competitions_dates_ordered', sql`${t.submissionStartsAt} < ${t.votingStartsAt} AND ${t.votingStartsAt} < ${t.votingEndsAt}`),
    check('competitions_budget_positive', sql`${t.budgetCents} > 0`),
  ],
);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    competitionId: uuid('competition_id')
      .notNull()
      .references(() => competitions.id, { onDelete: 'cascade' }),
    clubId: uuid('club_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    description: text('description').notNull(),
    category: categoryEnum('category').notNull(),
    fundingGoalCents: integer('funding_goal_cents').notNull(),
    status: moderationEnum('status').notNull().default('pending'),
    rejectionReason: text('rejection_reason'),
    // confirmed votes, updated in the same transaction as the vote itself
    voteCount: integer('vote_count').notNull().default(0),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    moderatedAt: timestamp('moderated_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('projects_one_per_club').on(t.competitionId, t.clubId),
    index('projects_competition_status_idx').on(t.competitionId, t.status),
  ],
);

// The voter's email is never stored, only an HMAC of the normalised address.
// That is enough for the one-vote-per-person rule.
export const votes = pgTable(
  'votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    competitionId: uuid('competition_id')
      .notNull()
      .references(() => competitions.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    emailHash: text('email_hash').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    status: voteStatusEnum('status').notNull().default('pending'),
    createdAt: createdAt(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('votes_one_per_email').on(t.competitionId, t.emailHash),
    index('votes_project_idx').on(t.projectId),
    index('votes_competition_confirmed_idx').on(t.competitionId, t.confirmedAt),
  ],
);

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });

// One photo per project, already resized and stored as WebP. Kept in Postgres
// so the app needs no extra file storage; see docs/decisions.md.
export const projectPhotos = pgTable('project_photos', {
  projectId: uuid('project_id')
    .primaryKey()
    .references(() => projects.id, { onDelete: 'cascade' }),
  data: bytea('data').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
