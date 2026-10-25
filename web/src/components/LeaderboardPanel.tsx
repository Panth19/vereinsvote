import { useEffect, useRef, useState } from 'react';
import { formatEuro, type Leaderboard } from '@vv/shared';
import { formatNumber } from '../lib/format.ts';

interface Props {
  board: Leaderboard | null;
  live: boolean;
  prizeCount: number;
}

export function LeaderboardPanel({ board, live, prizeCount }: Props) {
  const lastVotes = useRef(new Map<string, number>());
  const [bumped, setBumped] = useState<Set<string>>(new Set());

  // flash the rows that just got new votes
  useEffect(() => {
    if (!board) return;
    const changed = new Set<string>();
    for (const e of board.entries) {
      const before = lastVotes.current.get(e.projectId);
      if (before !== undefined && e.votes > before) changed.add(e.projectId);
      lastVotes.current.set(e.projectId, e.votes);
    }
    if (changed.size === 0) return;
    setBumped(changed);
    const timer = setTimeout(() => setBumped(new Set()), 700);
    return () => clearTimeout(timer);
  }, [board]);

  if (!board) return <div className="board muted small">Rangliste wird geladen...</div>;

  return (
    <div className="board" aria-live="polite">
      <div className="spread">
        <h3>Rangliste</h3>
        {board.phase === 'voting' && (
          <span className="phase-line small">
            <span className={live ? 'dot dot-live' : 'dot'} aria-hidden="true" />
            {live ? 'live' : 'alle 15 Sek. aktualisiert'}
          </span>
        )}
      </div>
      <p className="small muted">{formatNumber(board.totalVotes)} bestätigte Stimmen</p>
      {board.entries.length === 0 ? (
        <p className="small muted">Noch keine Projekte.</p>
      ) : (
        <ol>
          {board.entries.map((e) => {
            const classes = [e.rank === prizeCount + 1 && 'cutline', bumped.has(e.projectId) && 'bump'];
            return (
              <li key={e.projectId} className={classes.filter(Boolean).join(' ')}>
                <span className="n">{e.rank}</span>
                <span className="t" title={e.title}>
                  {e.clubName}
                  {e.payoutCents > 0 && <span className="muted"> {formatEuro(e.payoutCents)}</span>}
                </span>
                <span className="n">{formatNumber(e.votes)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
