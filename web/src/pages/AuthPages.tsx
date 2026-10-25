import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { Me } from '@vv/shared';
import { Field, Notice } from '../components/Field.tsx';
import { RequestError, api, errorMessage } from '../lib/api.ts';
import { useAuth } from '../lib/auth.tsx';

const dashboard = (u: Me) => (u.role === 'admin' ? '/admin' : '/club');

export function LoginPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  // set by RequireRole when someone opens a protected page while logged out
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={dashboard(user)} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await api.post<Me>('/api/auth/login', { email, password });
      setUser(me);
      navigate(from ?? dashboard(me), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  function fillDemoAccount(demoEmail: string) {
    setEmail(demoEmail);
    setPassword('demo1234');
  }

  return (
    <div className="stack-loose">
      <h1 className="page-title">Anmelden</h1>
      <p className="muted">Für Vereine und Sponsoren. Zum Abstimmen brauchst du kein Konto.</p>
      <form className="form" onSubmit={submit}>
        <Field label="E-Mail">
          {(p) => <input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label="Passwort">
          {(p) => (
            <input
              {...p}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        {error && <Notice kind="error">{error}</Notice>}
        <div>
          <button className="btn" disabled={busy}>
            {busy ? 'Anmelden...' : 'Anmelden'}
          </button>
        </div>
        <p className="small">
          Neu hier? <Link to="/register">Verein registrieren</Link>
        </p>
      </form>
      <div className="demo-box stack-tight form-width">
        <p>
          <strong>Demo-Zugänge</strong> (Passwort <code>demo1234</code>)
        </p>
        <div className="row">
          <button type="button" className="btn btn-small btn-quiet" onClick={() => fillDemoAccount('sponsor@demo.vereinsvote.de')}>
            Als Sponsor
          </button>
          <button type="button" className="btn btn-small btn-quiet" onClick={() => fillDemoAccount('tsv@demo.vereinsvote.de')}>
            Als Verein
          </button>
        </div>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', city: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={dashboard(user)} replace />;

  const update = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [key]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      setUser(await api.post<Me>('/api/auth/register', form));
      navigate('/club');
    } catch (err) {
      if (err instanceof RequestError && err.body.issues) setFieldErrors(err.fieldErrors());
      else setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="stack-loose">
      <h1 className="page-title">Verein registrieren</h1>
      <p className="muted">Mit einem Vereinskonto könnt ihr Projekte bei laufenden Wettbewerben einreichen und eure Stimmen verfolgen.</p>
      <form className="form" onSubmit={submit} noValidate>
        <Field label="Name des Vereins" error={fieldErrors.name}>
          {(p) => <input {...p} type="text" value={form.name} onChange={update('name')} placeholder="z. B. SV Grün-Weiß Musterdorf" />}
        </Field>
        <Field label="Ort" error={fieldErrors.city}>
          {(p) => <input {...p} type="text" value={form.city} onChange={update('city')} autoComplete="address-level2" />}
        </Field>
        <Field label="E-Mail" hint="Über diese Adresse meldet sich der Sponsor bei euch." error={fieldErrors.email}>
          {(p) => <input {...p} type="email" value={form.email} onChange={update('email')} autoComplete="email" />}
        </Field>
        <Field label="Passwort" hint="Mindestens 8 Zeichen." error={fieldErrors.password}>
          {(p) => <input {...p} type="password" value={form.password} onChange={update('password')} autoComplete="new-password" />}
        </Field>
        {error && <Notice kind="error">{error}</Notice>}
        <div>
          <button className="btn" disabled={busy}>
            {busy ? 'Konto wird angelegt...' : 'Vereinskonto anlegen'}
          </button>
        </div>
      </form>
    </div>
  );
}
