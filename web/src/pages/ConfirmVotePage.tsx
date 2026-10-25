import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { ConfirmVoteResponse } from '@vv/shared';
import { Notice } from '../components/Field.tsx';
import { api, errorMessage } from '../lib/api.ts';

export function ConfirmVotePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [result, setResult] = useState<ConfirmVoteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    // StrictMode runs effects twice in development. A second call would be
    // harmless (the API answers "already confirmed"), but it looks odd.
    if (requested.current) return;
    requested.current = true;
    api
      .post<ConfirmVoteResponse>('/api/votes/confirm', { token })
      .then(setResult)
      .catch((err) => setError(errorMessage(err)));
  }, [token]);

  if (error) {
    return (
      <div className="stack narrow">
        <h1>Das hat leider nicht geklappt.</h1>
        <Notice kind="error">{error}</Notice>
        <p>
          <Link to="/">Zu den Wettbewerben</Link>
        </p>
      </div>
    );
  }
  if (!result) return <p className="muted">Deine Stimme wird bestätigt...</p>;

  const confirmed = result.status === 'confirmed';
  return (
    <div className="stack narrow">
      <h1>{confirmed ? 'Danke, deine Stimme zählt!' : 'Schon bestätigt'}</h1>
      <p className="lead">
        {confirmed
          ? `Du hast für "${result.projectTitle}" abgestimmt.`
          : `Deine Stimme für "${result.projectTitle}" wurde schon bestätigt. Jede Stimme zählt nur einmal.`}
      </p>
      <p>
        <Link className="btn" to={`/c/${result.competitionSlug}`}>
          Zur Rangliste
        </Link>
      </p>
    </div>
  );
}
