import { describe, expect, it } from 'vitest';
import { computePayouts, computePhase, formatEuro, isDisposableEmail, normalizeEmail, rankProjects } from './domain.ts';
import { createCompetitionSchema, startVoteSchema } from './schemas.ts';

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Anna@Example.DE ')).toBe('anna@example.de');
  });
  it('treats Gmail dots, +tags and googlemail.com as the same inbox', () => {
    const variants = ['a.n.n.a@gmail.com', 'anna+vote1@gmail.com', 'Anna@googlemail.com', 'an.na+x@GMAIL.com'];
    for (const v of variants) expect(normalizeEmail(v)).toBe('anna@gmail.com');
  });
  it('strips +tags but keeps dots for other providers', () => {
    expect(normalizeEmail('max.mustermann+test@web.de')).toBe('max.mustermann@web.de');
  });
});

describe('isDisposableEmail', () => {
  it('flags known throwaway providers', () => {
    expect(isDisposableEmail('bot@mailinator.com')).toBe(true);
    expect(isDisposableEmail('anna@web.de')).toBe(false);
  });
});

describe('computePhase', () => {
  const c = {
    submissionStartsAt: '2026-01-01T00:00:00Z',
    votingStartsAt: '2026-02-01T00:00:00Z',
    votingEndsAt: '2026-03-01T00:00:00Z',
  };
  it.each([
    ['2025-12-31T23:59:59Z', 'upcoming'],
    ['2026-01-01T00:00:00Z', 'submission'],
    ['2026-02-01T00:00:00Z', 'voting'],
    ['2026-02-28T23:59:59Z', 'voting'],
    ['2026-03-01T00:00:00Z', 'ended'],
  ])('at %s the phase is %s', (now, phase) => {
    expect(computePhase(c, new Date(now))).toBe(phase);
  });
});

describe('rankProjects', () => {
  it('sorts by votes, then earlier submission wins a tie', () => {
    const ranked = rankProjects([
      { id: 'a', votes: 5, submittedAt: '2026-01-03' },
      { id: 'b', votes: 9, submittedAt: '2026-01-05' },
      { id: 'c', votes: 5, submittedAt: '2026-01-02' },
    ]);
    expect(ranked.map((r) => [r.rank, r.project.id])).toEqual([
      [1, 'b'],
      [2, 'c'],
      [3, 'a'],
    ]);
  });
});

describe('computePayouts', () => {
  const projects = [
    { id: 'a', votes: 30, submittedAt: '2026-01-01' },
    { id: 'b', votes: 20, submittedAt: '2026-01-01' },
    { id: 'c', votes: 10, submittedAt: '2026-01-01' },
    { id: 'd', votes: 5, submittedAt: '2026-01-01' },
  ];

  it('splits the budget by prize shares', () => {
    expect(computePayouts(1_000_000, [50, 30, 20], projects)).toEqual([
      { projectId: 'a', rank: 1, amountCents: 500_000 },
      { projectId: 'b', rank: 2, amountCents: 300_000 },
      { projectId: 'c', rank: 3, amountCents: 200_000 },
    ]);
  });

  it('always pays out exactly the budget, rounding leftovers to first place', () => {
    const payouts = computePayouts(100_001, [34, 33, 33], projects);
    expect(payouts.reduce((s, p) => s + p.amountCents, 0)).toBe(100_001);
    expect(payouts[0]!.amountCents).toBeGreaterThan(payouts[1]!.amountCents);
  });

  it('scales shares up when there are fewer winners than prize tiers', () => {
    const payouts = computePayouts(100_000, [50, 30, 20], projects.slice(0, 2));
    expect(payouts).toEqual([
      { projectId: 'a', rank: 1, amountCents: 62_500 },
      { projectId: 'b', rank: 2, amountCents: 37_500 },
    ]);
  });

  it('never pays projects without votes', () => {
    expect(computePayouts(100_000, [100], [{ id: 'x', votes: 0, submittedAt: '2026-01-01' }])).toEqual([]);
  });
});

describe('formatEuro', () => {
  it('formats cents as whole euros in German style', () => {
    expect(formatEuro(1_250_000)).toBe('12.500\u00a0€');
  });
});

describe('schemas', () => {
  it('rejects prize shares that do not add up to 100', () => {
    const r = createCompetitionSchema.safeParse({
      title: 'Vereinspreis 2026',
      description: 'A competition for local clubs in the region.',
      region: 'Lausitz',
      budgetEuro: 10_000,
      prizeShares: [50, 30],
      submissionStartsAt: '2026-01-01',
      votingStartsAt: '2026-02-01',
      votingEndsAt: '2026-03-01',
    });
    expect(r.success).toBe(false);
  });

  it('requires privacy consent to vote', () => {
    const r = startVoteSchema.safeParse({
      projectId: '7d2b9e1c-3f1a-4b8e-9c2d-1a2b3c4d5e6f',
      email: 'anna@web.de',
      consent: false,
    });
    expect(r.success).toBe(false);
  });
});
