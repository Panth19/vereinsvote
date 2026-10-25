import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CATEGORIES, CATEGORY_LABELS, formatEuro, type Category, type CompetitionDetail, type PublicProject } from '@vv/shared';
import { Notice } from '../components/Field.tsx';
import { LeaderboardPanel } from '../components/LeaderboardPanel.tsx';
import { PrizePot } from '../components/PrizePot.tsx';
import { VoteDialog } from '../components/VoteDialog.tsx';
import { useAuth } from '../lib/auth.tsx';
import { formatDate, formatNumber, phaseLine } from '../lib/format.ts';
import { useApi, useLiveLeaderboard, useNow } from '../lib/hooks.ts';

export function CompetitionPage() {
  const { slug = '' } = useParams();
  const { user } = useAuth();
  const now = useNow();
  const comp = useApi<CompetitionDetail>(`/api/competitions/${slug}`);
  const projects = useApi<PublicProject[]>(`/api/competitions/${slug}/projects`);
  const { board, live } = useLiveLeaderboard(slug);
  const [category, setCategory] = useState<Category | null>(null);
  const [voteFor, setVoteFor] = useState<PublicProject | null>(null);

  // texts come from the project list, votes and ranks from the live ranking
  const list = useMemo(() => {
    const ranking = new Map(board?.entries.map((e) => [e.projectId, e]) ?? []);
    return (projects.data ?? [])
      .map((p) => {
        const r = ranking.get(p.id);
        return r ? { ...p, votes: r.votes, rank: r.rank, payoutCents: r.payoutCents } : { ...p, payoutCents: 0 };
      })
      .sort((a, b) => a.rank - b.rank);
  }, [projects.data, board]);

  if (comp.error) return <Notice kind="error">{comp.error}</Notice>;
  if (!comp.data) return <p className="muted">Wettbewerb wird geladen...</p>;
  const c = comp.data;

  const usedCategories = CATEGORIES.filter((cat) => list.some((p) => p.category === cat));
  const shown = category ? list.filter((p) => p.category === category) : list;
  const showRanks = c.phase === 'voting' || c.phase === 'ended';

  return (
    <>
      <header className="comp-hero">
        <p className="sponsor-line">
          {c.sponsorName}, Region {c.region}
        </p>
        <h1>{c.title}</h1>
        <p className="phase-line">
          {c.phase === 'voting' && <span className="dot dot-live" aria-hidden="true" />}
          {phaseLine(c, now)}
        </p>
        <PrizePot budgetCents={c.budgetCents} prizeShares={c.prizeShares} board={board} />
      </header>

      <div className="comp-body">
        <div>
          <div className="stack">
            <p>{c.description}</p>
            <p className="small muted">
              Einreichung ab {formatDate(c.submissionStartsAt)}, Abstimmung vom {formatDate(c.votingStartsAt)} bis{' '}
              {formatDate(c.votingEndsAt)}.
            </p>
            {c.phase === 'submission' && (
              <Notice>
                {user?.role === 'club' ? (
                  <>
                    Euer Verein kann mitmachen: <Link to={`/club/submit/${c.id}`}>Projekt einreichen</Link>
                  </>
                ) : (
                  <>
                    Ihr seid ein Verein aus der Region? <Link to="/register">Registriert euch</Link> und reicht ein
                    Projekt ein, bevor die Abstimmung startet.
                  </>
                )}
              </Notice>
            )}
          </div>

          <h2 className="projects-heading">{c.phase === 'ended' ? 'Ergebnis' : 'Projekte'}</h2>
          {usedCategories.length > 1 && (
            <div className="filters" role="group" aria-label="Nach Kategorie filtern">
              <button className="chip" aria-pressed={category === null} onClick={() => setCategory(null)}>
                Alle
              </button>
              {usedCategories.map((cat) => (
                <button key={cat} className="chip" aria-pressed={category === cat} onClick={() => setCategory(cat)}>
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          )}

          {projects.loading && <p className="muted">Projekte werden geladen...</p>}
          {projects.data && list.length === 0 && (
            <p className="empty">
              {c.phase === 'submission' || c.phase === 'upcoming'
                ? 'Noch keine Projekte. Sie erscheinen hier, sobald der Sponsor sie freigegeben hat.'
                : 'An diesem Wettbewerb hat kein Projekt teilgenommen.'}
            </p>
          )}
          <ul className="project-list">
            {shown.map((p) => (
              <li key={p.id} className={p.photoUrl ? 'project-row has-photo' : 'project-row'}>
                <span className={p.payoutCents > 0 ? 'rank in-money' : 'rank'}>{showRanks && p.rank}</span>
                {p.photoUrl && (
                  <Link to={`/p/${p.id}`} className="project-thumb-link" tabIndex={-1} aria-hidden="true">
                    <img className="project-thumb" src={p.photoUrl} alt="" loading="lazy" />
                  </Link>
                )}
                <div>
                  <h3>
                    <Link to={`/p/${p.id}`}>{p.title}</Link>
                  </h3>
                  <div className="project-meta">
                    <span className="cat">{CATEGORY_LABELS[p.category]}</span>
                    <span>
                      {p.clubName}
                      {p.clubCity && `, ${p.clubCity}`}
                    </span>
                    <span>braucht {formatEuro(p.fundingGoalCents)}</span>
                  </div>
                  <p>{p.summary}</p>
                  {showRanks && (
                    <div className="project-actions">
                      <span className="votes">
                        <strong>{formatNumber(p.votes)}</strong> {p.votes === 1 ? 'Stimme' : 'Stimmen'}
                      </span>
                      {p.payoutCents > 0 && (
                        <span className="payout">
                          {c.phase === 'ended' ? 'erhalten:' : 'aktuell:'} {formatEuro(p.payoutCents)}
                        </span>
                      )}
                      {c.phase === 'voting' && (
                        <button className="btn btn-vote" onClick={() => setVoteFor(p)}>
                          Abstimmen
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {showRanks && (
          <aside className="comp-aside">
            <LeaderboardPanel board={board} live={live} prizeCount={c.prizeShares.length} />
          </aside>
        )}
      </div>

      <VoteDialog project={voteFor} onClose={() => setVoteFor(null)} />
    </>
  );
}
