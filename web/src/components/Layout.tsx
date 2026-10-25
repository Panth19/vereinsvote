import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.tsx';

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#2140B8" />
      <path d="M8 16.5l5 5L24 10" fill="none" stroke="#FFCE3A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <a href="#main" className="skip">
        Zum Inhalt springen
      </a>
      <header className="site-header">
        <div className="wrap">
          <NavLink to="/" className="brand">
            <Logo />
            VereinsVote
          </NavLink>
          <nav className="site-nav" aria-label="Hauptmenü">
            <NavLink to="/" end>
              Wettbewerbe
            </NavLink>
            {user ? (
              <>
                <NavLink to={user.role === 'admin' ? '/admin' : '/club'}>
                  {user.role === 'admin' ? 'Sponsor-Bereich' : 'Mein Verein'}
                </NavLink>
                <button
                  className="linklike"
                  onClick={async () => {
                    await logout();
                    navigate('/');
                  }}
                >
                  Abmelden
                </button>
              </>
            ) : (
              <NavLink to="/login">Anmelden</NavLink>
            )}
          </nav>
        </div>
      </header>
      <main id="main">
        <div className="wrap">
          <Outlet />
        </div>
      </main>
      <footer className="site-footer">
        <div className="wrap stack">
          <p>VereinsVote ist ein Portfolio-Projekt. Sponsor, Vereine und Stimmen auf dieser Seite sind ausgedacht.</p>
          <p>
            E-Mail-Adressen von Abstimmenden werden nicht gespeichert, nur ein nicht umkehrbarer Fingerabdruck, damit
            niemand doppelt abstimmt.
          </p>
        </div>
      </footer>
    </>
  );
}
