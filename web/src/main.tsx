import { StrictMode, Suspense, lazy, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { Role } from '@vv/shared';
import { Layout } from './components/Layout.tsx';
import { AuthProvider, useAuth } from './lib/auth.tsx';
import { CompetitionPage } from './pages/CompetitionPage.tsx';
import { ConfirmVotePage } from './pages/ConfirmVotePage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { ProjectPage } from './pages/ProjectPage.tsx';
// fonts are bundled with the app instead of loaded from Google (GDPR)
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/source-sans-3/wght.css';
import './styles.css';

// Pages for clubs and sponsors are loaded on demand. Most visitors are voters
// coming from a link and never need them.
const adminPages = () => import('./pages/AdminPages.tsx');
const clubPages = () => import('./pages/ClubPages.tsx');
const authPages = () => import('./pages/AuthPages.tsx');
const AdminDashboard = lazy(() => adminPages().then((m) => ({ default: m.AdminDashboard })));
const AdminCompetitionPage = lazy(() => adminPages().then((m) => ({ default: m.AdminCompetitionPage })));
const NewCompetitionPage = lazy(() => adminPages().then((m) => ({ default: m.NewCompetitionPage })));
const ClubDashboard = lazy(() => clubPages().then((m) => ({ default: m.ClubDashboard })));
const SubmitProjectPage = lazy(() => clubPages().then((m) => ({ default: m.SubmitProjectPage })));
const LoginPage = lazy(() => authPages().then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => authPages().then((m) => ({ default: m.RegisterPage })));

const loading = <p className="muted">Wird geladen...</p>;

function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return loading;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role !== role) return <p className="empty">Diese Seite ist nur für {role === 'admin' ? 'Sponsoren' : 'Vereine'}.</p>;
  return <Suspense fallback={loading}>{children}</Suspense>;
}

function NotFound() {
  return (
    <div className="stack">
      <h1 className="page-title">Seite nicht gefunden</h1>
      <p>
        <Link to="/">Zu den Wettbewerben</Link>
      </p>
    </div>
  );
}

const club = (page: ReactNode) => <RequireRole role="club">{page}</RequireRole>;
const admin = (page: ReactNode) => <RequireRole role="admin">{page}</RequireRole>;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="c/:slug" element={<CompetitionPage />} />
            <Route path="p/:id" element={<ProjectPage />} />
            <Route path="vote/confirm" element={<ConfirmVotePage />} />
            <Route path="login" element={<Suspense fallback={loading}><LoginPage /></Suspense>} />
            <Route path="register" element={<Suspense fallback={loading}><RegisterPage /></Suspense>} />
            <Route path="club" element={club(<ClubDashboard />)} />
            <Route path="club/submit/:competitionId" element={club(<SubmitProjectPage />)} />
            <Route path="admin" element={admin(<AdminDashboard />)} />
            <Route path="admin/new" element={admin(<NewCompetitionPage />)} />
            <Route path="admin/c/:id" element={admin(<AdminCompetitionPage />)} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
