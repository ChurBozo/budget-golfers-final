// VIEW (route): /clubs (Wireframe 5). Average distance per club from shot
// pins recorded in the app: the same numbers behind the app's club suggestions.
import { usePreferences } from '../context/PreferencesContext';
import { useClubs } from '../hooks/useClubs';
import { usePageTitle } from '../hooks/usePageTitle';
import { ApiTag, EmptyState, ErrorState, Skeleton } from '../components/Common';
import { ClubBars, ClubTable } from '../components/Clubs';

export default function ClubsView() {
  const { units } = usePreferences();
  const headingRef = usePageTitle('Clubs');
  const { clubs, error, reload } = useClubs();
  const unitWord = units === 'imperial' ? 'yards' : 'metres';

  return (
    <section className="view" aria-labelledby="clubs-title">
      <div className="view-head">
        <div>
          <h1 id="clubs-title" ref={headingRef} tabIndex={-1}>
            Club performance
          </h1>
          <p className="muted">
            Average carry from shot pins recorded in the app · the same numbers that drive club recommendations
          </p>
        </div>
      </div>

      {error && !clubs ? (
        <article className="card">
          <ErrorState title="Couldn't load your clubs." error={error} onRetry={reload} />
        </article>
      ) : (
        <div className="grid grid-2">
          {/* ClubDistanceChart */}
          <article className="card ajax">
            <ApiTag>GET /api/clubs/:userId</ApiTag>
            <div className="card-head">
              <h2>Average distance</h2>
              <span className="muted">{unitWord}</span>
            </div>
            {!clubs ? (
              <Skeleton lines={8} label="Loading club distances" />
            ) : clubs.measured.length === 0 ? (
              <EmptyState icon="clubs">
                No club has {clubs.minimumShots} measured shots yet. Mark where your shots land on the map in the app,
                and averages will appear here.
              </EmptyState>
            ) : (
              <ClubBars clubs={clubs.measured} units={units} />
            )}
          </article>

          <div className="stack">
            {/* ClubTable */}
            <article className="card ajax">
              <ApiTag>clubs[] (same request)</ApiTag>
              <h2>Club detail</h2>
              {!clubs ? (
                <Skeleton lines={5} label="Loading club detail" />
              ) : clubs.measured.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>
                  {clubs.inBagCount} clubs in your bag. Shot counts appear once shots are recorded.
                </p>
              ) : (
                <ClubTable clubs={clubs.measured} units={units} />
              )}
            </article>

            {/* Not enough data (the template's empty state for this component) */}
            {clubs && clubs.notEnough.length > 0 && (
              <article className="card">
                <h2>Not enough data</h2>
                <EmptyState icon="clubs">
                  <b>{clubs.notEnough.map((c) => c.label).join(', ')}</b>{' '}
                  {clubs.notEnough.length === 1 ? 'has' : 'have'} fewer than {clubs.minimumShots} recorded shots. Track
                  a few more in the app and an average will appear here.
                </EmptyState>
              </article>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
