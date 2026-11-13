// VIEW (route): /settings (Wireframe 7). Profile, preferences, data export
// and account deletion, which are actions here rather than separate pages.
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePreferences } from '../context/PreferencesContext';
import { useProfile, useExport } from '../hooks/useProfile';
import { useCourses } from '../hooks/useCourses';
import { usePageTitle } from '../hooks/usePageTitle';
import { ApiTag, ConfirmDialog, Icon, Notice } from '../components/Common';
import { UnitToggle } from '../components/layout/AppShell';

function ProfileForm({ user, courses, onSave, saving, saved, error, fieldErrors }) {
  const [name, setName] = useState(user.displayName);
  const [home, setHome] = useState(user.homeCourse?.id ?? '');
  const [localError, setLocalError] = useState(null);
  useEffect(() => {
    setName(user.displayName);
    setHome(user.homeCourse?.id ?? '');
  }, [user.displayName, user.homeCourse?.id]);

  const submit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 30) {
      setLocalError('Use 2 to 30 characters.');
      return;
    }
    setLocalError(null);
    onSave({ displayName: trimmed, homeCourseId: home || null });
  };
  const nameError = localError || fieldErrors.displayName;

  return (
    <form className="card ajax" onSubmit={submit} noValidate>
      <ApiTag>PATCH /api/users/:userId</ApiTag>
      <h2>Profile</h2>
      <div className="field">
        <label htmlFor="dname">Display name</label>
        <input
          id="dname"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={nameError ? 'invalid' : undefined}
          aria-invalid={nameError ? 'true' : undefined}
        />
        {nameError ? <span className="field-error">{nameError}</span> : <span className="help">Shown on the leaderboard.</span>}
      </div>
      <div className="field">
        <label htmlFor="home">Home course</label>
        <select id="home" value={home} onChange={(e) => setHome(e.target.value)}>
          <option value="">No home course</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {fieldErrors.homeCourseId ? (
          <span className="field-error">{fieldErrors.homeCourseId}</span>
        ) : (
          <span className="help">Your courses come from the rounds you upload from the app.</span>
        )}
      </div>
      <div className="field">
        <label htmlFor="hcp">Handicap estimate</label>
        <input id="hcp" type="text" value={user.handicapEstimate ?? 'Play 3 rounds to get one'} readOnly />
        <span className="help">Calculated from your rounds, as in the app.</span>
      </div>
      {saved && <Notice>Profile saved.</Notice>}
      {error && !Object.keys(fieldErrors).length && <Notice tone="error">{error.message}</Notice>}
      <button className="btn" type="submit" disabled={saving} style={{ marginTop: saved || error ? 14 : 0 }}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}

export default function SettingsView() {
  const navigate = useNavigate();
  const headingRef = usePageTitle('Settings');
  const { units, showOnLeaderboard, setPreference } = usePreferences();
  const { user, saveProfile, saving, saved, error, fieldErrors, deleteAccount, deleting, deleteError } = useProfile();
  const { courses } = useCourses();
  const exporter = useExport();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const location = useLocation();

  // "Export" on the Rounds view links to /settings#export.
  useEffect(() => {
    if (location.hash === '#export') document.getElementById('export')?.scrollIntoView({ block: 'center' });
  }, [location.hash]);

  const onDelete = async () => {
    if (await deleteAccount()) navigate('/login', { replace: true });
  };

  if (!user) return null;

  return (
    <section className="view" aria-labelledby="set-title">
      <div className="view-head">
        <div>
          <h1 id="set-title" ref={headingRef} tabIndex={-1}>
            Settings
          </h1>
          <p className="muted">Profile, preferences and your data · signed in as {user.email}</p>
        </div>
      </div>

      <div className="grid grid-2e">
        <ProfileForm
          user={user}
          courses={courses}
          onSave={saveProfile}
          saving={saving}
          saved={saved}
          error={error}
          fieldErrors={fieldErrors}
        />

        <div className="stack">
          <article className="card ajax">
            <ApiTag>PATCH /api/users/:userId (preferences)</ApiTag>
            <h2>Preferences</h2>
            <div className="setting-row">
              <p>
                <b>Distance units</b>
                <br />
                <span className="muted">Metres or yards across the dashboard</span>
              </p>
              <UnitToggle units={units} onChange={(v) => setPreference('units', v)} name="units2" idPrefix="u2" />
            </div>
            <div className="setting-row">
              <p>
                <b>Show me on the leaderboard</b>
                <br />
                <span className="muted">Only your display name, home course and averages are shared</span>
              </p>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={showOnLeaderboard}
                  onChange={(e) => setPreference('showOnLeaderboard', e.target.checked)}
                  aria-label="Show me on the leaderboard"
                />
                <span className="track" />
              </label>
            </div>
          </article>

          {/* DataExport */}
          <article className="card ajax" id="export">
            <ApiTag>GET /api/users/:userId/export?format=csv</ApiTag>
            <h2>Download my data</h2>
            <p className="muted">Every round, hole and club average you have stored.</p>
            {exporter.error && <Notice tone="error">{exporter.error.message}</Notice>}
            <button type="button" className="btn btn-ghost" onClick={() => exporter.download('csv')} disabled={Boolean(exporter.busy)}>
              <Icon name="download" />
              {exporter.busy === 'csv' ? 'Preparing…' : 'CSV'}
            </button>{' '}
            <button type="button" className="btn btn-ghost" onClick={() => exporter.download('json')} disabled={Boolean(exporter.busy)}>
              <Icon name="download" />
              {exporter.busy === 'json' ? 'Preparing…' : 'JSON'}
            </button>
          </article>

          {/* DeleteAccount */}
          <article className="card danger-zone ajax">
            <ApiTag>DELETE /api/users/:userId</ApiTag>
            <h2>Delete account</h2>
            <p className="muted">Removes your cloud account and synced rounds. Data on your phone is not affected.</p>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                setTyped('');
                setConfirming(true);
              }}
            >
              Delete my account
            </button>
          </article>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Delete your account?"
        confirmLabel="Delete my account"
        busy={deleting}
        confirmDisabled={typed.trim().toUpperCase() !== 'DELETE'}
        onCancel={() => setConfirming(false)}
        onConfirm={onDelete}
      >
        <p>
          This removes your account, every uploaded round, your courses and club distances. It cannot be undone.
          Rounds on your phone stay there.
        </p>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="confirm-delete">
            Type <b>DELETE</b> to confirm
          </label>
          <input id="confirm-delete" type="text" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </div>
        {deleteError && <Notice tone="error">{deleteError.message}</Notice>}
      </ConfirmDialog>
    </section>
  );
}
