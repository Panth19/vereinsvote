// Rules shared by server and web. No I/O in here.

export const CATEGORIES = ['sport', 'youth', 'culture', 'environment', 'social', 'education'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  sport: 'Sport',
  youth: 'Jugend',
  culture: 'Kultur',
  environment: 'Umwelt',
  social: 'Soziales',
  education: 'Bildung',
};

export type Phase = 'upcoming' | 'submission' | 'voting' | 'ended';

export interface CompetitionDates {
  submissionStartsAt: Date | string;
  votingStartsAt: Date | string;
  votingEndsAt: Date | string;
}

export function computePhase(c: CompetitionDates, now: Date = new Date()): Phase {
  const t = now.getTime();
  if (t < new Date(c.submissionStartsAt).getTime()) return 'upcoming';
  if (t < new Date(c.votingStartsAt).getTime()) return 'submission';
  if (t < new Date(c.votingEndsAt).getTime()) return 'voting';
  return 'ended';
}

// Used for the one-vote-per-person rule. Gmail ignores dots and everything
// after "+", so a.nna+1@gmail.com and anna@gmail.com are the same inbox.
export function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at < 1) return email;
  let local = email.slice(0, at);
  let domain = email.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  const plus = local.indexOf('+');
  if (plus > 0) local = local.slice(0, plus);
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return `${local}@${domain}`;
}

// throwaway inbox providers, extend when abuse shows up
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  '10minutemail.com',
  'temp-mail.org',
  'trashmail.com',
  'yopmail.com',
  'sharklasers.com',
  'getnada.com',
  'dispostable.com',
  'throwawaymail.com',
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1] ?? '';
  return DISPOSABLE_DOMAINS.has(domain);
}

export interface RankInput {
  id: string;
  votes: number;
  submittedAt: Date | string;
}

export interface Ranked<T extends RankInput> {
  rank: number;
  project: T;
}

// Most votes first. On a tie the earlier submission wins, so the order
// never depends on database row order.
export function rankProjects<T extends RankInput>(projects: T[]): Ranked<T>[] {
  return [...projects]
    .sort(
      (a, b) =>
        b.votes - a.votes ||
        new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime() ||
        a.id.localeCompare(b.id),
    )
    .map((project, i) => ({ rank: i + 1, project }));
}

export interface Payout {
  projectId: string;
  rank: number;
  amountCents: number;
}

// Splits the budget by the prize shares (percent per rank, e.g. [50, 30, 20]).
// - projects without votes don't win anything
// - fewer winners than prizes: their shares are scaled up, so the whole budget is paid
// - rounding leftovers go to first place, so the sum is always exactly the budget
export function computePayouts<T extends RankInput>(
  budgetCents: number,
  sharesPercent: number[],
  projects: T[],
): Payout[] {
  const winners = rankProjects(projects.filter((p) => p.votes > 0)).slice(0, sharesPercent.length);
  if (winners.length === 0 || budgetCents <= 0) return [];
  const shares = sharesPercent.slice(0, winners.length);
  const total = shares.reduce((s, x) => s + x, 0);
  const payouts = winners.map((w, i) => ({
    projectId: w.project.id,
    rank: w.rank,
    amountCents: Math.floor((budgetCents * shares[i]!) / total),
  }));
  const paid = payouts.reduce((s, p) => s + p.amountCents, 0);
  payouts[0]!.amountCents += budgetCents - paid;
  return payouts;
}

export function formatEuro(cents: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(
    cents / 100,
  );
}
