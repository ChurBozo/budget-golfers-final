// VIEW (route): /login and /register (Wireframe 1). Client-side checks first,
// then POST /api/auth/login or /register; 401, 409 and 422 show under the fields.
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { ApiTag, Notice } from '../components/Common';
import wordmark from '../assets/logo-wordmark-light.svg';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(values, register) {
  const errors = {};
  if (!values.email.trim()) errors.email = 'Enter your email.';
  else if (!EMAIL.test(values.email.trim())) errors.email = 'Enter a valid email address.';
  if (!values.password) errors.password = 'Enter your password.';
  else if (register && values.password.length < 8) errors.password = 'Use at least 8 characters.';
  if (register) {
    const name = values.displayName.trim();
    if (name.length < 2 || name.length > 30) errors.displayName = 'Use 2 to 30 characters.';
  }
  return errors;
}

function Field({ id, label, error, help, ...input }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={error ? 'invalid' : undefined}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : help ? `${id}-help` : undefined}
        {...input}
      />
      {error && (
        <span className="field-error" id={`${id}-error`}>
          {error}
        </span>
      )}
      {help && !error && (
        <span className="help" id={`${id}-help`}>
          {help}
        </span>
      )}
    </div>
  );
}

export default function AuthView({ mode }) {
  const register = mode === 'register';
  const { isSignedIn, signIn, register: createAccount } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const headingRef = usePageTitle(register ? 'Create account' : 'Sign in');

  const [values, setValues] = useState({ email: '', password: '', displayName: '', homeCourseName: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setErrors({});
    setFormError(null);
  }, [register]);

  const from = location.state?.from?.pathname ? `${location.state.from.pathname}${location.state.from.search || ''}` : '/dashboard';
  if (isSignedIn) return <Navigate to={from} replace />;

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const found = validate(values, register);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      if (register) await createAccount(values);
      else await signIn(values);
      navigate(from, { replace: true });
    } catch (err) {
      if (err.code === 'EMAIL_TAKEN') setErrors({ email: 'An account with this email already exists. Sign in instead.' });
      else if (err.status === 401) setErrors({ password: err.message });
      else if (err.status === 422) setErrors(err.fieldErrors());
      else setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="auth" aria-label={register ? 'Create account' : 'Sign in'}>
      <div className="auth-hero">
        <img src={wordmark} alt="Budget Golfers" width="220" height="54" />
        <div>
          <h1>Your whole golf game, on any screen.</h1>
          <p>
            Sign in to see every round you have tracked, spot where the shots are going and see how you stack up
            against the Budget Golfers community. Free, always.
          </p>
          <ul>
            <li>Round history with hole-by-hole scorecards</li>
            <li>Scoring, putting and accuracy trends</li>
            <li>Average distance for every club in your bag</li>
            <li>Community leaderboard</li>
          </ul>
        </div>
        <small>No subscriptions. No paywalls. No data lock-in.</small>
      </div>

      <div className="auth-panel">
        <div className="auth-card">
          <nav className="tabs" aria-label="Account">
            <Link to="/login" state={location.state} className={register ? undefined : 'active'}>
              Sign in
            </Link>
            <Link to="/register" state={location.state} className={register ? 'active' : undefined}>
              Create account
            </Link>
          </nav>

          <form className="ajax" onSubmit={submit} noValidate>
            <ApiTag>{register ? 'POST /api/auth/register' : 'POST /api/auth/login'}</ApiTag>
            <h1 ref={headingRef} tabIndex={-1}>
              {register ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="muted">Use the same email as your Budget Golfers app.</p>

            {location.state?.expired && !register && (
              <Notice>Your session ended. Please sign in again.</Notice>
            )}

            {register && (
              <Field
                id="displayName"
                label="Display name"
                autoComplete="nickname"
                value={values.displayName}
                onChange={set('displayName')}
                error={errors.displayName}
                help='Shown on the leaderboard, e.g. "Aroha M."'
              />
            )}
            <Field
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={set('email')}
              error={errors.email}
            />
            <Field
              id="password"
              label="Password"
              type="password"
              autoComplete={register ? 'new-password' : 'current-password'}
              value={values.password}
              onChange={set('password')}
              error={errors.password}
              help={register ? 'At least 8 characters.' : undefined}
            />
            {register && (
              <Field
                id="homeCourseName"
                label="Home course (optional)"
                value={values.homeCourseName}
                onChange={set('homeCourseName')}
                error={errors.homeCourseName}
                help="Type it as you would in the app."
              />
            )}

            {formError && (
              <div style={{ marginBottom: 14 }}>
                <Notice tone="error">{formError}</Notice>
              </div>
            )}

            <button className="btn btn-block" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
