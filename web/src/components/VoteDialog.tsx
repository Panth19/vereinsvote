import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { StartVoteResponse } from '@vv/shared';
import { RequestError, api, errorMessage } from '../lib/api.ts';
import { Field, Notice } from './Field.tsx';

interface Props {
  project: { id: string; title: string; clubName: string } | null;
  onClose: () => void;
}

// Uses the native <dialog>, which already handles focus, Escape and the backdrop.
export function VoteDialog({ project, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot, see the server
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<StartVoteResponse | null>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (project && !d.open) {
      setSent(null);
      setError(null);
      setFieldErrors({});
      setConsent(false);
      d.showModal();
    } else if (!project && d.open) {
      d.close();
    }
  }, [project]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!project) return;
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      setSent(await api.post<StartVoteResponse>('/api/votes', { projectId: project.id, email, consent, website }));
    } catch (err) {
      if (err instanceof RequestError && err.body.issues) setFieldErrors(err.fieldErrors());
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // demo mode only: the link that would be in the email, as an in-app path
  const demoLink = sent?.demoConfirmUrl ? new URL(sent.demoConfirmUrl) : null;

  return (
    <dialog ref={dialog} onClose={onClose} aria-labelledby="vote-title">
      <button className="linklike dialog-close" onClick={onClose}>
        Schließen
      </button>

      {project && !sent && (
        <form className="dialog-body" onSubmit={submit} noValidate>
          <div className="stack-tight">
            <h2 id="vote-title">Für dieses Projekt abstimmen</h2>
            <p className="muted">
              {project.title} ({project.clubName})
            </p>
          </div>
          <Field
            label="Deine E-Mail-Adresse"
            hint="Du bekommst einen Link, mit dem du deine Stimme bestätigst. Eine Stimme pro E-Mail-Adresse."
            error={fieldErrors.email}
          >
            {(p) => (
              <input
                {...p}
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>
          <div className="hp" aria-hidden="true">
            <label>
              Website
              <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </label>
          </div>
          <div className="field">
            <label className="check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>Ich bin einverstanden, dass meine E-Mail-Adresse einmalig zum Bestätigen der Stimme genutzt wird. Gespeichert wird nur ein nicht umkehrbarer Fingerabdruck.</span>
            </label>
            {fieldErrors.consent && <span className="err">{fieldErrors.consent}</span>}
          </div>
          {error && <Notice kind="error">{error}</Notice>}
          <button className="btn btn-vote" disabled={busy}>
            {busy ? 'Wird gesendet...' : 'Bestätigungslink schicken'}
          </button>
        </form>
      )}

      {project && sent && (
        <div className="dialog-body">
          <h2 id="vote-title">Schau in dein Postfach</h2>
          <p>
            Wir haben einen Link an <strong>{email}</strong> geschickt. Deine Stimme für "{project.title}" zählt,
            sobald du ihn anklickst. Der Link ist 24 Stunden gültig.
          </p>
          {demoLink && (
            <div className="demo-box stack-tight">
              <p>
                <strong>Demo-Modus:</strong> Dieser Server verschickt keine echten E-Mails. Hier ist der Link, der sonst
                in deinem Postfach wäre.
              </p>
              <Link className="btn btn-small" to={demoLink.pathname + demoLink.search} onClick={onClose}>
                Bestätigungslink öffnen
              </Link>
            </div>
          )}
          <button className="btn btn-quiet" onClick={onClose}>
            Fertig
          </button>
        </div>
      )}
    </dialog>
  );
}
