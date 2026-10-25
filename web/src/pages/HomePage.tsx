import { Link } from 'react-router-dom';
import { formatEuro, type CompetitionSummary } from '@vv/shared';
import { Notice } from '../components/Field.tsx';
import { PHASE_LABEL, formatNumber, phaseLine } from '../lib/format.ts';
import { useApi, useNow } from '../lib/hooks.ts';

export function HomePage() {
  const { data, error, loading } = useApi<CompetitionSummary[]>('/api/competitions');
  const now = useNow();

  return (
    <>
      <section className="home-intro">
        <h1>Stimm für Vereine aus deiner Region</h1>
        <p className="muted lead">
          Unternehmen aus der Region stellen das Geld bereit, Vereine reichen Projekte ein, und alle können abstimmen.
          Ein Konto brauchst du dafür nicht, nur deine E-Mail-Adresse.
        </p>
      </section>

      <section aria-labelledby="comp-heading">
        <h2 id="comp-heading">Wettbewerbe</h2>
        {loading && <p className="muted">Wettbewerbe werden geladen...</p>}
        {error && <Notice kind="error">{error}</Notice>}
        {data?.length === 0 && <p className="empty">Es gibt noch keine Wettbewerbe.</p>}
        {data && data.length > 0 && (
          <ul className="comp-list">
            {data.map((c) => (
              <li key={c.id}>
                <Link to={`/c/${c.slug}`} className={c.phase === 'voting' ? 'comp-item is-voting' : 'comp-item'}>
                  <span className="small muted">{PHASE_LABEL[c.phase]}</span>
                  <h3>{c.title}</h3>
                  <span className="facts">
                    <span>{formatEuro(c.budgetCents)} Preisgeld</span>
                    <span>von {c.sponsorName}</span>
                    <span>{c.region}</span>
                    {c.projectCount > 0 && <span>{c.projectCount} Projekte</span>}
                    {c.totalVotes > 0 && <span>{formatNumber(c.totalVotes)} Stimmen</span>}
                  </span>
                  <span className="small">{phaseLine(c, now)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
