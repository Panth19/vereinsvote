import type { Phase } from '@vv/shared';

const dateFmt = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
const numberFmt = new Intl.NumberFormat('de-DE');

export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
export const formatNumber = (n: number) => numberFmt.format(n);

// "59 Tagen", "1 Tag 4 Std.", "3 Std. 20 Min." (fits after "in" / "noch")
export function timeLeft(target: string, now: Date) {
  const ms = new Date(target).getTime() - now.getTime();
  if (ms <= 0) return 'jetzt';
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days >= 2) return `${days} Tagen`;
  if (days === 1) return `1 Tag ${hours} Std.`;
  const minutes = Math.max(1, Math.floor((ms % 3_600_000) / 60_000));
  return hours > 0 ? `${hours} Std. ${minutes} Min.` : `${minutes} Min.`;
}

export function phaseLine(
  c: { phase: Phase; submissionStartsAt: string; votingStartsAt: string; votingEndsAt: string },
  now: Date,
) {
  switch (c.phase) {
    case 'upcoming':
      return `Einreichung startet in ${timeLeft(c.submissionStartsAt, now)}`;
    case 'submission':
      return `Vereine können Projekte einreichen. Abstimmung startet in ${timeLeft(c.votingStartsAt, now)}`;
    case 'voting':
      return `Abstimmung endet in ${timeLeft(c.votingEndsAt, now)}`;
    case 'ended':
      return `Abstimmung beendet am ${formatDate(c.votingEndsAt)}`;
  }
}

export const PHASE_LABEL: Record<Phase, string> = {
  upcoming: 'Demnächst',
  submission: 'Einreichung läuft',
  voting: 'Abstimmung läuft',
  ended: 'Ergebnis',
};
