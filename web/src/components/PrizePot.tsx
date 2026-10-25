import { formatEuro, type Leaderboard } from '@vv/shared';

interface Props {
  budgetCents: number;
  prizeShares: number[];
  board: Leaderboard | null;
}

// The budget as one bar, split into the prize slices. Each slice shows the
// club that would get it if voting ended now.
export function PrizePot({ budgetCents, prizeShares, board }: Props) {
  const winners = (board?.entries ?? []).filter((e) => e.payoutCents > 0);
  const ended = board?.phase === 'ended';
  return (
    <div className="pot">
      <div className="pot-head">
        <div>
          <div className="pot-amount">{formatEuro(budgetCents)}</div>
          <span className="muted small">
            {prizeShares.length === 1 ? 'für das beste Projekt' : `für die besten ${prizeShares.length} Projekte`}
          </span>
        </div>
        {board && board.totalVotes > 0 && (
          <span className="small muted">{ended ? 'Endergebnis' : 'Stand jetzt'}</span>
        )}
      </div>
      <div className="pot-bar" role="img" aria-label={potLabel(prizeShares, budgetCents, winners)}>
        {prizeShares.map((share, i) => {
          const w = winners[i];
          const amount = w ? w.payoutCents : Math.round((budgetCents * share) / 100);
          return (
            <div
              key={i}
              className={`pot-slice${w ? '' : ' is-empty'}`}
              style={{ flexGrow: share, flexBasis: 0, animationDelay: `${i * 90}ms` }}
              title={w ? `${i + 1}. ${w.title} (${formatEuro(amount)})` : `${i + 1}. Preis: ${formatEuro(amount)}`}
            >
              <b>{formatEuro(amount)}</b>
              <i aria-hidden="true">{i + 1}.</i>
              <span>{w ? w.clubName : 'noch offen'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function potLabel(shares: number[], budget: number, winners: { title: string; payoutCents: number }[]) {
  return shares
    .map((s, i) => {
      const w = winners[i];
      return `${i + 1}. Preis: ${formatEuro(w ? w.payoutCents : (budget * s) / 100)}${w ? `, aktuell ${w.title}` : ''}`;
    })
    .join('. ');
}
