import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  formatEuro,
  type Category,
  type ClubProject,
  type CompetitionSummary,
} from '@vv/shared';
import { Field, Notice } from '../components/Field.tsx';
import { PhotoButton } from '../components/PhotoButton.tsx';
import { RequestError, api, errorMessage } from '../lib/api.ts';
import { useAuth } from '../lib/auth.tsx';
import { formatDate, formatNumber } from '../lib/format.ts';
import { useApi } from '../lib/hooks.ts';

const STATUS_TEXT = { pending: 'wird geprüft', approved: 'freigegeben', rejected: 'abgelehnt' } as const;

export function ClubDashboard() {
  const { user } = useAuth();
  const mine = useApi<ClubProject[]>('/api/club/projects');
  const competitions = useApi<CompetitionSummary[]>('/api/competitions');
  const alreadySubmitted = new Set(mine.data?.map((p) => p.competitionId));
  const open = (competitions.data ?? []).filter((c) => c.phase === 'submission' && !alreadySubmitted.has(c.id));

  return (
    <>
      <div className="dash-head">
        <div>
          <h1 className="page-title">{user?.name}</h1>
          <p className="muted">{user?.city}</p>
        </div>
      </div>

      <section>
        <h2>Offen für Einreichungen</h2>
        {open.length === 0 ? (
          <p className="empty">Gerade läuft kein Wettbewerb, bei dem ihr einreichen könnt. Neue Wettbewerbe erscheinen hier.</p>
        ) : (
          <ul className="comp-list">
            {open.map((c) => (
              <li key={c.id} className="comp-item">
                <h3>{c.title}</h3>
                <span className="facts">
                  <span>{formatEuro(c.budgetCents)} Preisgeld</span>
                  <span>von {c.sponsorName}</span>
                  <span>Einreichen bis {formatDate(c.votingStartsAt)}</span>
                </span>
                <div>
                  <Link className="btn btn-small" to={`/club/submit/${c.id}`}>
                    Projekt einreichen
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Eure Projekte</h2>
        {mine.error && <Notice kind="error">{mine.error}</Notice>}
        {mine.data?.length === 0 && <p className="empty">Euer Verein hat noch kein Projekt eingereicht.</p>}
        {mine.data && mine.data.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Foto</th>
                  <th>Projekt</th>
                  <th>Wettbewerb</th>
                  <th>Status</th>
                  <th className="num">Stimmen</th>
                </tr>
              </thead>
              <tbody>
                {mine.data.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.photoUrl && <img className="thumb-small" src={p.photoUrl} alt="" />}
                      {p.phase !== 'ended' && (
                        <PhotoButton projectId={p.id} hasPhoto={p.photoUrl !== null} onUploaded={mine.reload} />
                      )}
                    </td>
                    <td>
                      {p.status === 'approved' ? <Link to={`/p/${p.id}`}>{p.title}</Link> : p.title}
                      {p.rejectionReason && <div className="small muted">Begründung: {p.rejectionReason}</div>}
                    </td>
                    <td>
                      <Link to={`/c/${p.competitionSlug}`}>{p.competitionTitle}</Link>
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
        )}
      </section>
    </>
  );
}

const emptyProject = { title: '', summary: '', description: '', category: 'sport' as Category, fundingGoalEuro: '' };

export function SubmitProjectPage() {
  const { competitionId = '' } = useParams();
  const navigate = useNavigate();
  const competitions = useApi<CompetitionSummary[]>('/api/competitions');
  const comp = competitions.data?.find((c) => c.id === competitionId);
  const [form, setForm] = useState(emptyProject);
  const [photo, setPhoto] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const update = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [key]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFieldErrors({});
    setError(null);
    let created: { id: string };
    try {
      created = await api.post(`/api/competitions/${competitionId}/projects`, {
        ...form,
        fundingGoalEuro: Number(form.fundingGoalEuro) || 0,
      });
    } catch (err) {
      if (err instanceof RequestError && err.body.issues) setFieldErrors(err.fieldErrors());
      else setError(errorMessage(err));
      setBusy(false);
      return;
    }
    // the project exists now, so a failed photo upload shouldn't lose it
    if (photo) {
      try {
        await api.uploadPhoto(created.id, photo);
      } catch (err) {
        setError(`Das Projekt ist eingereicht, aber das Foto ging nicht: ${errorMessage(err)} Ihr könnt es in der Übersicht noch einmal versuchen.`);
        setBusy(false);
        return;
      }
    }
    navigate('/club', { replace: true });
  }

  if (competitions.data && !comp) return <Notice kind="error">Wettbewerb nicht gefunden.</Notice>;

  return (
    <div className="stack-loose">
      <Link to="/club" className="small">
        Zurück zur Vereinsübersicht
      </Link>
      <div className="stack-tight">
        <h1 className="page-title">Projekt einreichen</h1>
        {comp && (
          <p className="muted">
            Für {comp.title}: {formatEuro(comp.budgetCents)} von {comp.sponsorName}. Der Sponsor prüft jedes Projekt, bevor
            es öffentlich wird.
          </p>
        )}
      </div>
      {comp && comp.phase !== 'submission' && <Notice kind="warn">Für diesen Wettbewerb ist die Einreichung geschlossen.</Notice>}
      <form className="form" onSubmit={submit} noValidate>
        <Field label="Titel" hint="Was passiert mit dem Geld? Höchstens 100 Zeichen." error={fieldErrors.title}>
          {(p) => <input {...p} type="text" maxLength={100} value={form.title} onChange={update('title')} />}
        </Field>
        <Field
          label="Kurzbeschreibung"
          hint={`Erscheint in der Projektliste. ${form.summary.length}/280 Zeichen.`}
          error={fieldErrors.summary}
        >
          {(p) => <textarea {...p} rows={3} maxLength={280} className="short" value={form.summary} onChange={update('summary')} />}
        </Field>
        <Field
          label="Beschreibung"
          hint="Wer profitiert, was kauft oder macht ihr, wer hilft mit? Mindestens 50 Zeichen."
          error={fieldErrors.description}
        >
          {(p) => <textarea {...p} rows={8} value={form.description} onChange={update('description')} />}
        </Field>
        <div className="form-row">
          <Field label="Kategorie" error={fieldErrors.category}>
            {(p) => (
              <select {...p} value={form.category} onChange={update('category')}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Förderziel in Euro" error={fieldErrors.fundingGoalEuro}>
            {(p) => (
              <input
                {...p}
                type="number"
                min={50}
                step={50}
                inputMode="numeric"
                value={form.fundingGoalEuro}
                onChange={update('fundingGoalEuro')}
              />
            )}
          </Field>
        </div>
        <Field label="Foto (freiwillig)" hint="JPG, PNG oder WebP, höchstens 8 MB. Projekte mit Foto bekommen mehr Aufmerksamkeit.">
          {(p) => (
            <input
              {...p}
              className="file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
          )}
        </Field>
        {error && <Notice kind="error">{error}</Notice>}
        <div>
          <button className="btn" disabled={busy}>
            {busy ? 'Wird eingereicht...' : 'Projekt zur Prüfung einreichen'}
          </button>
        </div>
      </form>
    </div>
  );
}
