// VIEW: the template's app shell. The sidebar, top bar and footer stay on
// screen; only the <Outlet> (the active view) changes on navigation.
import { Suspense } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePreferences } from '../../context/PreferencesContext';
import logo from '../../assets/logo.svg';
import { ApiTag, Icon, Skeleton } from '../Common';
import { firstName, initials } from '../../utils/format';

const NAV = [
  { to: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { to: '/rounds', icon: 'rounds', label: 'Rounds' },
  { to: '/clubs', icon: 'clubs', label: 'Clubs' },
  { to: '/leaderboard', icon: 'trophy', label: 'Leaderboard' },
  { to: '/settings', icon: 'settings', label: 'Settings' },
];

function Sidebar({ onSignOut }) {
  return (
    <aside className="sidebar">
      <Link className="brand" to="/dashboard">
        <img src={logo} alt="" width="40" height="40" />
        <span>
          Budget Golfers<small>Web dashboard</small>
        </span>
      </Link>
      <nav aria-label="Main">
        <ul className="nav">
          {NAV.map((item) => (
            <li key={item.to}>
              {/* NavLink adds the "active" class, so the current tab is highlighted */}
              <NavLink to={item.to}>
                <Icon name={item.icon} />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <ul className="nav nav-bottom">
        <li>
          <a
            href="/login"
            onClick={(e) => {
              e.preventDefault();
              onSignOut();
            }}
          >
            <Icon name="logout" />
            Sign out
          </a>
        </li>
      </ul>
    </aside>
  );
}

/** UserChip: name and handicap from GET /api/users/me. */
export function UserChip({ user }) {
  if (!user) return <div className="user-chip" />;
  return (
    <div className="user-chip ajax">
      <ApiTag>GET /api/users/me</ApiTag>
      <span className="avatar" aria-hidden="true">
        {initials(user.displayName)}
      </span>
      <span>
        Kia ora, {firstName(user.displayName)}{' '}
        {user.handicapEstimate !== null && user.handicapEstimate !== undefined && (
          <span className="badge" title="Handicap estimate">
            HCP {user.handicapEstimate.toFixed(1)}
          </span>
        )}
      </span>
    </div>
  );
}

/** UnitToggle (template .segmented). */
export function UnitToggle({ units, onChange, name = 'units', idPrefix = 'u' }) {
  return (
    <div className="segmented" role="radiogroup" aria-label="Distance units">
      <input type="radio" name={name} id={`${idPrefix}-m`} checked={units === 'metric'} onChange={() => onChange('metric')} />
      <label htmlFor={`${idPrefix}-m`}>Metres</label>
      <input type="radio" name={name} id={`${idPrefix}-y`} checked={units === 'imperial'} onChange={() => onChange('imperial')} />
      <label htmlFor={`${idPrefix}-y`}>Yards</label>
    </div>
  );
}

/**
 * ThemeToggle. The template's dark theme is keyed on #theme-toggle being
 * checked (body:has(#theme-toggle:checked)), so this checkbox switches it.
 */
export function ThemeToggle({ theme, onChange }) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        id="theme-toggle"
        checked={theme === 'dark'}
        onChange={(e) => onChange(e.target.checked ? 'dark' : 'light')}
      />
      <span className="track" />
      <span className="switch-label">Dark</span>
    </label>
  );
}

function TopBar() {
  const { user } = useAuth();
  const { units, theme, setPreference, error, clearError } = usePreferences();
  return (
    <header className="topbar">
      <UserChip user={user} />
      <div className="topbar-tools ajax">
        <ApiTag>PATCH /api/users/:userId</ApiTag>
        {error && (
          <button type="button" className="badge pref-error" onClick={clearError} title="Dismiss">
            {error}
          </button>
        )}
        <UnitToggle units={units} onChange={(v) => setPreference('units', v)} />
        <ThemeToggle theme={theme} onChange={(v) => setPreference('theme', v)} />
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <span>© 2026 Budget Golfers Community · Free forever</span>
      <label className="annotate-toggle">
        <input type="checkbox" id="annotate" /> Show API annotations (design review)
      </label>
    </footer>
  );
}

export function AppShell() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Sidebar
        onSignOut={() => {
          signOut();
          navigate('/login', { replace: true });
        }}
      />
      <div className="main">
        <TopBar />
        <main className="content" id="main">
          {/* Views are lazy-loaded; the skeleton shows while a view's code downloads */}
          <Suspense
            fallback={
              <div className="card">
                <Skeleton />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
        <Footer />
      </div>
    </div>
  );
}
