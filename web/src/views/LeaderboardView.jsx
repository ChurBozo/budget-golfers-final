// VIEW (route): /leaderboard?sort=&period= (Wireframe 6). Golfers who opted
// in with at least 3 rounds in the period; your own row is highlighted.
import { Link, useSearchParams } from 'react-router-dom';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { usePageTitle } from '../hooks/usePageTitle';
import { ApiTag, EmptyState, ErrorState, Skeleton } from '../components/Common';
import { Chips } from '../components/Controls';
import { LeaderboardTable } from '../components/LeaderboardTable';
import { formatChange, formatNumber } from '../utils/format';

const SORTS = [
  { value: 'avgScore', label: 'Average score' },
  { value: 'improved', label: 'Most improved' },
  { value: 'rounds', label: 'Rounds played' },
];
const PERIODS = [
  { value: 'season', label: 'This season', words: 'this season' },
  { value: 'month', label: 'Last 30 days', words: 'in the last 30 days' },
  { value: 'all', label: 'All time', words: 'in total' },
];

export default function LeaderboardView() {
  const [params] = useSearchParams();
  const sort = SORTS.some((s) => s.value === params.get('sort')) ? params.get('sort') : 'avgScore';
  const period = PERIODS.some((p) => p.value === params.get('period')) ? params.get('period') : 'season';
  const periodWords = PERIODS.find((p) => p.value === period).words;
  const headingRef = usePageTitle('Leaderboard');
  const { rows, meta, me, myUserId, loading, loadingMore, error, hasMore, loadMore, reload } = useLeaderboard({ sort, period });

  const link = (next) => {
    const out = new URLSearchParams({ sort, period, ...next });
    if (out.get('sort') === 'avgScore') out.delete('sort');
    if (out.get('period') === 'season') out.delete('period');
    const s = out.toString();
    return `/leaderboard${s ? `?${s}` : ''}`;
  };

  return (
    <section className="view" aria-labelledby="lb-title">
      <div className="view-head">
        <div>
          <h1 id="lb-title" ref={headingRef} tabIndex={-1}>
            Community leaderboard
          </h1>
          <p className="muted">Golfers with at least 3 rounds in the period · opt out any time in Settings</p>
        </div>
        {/* SortTabs */}
        <Chips label="Sort leaderboard" items={SORTS} active={sort} linkFor={(v) => link({ sort: v })} />
      </div>

      <div className="view-head" style={{ marginTop: -8 }}>
        <Chips label="Period" items={PERIODS} active={period} linkFor={(v) => link({ period: v })} />
      </div>

      {/* LeaderboardTable */}
      <article className="card ajax">
        <ApiTag>
          GET /api/leaderboard?sort={sort}&amp;period={period}
        </ApiTag>
        {error && !rows ? (
          <ErrorState title="Couldn't load the leaderboard." error={error} onRetry={reload} />
        ) : !rows ? (
          <Skeleton lines={6} label="Loading leaderboard" />
        ) : rows.length === 0 ? (
          <EmptyState icon="trophy">
            Nobody has played <b>3 rounds</b> {periodWords} yet. Play 3 rounds to join the leaderboard.
          </EmptyState>
        ) : (
          <>
            <LeaderboardTable rows={rows} myUserId={myUserId} sort={sort} sortLink={(v) => link({ sort: v })} />
            <div className="pagination">
              <span className="muted">
                {meta.total} golfer{meta.total === 1 ? '' : 's'} ranked{loading ? ' · updating…' : ''}
              </span>
              {hasMore && (
                <span>
                  <button type="button" className="btn btn-sm" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </button>
                </span>
              )}
            </div>
          </>
        )}
      </article>

      {/* Where you stand when you are not on the board */}
      {rows && me && !me.onLeaderboard && (
        <article className="card" style={{ marginTop: 18 }}>
          <h2>Your numbers</h2>
          <EmptyState icon="trophy">
            {me.roundsPlayed < (meta?.minimumRounds ?? 3) ? (
              <>
                You have <b>{me.roundsPlayed}</b> 18-hole round{me.roundsPlayed === 1 ? '' : 's'} {periodWords}. Play{' '}
                {(meta?.minimumRounds ?? 3) - me.roundsPlayed} more to join the leaderboard.
              </>
            ) : (
              <>
                You are hidden from the leaderboard. Average {formatNumber(me.averageScore)}, improvement{' '}
                {formatChange(me.improvement)}, {me.roundsPlayed} rounds. <Link to="/settings">Show me in Settings</Link>.
              </>
            )}
          </EmptyState>
        </article>
      )}
    </section>
  );
}
