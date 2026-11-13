// VIEW (route): /dashboard?period= (Wireframe 2). One useStats request feeds
// the stat cards, the trend chart and the accuracy card; useRounds gives the
// three most recent rounds. The period lives in the URL.
import { Link, useSearchParams } from 'react-router-dom';
import { usePreferences } from '../context/PreferencesContext';
import { useStats } from '../hooks/useStats';
import { useRounds } from '../hooks/useRounds';
import { usePageTitle } from '../hooks/usePageTitle';
import { ApiTag, EmptyState, ErrorState, Skeleton } from '../components/Common';
import { StatCard, lowerIsBetter } from '../components/StatCard';
import { ScoreTrendChart } from '../components/ScoreTrendChart';
import { AccuracyDonut } from '../components/AccuracyCard';
import { RoundList } from '../components/RoundList';
import { Chips } from '../components/Controls';
import { PERIODS, formatNumber, periodInfo } from '../utils/format';

function StatCards({ stats }) {
  const score = lowerIsBetter(stats.scoring.changeVsPreviousPeriod, stats.previousLabel);
  const putts = lowerIsBetter(stats.putting.changeVsPreviousPeriod, stats.previousLabel, 'improving');
  return (
    <>
      <StatCard label="Average score" value={formatNumber(stats.scoring.averageScore)} trend={score.text} trendTone={score.tone} />
      <StatCard label="Putts per round" value={formatNumber(stats.putting.puttsPerRound)} trend={putts.text} trendTone={putts.tone} />
      <StatCard
        label="Fairways hit"
        value={stats.accuracy.fairwaysHitPct ?? '–'}
        suffix={stats.accuracy.fairwaysHitPct !== null ? '%' : undefined}
        trend={`${formatNumber(stats.putting.threePuttsPerRound)} three-putts per round`}
      />
      <StatCard label="Rounds played" value={stats.roundsInPeriod} trend={null}>
        <div className="trend muted">
          {stats.scoring.bestScore !== null ? (
            <Link className="stat-link" to={`/rounds/${stats.scoring.bestRoundId}`}>
              Best: {stats.scoring.bestScore}
            </Link>
          ) : (
            `${stats.roundsAllTime} all time`
          )}
        </div>
      </StatCard>
    </>
  );
}

export default function DashboardView() {
  const [params] = useSearchParams();
  const period = PERIODS.some((p) => p.value === params.get('period')) ? params.get('period') : 'last20';
  const info = periodInfo(period);
  const { theme } = usePreferences();
  const headingRef = usePageTitle('Dashboard');
  const { stats, loading, error, reload } = useStats(period);
  const recent = useRounds({ limit: 3, sort: '-playedAt' });

  return (
    <section className="view" aria-labelledby="dash-title">
      <div className="view-head">
        <div>
          <h1 id="dash-title" ref={headingRef} tabIndex={-1}>
            Your game at a glance
          </h1>
          <p className="muted">
            {info.title} · updated when a round syncs from the app
            {stats?.handicapEstimate !== null && stats?.handicapEstimate !== undefined && (
              <> · handicap estimate {stats.handicapEstimate.toFixed(1)}</>
            )}
          </p>
        </div>
        <Chips label="Period" items={PERIODS} active={period} linkFor={(p) => `/dashboard?period=${p}`} />
      </div>

      {/* StatCards */}
      <div className="grid grid-4 ajax">
        <ApiTag>GET /api/stats/:userId?period={period}</ApiTag>
        {error && !stats ? (
          <article className="card" style={{ gridColumn: '1 / -1' }}>
            <ErrorState title="Couldn't load your statistics." error={error} onRetry={reload} />
          </article>
        ) : !stats ? (
          [0, 1, 2, 3].map((i) => (
            <article className="card" key={i}>
              <Skeleton lines={3} label="Loading statistics" />
            </article>
          ))
        ) : stats.isEmpty ? (
          <article className="card" style={{ gridColumn: '1 / -1' }}>
            <EmptyState icon="rounds">
              {stats.roundsAllTime === 0 ? (
                <>
                  No rounds yet. Finish a round in the Budget Golfers app and sign in there to upload it, and your
                  statistics will appear here.
                </>
              ) : (
                <>
                  No rounds in this period. Choose <b>All time</b> to see your {stats.roundsAllTime} round
                  {stats.roundsAllTime === 1 ? '' : 's'}.
                </>
              )}
            </EmptyState>
          </article>
        ) : (
          <StatCards stats={stats} />
        )}
      </div>

      <div className="grid grid-2" style={{ marginTop: 18 }}>
        {/* ScoreTrendChart */}
        <article className="card ajax">
          <ApiTag>stats.trend[] (same request)</ApiTag>
          <div className="card-head">
            <h2>Score trend</h2>
            <div className="legend">
              <span>
                <i style={{ background: 'var(--bottle-green)' }} />
                Score
              </span>
              <span>
                <i style={{ background: 'var(--turquoise-green)' }} />
                5-round average
              </span>
            </div>
          </div>
          {!stats ? (
            loading ? <Skeleton lines={6} label="Loading score trend" /> : null
          ) : stats.trendChronological.length < 2 ? (
            <EmptyState icon="dashboard">Play at least two 18-hole rounds in this period to see a trend.</EmptyState>
          ) : (
            <ScoreTrendChart data={stats.trendChronological} theme={theme} />
          )}
        </article>

        {/* AccuracyCard */}
        <article className="card ajax">
          <ApiTag>stats.accuracy</ApiTag>
          <div className="card-head">
            <h2>Shot accuracy</h2>
          </div>
          {!stats ? (
            loading ? <Skeleton lines={4} label="Loading accuracy" /> : null
          ) : (
            <AccuracyDonut accuracy={stats.accuracy} />
          )}
        </article>
      </div>

      {/* RecentRounds */}
      <article className="card ajax" style={{ marginTop: 18 }}>
        <ApiTag>GET /api/rounds?limit=3&amp;sort=-playedAt</ApiTag>
        <div className="card-head">
          <h2>Recent rounds</h2>
          <Link className="btn btn-ghost btn-sm" to="/rounds">
            View all
          </Link>
        </div>
        {recent.error && !recent.rounds ? (
          <ErrorState title="Couldn't load your rounds." error={recent.error} onRetry={recent.reload} />
        ) : !recent.rounds ? (
          <Skeleton lines={3} label="Loading recent rounds" />
        ) : recent.rounds.length === 0 ? (
          <EmptyState icon="rounds">
            No rounds yet. Finish a round in the app and upload it, and it will appear here.
          </EmptyState>
        ) : (
          <RoundList rounds={recent.rounds} />
        )}
      </article>
    </section>
  );
}
