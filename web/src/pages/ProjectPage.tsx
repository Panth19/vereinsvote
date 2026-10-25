import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CATEGORY_LABELS, formatEuro, type ProjectDetailResponse } from '@vv/shared';
import { Notice } from '../components/Field.tsx';
import { VoteDialog } from '../components/VoteDialog.tsx';
import { formatNumber, timeLeft } from '../lib/format.ts';
import { useApi, useNow } from '../lib/hooks.ts';

export function ProjectPage() {
  const { id = '' } = useParams();
  const { data, error } = useApi<ProjectDetailResponse>(`/api/projects/${id}`);
  const [voting, setVoting] = useState(false);
  const now = useNow();

  if (error) return <Notice kind="error">{error}</Notice>;
  if (!data) return <p className="muted">Projekt wird geladen...</p>;
  const { project: p, competition: c } = data;

  return (
    <article className="stack narrow">
      <Link to={`/c/${c.slug}`} className="small">
        Zurück zu {c.title}
      </Link>
      {p.photoUrl && <img className="project-photo" src={p.photoUrl} alt="" />}
      <div className="project-meta">
        <span className="cat">{CATEGORY_LABELS[p.category]}</span>
        <span>
          {p.clubName}
          {p.clubCity && `, ${p.clubCity}`}
        </span>
      </div>
      <h1 className="page-title">{p.title}</h1>
      <p className="lead">{p.summary}</p>
      <p className="facts-line">
        {(c.phase === 'voting' || c.phase === 'ended') && (
          <span>
            <strong>{formatNumber(p.votes)}</strong> Stimmen, {c.phase === 'ended' ? 'Endstand' : 'aktuell'} Platz{' '}
            <strong>{p.rank}</strong>
          </span>
        )}
        <span>
          Förderziel <strong>{formatEuro(p.fundingGoalCents)}</strong>
        </span>
      </p>
      {c.phase === 'voting' && (
        <div className="project-actions">
          <button className="btn btn-vote" onClick={() => setVoting(true)}>
            Für dieses Projekt abstimmen
          </button>
          <span className="small muted">Die Abstimmung endet in {timeLeft(c.votingEndsAt, now)}</span>
        </div>
      )}
      <h2>Was der Verein vorhat</h2>
      <p className="prewrap">{p.description}</p>
      <VoteDialog project={voting ? p : null} onClose={() => setVoting(false)} />
    </article>
  );
}
