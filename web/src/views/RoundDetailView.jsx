// VIEW (route): /rounds/:roundId (Wireframe 4). The only request that loads
// hole-by-hole data. Delete asks first, then returns to /rounds.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePreferences } from '../context/PreferencesContext';
import { useRound } from '../hooks/useRounds';
import { usePageTitle } from '../hooks/usePageTitle';
import { ApiTag, ConfirmDialog, EmptyState, ErrorState, Notice, Skeleton } from '../components/Common';
import { StatCard } from '../components/StatCard';
import { ScoreKey, Scorecard, ShotList } from '../components/Scorecard';
import { formatDate, formatDateTime, formatToPar } from '../utils/format';

export default function RoundDetailView() {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const { units } = usePreferences();
  const { round, error, reload, deleteRound, deleting, deleteError } = useRound(roundId);
  const [confirming, setConfirming] = useState(false);
  const title = round ? `${round.course.name} · ${formatDate(round.playedAt)}` : 'Round';
  const headingRef = usePageTitle(round ? title : 'Round');

  const onDelete = async () => {
    if (await deleteRound()) navigate('/rounds', { replace: true, state: { deleted: title } });
  };

  return (
    <section className="view" aria-labelledby="rd-title">
      <Link className="breadcrumb" to="/rounds">
        ← Back to round history
      </Link>
      <div className="view-head">
        <div>
          <h1 id="rd-title" ref={headingRef} tabIndex={-1}>
            {round ? title : error ? 'Round' : 'Loading round…'}
          </h1>
          {round && (
            <p className="muted">
              {[
                `${round.holesPlayed} holes`,
                round.tee && `${round.tee} tees`,
                `Par ${round.course.par}`,
                round.source === 'mobile-app' ? `Synced from the app ${formatDateTime(round.syncedAt)}` : 'Added on the website',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
        {round && (
          <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirming(true)}>
            Delete round
          </button>
        )}
      </div>

      {deleteError && <Notice tone="error">{deleteError.message}</Notice>}

      {/* RoundSummary */}
      <div className="grid grid-4 ajax">
        <ApiTag>GET /api/rounds/:roundId</ApiTag>
        {error && !round ? (
          <article className="card" style={{ gridColumn: '1 / -1' }}>
            <ErrorState title="Couldn't load this round." error={error} onRetry={reload} />
          </article>
        ) : !round ? (
          [0, 1, 2, 3].map((i) => (
            <article className="card" key={i}>
              <Skeleton lines={2} label="Loading round" />
            </article>
          ))
        ) : (
          <>
            <StatCard label="Score" value={round.totals.strokes} suffix={` (${formatToPar(round.totals.toPar)})`} />
            <StatCard label="Putts" value={round.totals.putts} />
            <StatCard label="Fairways" value={round.totals.fairwaysHit} suffix={`/${round.totals.fairwaysPossible}`} />
            <StatCard label="Greens in reg." value={round.totals.greensInRegulation} suffix={`/${round.holesPlayed}`} />
          </>
        )}
      </div>

      {round && (
        <>
          {/* Scorecard */}
          <article className="card" style={{ marginTop: 18 }}>
            <div className="card-head">
              <h2>Scorecard</h2>
              <span className="muted">{round.holesPlayed === 18 ? 'Front and back nine' : 'Nine holes'}</span>
            </div>
            <Scorecard nines={round.nines} units={units} />
            <ScoreKey />
          </article>

          {/* ShotList */}
          <article className="card" style={{ marginTop: 18 }}>
            <div className="card-head">
              <h2>Shots</h2>
              <span className="muted">
                {round.shotCount} shot{round.shotCount === 1 ? '' : 's'} with GPS · open a hole to see them
              </span>
            </div>
            {round.shotCount === 0 ? (
              <EmptyState icon="clubs">No shots were marked on the map in this round, only scores.</EmptyState>
            ) : (
              <ShotList holes={round.holes} units={units} />
            )}
          </article>

          {round.notes && (
            <article className="card" style={{ marginTop: 18 }}>
              <h2>Notes</h2>
              <p style={{ margin: 0 }}>{round.notes}</p>
            </article>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirming}
        title="Delete this round?"
        confirmLabel="Delete round"
        busy={deleting}
        onCancel={() => setConfirming(false)}
        onConfirm={onDelete}
      >
        <p style={{ margin: 0 }}>
          {round ? title : 'This round'} will be removed from your account, and your statistics and club distances
          will be recalculated. The copy on your phone is not affected.
        </p>
      </ConfirmDialog>
    </section>
  );
}
