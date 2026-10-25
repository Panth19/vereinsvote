// Validation for every request body. The server uses these to check input,
// the web app shows the messages next to the form fields.
import { z } from 'zod';
import { CATEGORIES } from './domain.ts';

// fallback for messages we don't set ourselves
z.config(z.locales.de());

const text = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, min === 1 ? 'Bitte ausfüllen' : `Bitte mindestens ${min} Zeichen eingeben`)
    .max(max, `Bitte höchstens ${max} Zeichen eingeben`);

const wholeNumber = (min: number, max: number, unit = '') =>
  z
    .number({ error: 'Bitte eine Zahl eingeben' })
    .int('Bitte eine ganze Zahl eingeben')
    .min(min, `Mindestens ${min.toLocaleString('de-DE')}${unit}`)
    .max(max, `Höchstens ${max.toLocaleString('de-DE')}${unit}`);

const date = z.coerce.date({ error: 'Bitte ein Datum wählen' });

const email = z.string().trim().max(254).pipe(z.email({ error: 'Bitte eine gültige E-Mail-Adresse eingeben' }));

export const registerClubSchema = z.object({
  email,
  password: z.string().min(8, 'Das Passwort muss mindestens 8 Zeichen haben').max(200),
  name: text(2, 120),
  city: text(2, 80),
});

export const loginSchema = z.object({ email, password: z.string().min(1, 'Bitte Passwort eingeben').max(200) });

export const createCompetitionSchema = z
  .object({
    title: text(5, 120),
    description: text(20, 4000),
    region: text(2, 80),
    budgetEuro: wholeNumber(100, 1_000_000, ' €'),
    prizeShares: z
      .array(wholeNumber(1, 100, ' %'))
      .min(1, 'Mindestens ein Preis')
      .max(10, 'Höchstens 10 Preise')
      .refine((s) => s.reduce((a, b) => a + b, 0) === 100, 'Die Anteile müssen zusammen 100 % ergeben'),
    submissionStartsAt: date,
    votingStartsAt: date,
    votingEndsAt: date,
  })
  .refine((c) => c.submissionStartsAt < c.votingStartsAt, {
    message: 'Die Abstimmung muss nach dem Einreichungsstart beginnen',
    path: ['votingStartsAt'],
  })
  .refine((c) => c.votingStartsAt < c.votingEndsAt, {
    message: 'Das Ende muss nach dem Start der Abstimmung liegen',
    path: ['votingEndsAt'],
  });

export const submitProjectSchema = z.object({
  title: text(5, 100),
  summary: text(20, 280),
  description: text(50, 5000),
  category: z.enum(CATEGORIES, { error: 'Bitte eine Kategorie wählen' }),
  fundingGoalEuro: wholeNumber(50, 100_000, ' €'),
});

export const moderateProjectSchema = z
  .object({
    status: z.enum(['approved', 'rejected']),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((m) => m.status === 'approved' || (m.reason && m.reason.length >= 5), {
    message: 'Bitte eine Begründung angeben',
    path: ['reason'],
  });

export const startVoteSchema = z.object({
  projectId: z.uuid(),
  email,
  consent: z.literal(true, { error: 'Bitte der Datenschutzerklärung zustimmen' }),
  website: z.string().max(200).optional(), // honeypot, only bots fill it in
});

export const confirmVoteSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{32,64}$/) });
