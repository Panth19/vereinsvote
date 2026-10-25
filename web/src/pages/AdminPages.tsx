import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CATEGORY_LABELS,
  formatEuro,
  type AdminProject,
  type CompetitionStats,
  type CompetitionSummary,
} from '@vv/shared';
import { Field, Notice } from '../components/Field.tsx';
import { VotesChart } from '../components/VotesChart.tsx';
import { RequestError, api, errorMessage } from '../lib/api.ts';
import { useAuth } from '../lib/auth.tsx';
import { PHASE_LABEL, formatDate, formatNumber } from '../lib/format.ts';
import { useApi } from '../lib/hooks.ts';

const STATUS_TEXT = { pending: 'wird geprüft', approved: 'freigegeben', rejected: 'abgelehnt' } as const;

export function AdminDashboard() {
  const { user } = useAuth();
  const { data, error } = useApi<CompetitionSummary[]>('/api/admin/competitions');

  return (
    <>
      <div className="dash-head">
        <div>
          <h1 className="page-title">{user?.name}</h1>
          <p className="muted">Eure Förderwettbewerbe</p>
        </div>
        <Link className="btn" to="/admin/new">
          Neuer Wettbewerb
        </Link>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {data?.length === 0 && <p className="empty">Ihr habt noch keinen Wettbewerb angelegt.</p>}
      {data && data.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Wettbewerb</th>
                <th>Stand</th>
                <th className="num">Budget</th>
                <th className="num">Projekte</th>
                <th className="num">Stimmen</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/admin/c/${c.id}`}>{c.title}</Link>
                    <div className="small muted">
                      {formatDate(c.submissionStartsAt)} bis {formatDate(c.votingEndsAt)}
                    </div>
                  </td>
                  <td>{PHASE_LABEL[c.phase]}</td>
                  <td className="num">{formatEuro(c.budgetCents)}</td>
                  <td className="num">{c.projectCount}</td>
                  <td className="num">{formatNumber(c.totalVotes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// value for <input type="datetime-local">, in local time
const toInputDate = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
// back to an ISO date for the API. Empty stays empty, the server then says the field is missing.
const fromInputDate = (value: string) => (value ? new Date(value).toISOString() : '');
const DAY = 86_400_000;

export function NewCompetitionPage() {
  const navigate = useNavigate();
  const start = new Date();
  start.setMinutes(0, 0, 0);
  const [form, setForm] = useState({
    title: '',
    description: '',
    region: '',
    budgetEuro: '10000',
    prizeShares: '50, 30, 20',
    submissionStartsAt: toInputDate(start),
    votingStartsAt: toInputDate(new Date(start.getTime() + 21 * DAY)),
    votingEndsAt: toInputDate(new Date(start.getTime() + 42 * DAY)),
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const update = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [key]: e.target.value });

  const shares = form.prizeShares.split(/[,;\s]+/).filter(Boolean).map(Number);
  const budget = Number(form.budgetEuro) || 0;
  const sharesValid = shares.length > 0 && shares.every((s) => s > 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFieldErrors({});
    setError(null);
    try {
      const res = await api.post<{ id: string }>('/api/admin/competitions', {
        title: form.title,
        description: form.description,
        region: form.region,
        budgetEuro: budget,
        prizeShares: shares,
        submissionStartsAt: fromInputDate(form.submissionStartsAt),
        votingStartsAt: fromInputDate(form.votingStartsAt),
        votingEndsAt: fromInputDate(form.votingEndsAt),
      });
      navigate(`/admin/c/${res.id}`);
    } catch (err) {
      if (err instanceof RequestError && err.body.issues) setFieldErrors(err.fieldErrors());
      else setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="stack-loose">
      <Link to="/admin" className="small">
        Zurück zur Übersicht
      </Link>
      <h1 className="page-title">Neuer Wettbewerb</h1>
      <form className="form" onSubmit={submit} noValidate>
        <Field label="Titel" error={fieldErrors.title}>
          {(p) => <input {...p} type="text" value={form.title} onChange={update('title')} placeholder="z. B. Vereinspreis 2027" />}
        </Field>
        <Field label="Beschreibung" hint="Was wollt ihr fördern, und wer kann mitmachen?" error={fieldErrors.description}>
          {(p) => <textarea {...p} value={form.description} onChange={update('description')} />}
        </Field>
        <div className="form-row">
          <Field label="Region" error={fieldErrors.region}>
            {(p) => <input {...p} type="text" value={form.region} onChange={update('region')} />}
          </Field>
          <Field label="Budget in Euro" error={fieldErrors.budgetEuro}>
            {(p) => <input {...p} type="number" min={100} step={100} value={form.budgetEuro} onChange={update('budgetEuro')} />}
          </Field>
        </div>
        <Field
          label="Aufteilung in Prozent"
          hint={
            sharesValid
              ? `Ergibt ${shares.map((s) => formatEuro(budget * s)).join(', ')} (zusammen ${shares.reduce((a, b) => a + b, 0)} %)`
              : 'Mit Komma getrennt, zusammen 100'
          }
          error={fieldErrors.prizeShares}
        >
          {(p) => <input {...p} type="text" value={form.prizeShares} onChange={update('prizeShares')} />}
        </Field>
        <div className="form-row">
          <Field label="Einreichung ab" error={fieldErrors.submissionStartsAt}>
            {(p) => <input {...p} type="datetime-local" value={form.submissionStartsAt} onChange={update('submissionStartsAt')} />}
          </Field>
          <Field label="Abstimmung ab" error={fieldErrors.votingStartsAt}>
            {(p) => <input {...p} type="datetime-local" value={form.votingStartsAt} onChange={update('votingStartsAt')} />}
          </Field>
          <Field label="Abstimmung bis" error={fieldErrors.votingEndsAt}>
            {(p) => <input {...p} type="datetime-local" value={form.votingEndsAt} onChange={update('votingEndsAt')} />}
          </Field>
        </div>
        {error && <Notice kind="error">{error}</Notice>}
        <div>
          <button className="btn" disabled={busy}>
            {busy ? 'Wird angelegt...' : 'Wettbewerb anlegen'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function AdminCompetitionPage() {
  const { id = '' } = useParams();
  const competitions = useApi<CompetitionSummary[]>('/api/admin/competitions');
  const stats = useApi<CompetitionStats>(`/api/admin/competitions/${id}/stats`);
  const projects = useApi<AdminProject[]>(`/api/admin/competitions/${id}/projects`);
  const comp = competitions.data?.find((c) => c.id === id);

  if (stats.error) return <Notice kind="error">{stats.error}</Notice>;
  if (!comp || !stats.data) return <p className="muted">Wettbewerb wird geladen...</p>;
  const s = stats.data;
  const pending = (projects.data ?? []).filter((p) => p.status === 'pending');
  const reload = () => {
    projects.reload();
    stats.reload();
  };

  return (
    <>
      <Link to="/admin" className="small">
        Zurück zur Übersicht
      </Link>
      <div className="dash-head">
        <div className="stack-tight">
          <h1 className="page-title">{comp.title}</h1>
          <p className="muted">
            {PHASE_LABEL[comp.phase]}, Budget {formatEuro(comp.budgetCents)}.{' '}
            <Link to={`/c/${comp.slug}`}>Öffentliche Seite ansehen</Link>
          </p>
        </div>
        <a className="btn btn-quiet" href={`/api/admin/competitions/${id}/export.csv`} download>
          Ergebnis als CSV
        </a>
      </div>

      <section>
        <h2>Überblick</h2>
        <dl className="overview">
          <dt>Bestätigte Stimmen</dt>
          <dd>{formatNumber(s.votes.confirmed)}</dd>
          <dt>Per E-Mail bestätigt</dt>
          <dd>
            {Math.round(s.votes.confirmationRate * 100)} % der begonnenen Stimmen
            {s.votes.pending > 0 && <span className="muted"> ({s.votes.pending} warten noch)</span>}
          </dd>
          <dt>Öffentliche Projekte</dt>
          <dd>{s.projects.approved}</dd>
          <dt>Zu prüfen</dt>
          <dd>{s.projects.pending}</dd>
        </dl>
      </section>

      <section>
        <h2>Stimmen pro Tag</h2>
        <VotesChart data={s.votesPerDay} />
      </section>

      <section>
        <h2>Projekte prüfen</h2>
        {comp.phase === 'ended' ? (
          <p className="empty">Der Wettbewerb ist beendet, die Projekte können nicht mehr geändert werden.</p>
        ) : pending.length === 0 ? (
          <p className="empty">Gerade wartet kein Projekt auf eine Prüfung.</p>
        ) : (
          <div className="stack">
            {pending.map((p) => (
              <ModerationItem key={p.id} project={p} onDone={reload} />
            ))}
          </div>
        )}
      </section>

      {s.byCategory.length > 0 && (
        <section>
          <h2>Nach Kategorie</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Kategorie</th>
                  <th className="num">Projekte</th>
                  <th className="num">Stimmen</th>
                  <th className="num">Preisgeld</th>
                </tr>
              </thead>
              <tbody>
                {s.byCategory.map((c) => (
                  <tr key={c.category}>
                    <td>{CATEGORY_LABELS[c.category]}</td>
                    <td className="num">{c.projects}</td>
                    <td className="num">{formatNumber(c.votes)}</td>
                    <td className="num">{formatEuro(c.payoutCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2>Alle Projekte</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Projekt</th>
                <th>Verein</th>
                <th>Status</th>
                <th className="num">Stimmen</th>
              </tr>
            </thead>
            <tbody>
              {(projects.data ?? []).map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.title}
                    {p.rejectionReason && <div className="small muted">{p.rejectionReason}</div>}
                  </td>
                  <td>
                    {p.clubName}
                    <div className="small muted">{p.clubEmail}</div>
                  </td>
                  <td>
                    <span className={`status status-${p.status}`}>{STATUS_TEXT[p.status]}</span>
                  </td>
                  <td className="num">{formatNumber(p.votes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function ModerationItem({ project: p, onDone }: { project: AdminProject; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function decide(status: 'approved' | 'rejected', e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/admin/projects/${p.id}/moderate`, { status, reason: status === 'rejected' ? reason : undefined });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <article className="mod-item">
      {p.photoUrl && <img className="project-photo" src={p.photoUrl} alt="" />}
      <div className="project-meta">
        <span className="cat">{CATEGORY_LABELS[p.category]}</span>
        <span>{p.clubName}</span>
        <span>braucht {formatEuro(p.fundingGoalCents)}</span>
      </div>
      <h3>{p.title}</h3>
      <p>{p.summary}</p>
      <details>
        <summary>Ganze Beschreibung</summary>
        <p className="prewrap">{p.description}</p>
      </details>
      {!rejecting ? (
        <div className="mod-actions">
          <button className="btn btn-small" disabled={busy} onClick={() => decide('approved')}>
            Freigeben
          </button>
          <button className="btn btn-small btn-danger" disabled={busy} onClick={() => setRejecting(true)}>
            Ablehnen
          </button>
        </div>
      ) : (
        <form className="mod-actions" onSubmit={(e) => decide('rejected', e)}>
          <div className="grow">
            <Field label="Begründung für den Verein" hint="Der Verein sieht diesen Text.">
              {(f) => <input {...f} type="text" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />}
            </Field>
          </div>
          <button className="btn btn-small btn-danger" disabled={busy || reason.trim().length < 5}>
            Projekt ablehnen
          </button>
          <button type="button" className="btn btn-small btn-quiet" onClick={() => setRejecting(false)}>
            Abbrechen
          </button>
        </form>
      )}
      {error && <Notice kind="error">{error}</Notice>}
    </article>
  );
}
