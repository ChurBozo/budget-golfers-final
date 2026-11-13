// VIEW (route): /rounds?from=&to=&courseId=&holes=&page= (Wireframe 3).
// Filters and the page number live in the URL, so Back and Forward step
// through them and a filtered list can be bookmarked (A2 section 5.4).
import { useMemo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useRounds } from '../hooks/useRounds';
import { useCourses } from '../hooks/useCourses';
import { usePageTitle } from '../hooks/usePageTitle';
import { ApiTag, EmptyState, ErrorState, Icon, Notice, Skeleton } from '../components/Common';
import { RoundList } from '../components/RoundList';
import { FilterBar, Pagination } from '../components/Controls';

const LIMIT = 10;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function RoundsView() {
  const [params, setParams] = useSearchParams();
  const headingRef = usePageTitle('Rounds');
  const location = useLocation();
  const deleted = location.state?.deleted;
  const { courses } = useCourses();

  const filters = useMemo(() => {
    const holes = params.get('holes');
    const page = Number.parseInt(params.get('page') || '1', 10);
    return {
      from: DATE.test(params.get('from') || '') ? params.get('from') : '',
      to: DATE.test(params.get('to') || '') ? params.get('to') : '',
      courseId: /^[a-f0-9]{24}$/i.test(params.get('courseId') || '') ? params.get('courseId') : '',
      holes: holes === '9' || holes === '18' ? holes : '',
      page: Number.isFinite(page) && page > 0 ? page : 1,
    };
  }, [params]);

  const { rounds, meta, error, reload } = useRounds({ ...filters, limit: LIMIT, sort: '-playedAt' });

  const update = (next) => {
    const merged = { ...filters, ...next };
    const out = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v && !(k === 'page' && Number(v) === 1)) out.set(k, String(v));
    }
    setParams(out);
  };

  const filtered = filters.from || filters.to || filters.courseId || filters.holes;
  const total = meta?.total;

  return (
    <section className="view" aria-labelledby="rounds-title">
      <div className="view-head">
        <div>
          <h1 id="rounds-title" ref={headingRef} tabIndex={-1}>
            Round history
          </h1>
          <p className="muted">
            {total === undefined ? 'Loading…' : `${total} round${total === 1 ? '' : 's'}`} · filter by date or course
          </p>
        </div>
        <Link className="btn btn-ghost" to="/settings#export">
          <Icon name="download" />
          Export
        </Link>
      </div>

      {deleted && (
        <div style={{ marginBottom: 18 }}>
          <Notice>Deleted {deleted}. Your statistics have been updated.</Notice>
        </div>
      )}

      <FilterBar
        courses={courses}
        values={filters}
        onApply={(draft) => update({ ...draft, page: 1 })}
        onReset={() => setParams(new URLSearchParams())}
      />

      {/* RoundList */}
      <div className="card ajax" style={{ marginTop: 18 }}>
        <ApiTag>GET /api/rounds?from=&amp;to=&amp;courseId=&amp;holes=&amp;page={filters.page}&amp;limit={LIMIT}</ApiTag>
        {error && !rounds ? (
          <ErrorState title="Couldn't load your rounds." error={error} onRetry={reload} />
        ) : !rounds ? (
          <Skeleton lines={6} label="Loading rounds" />
        ) : rounds.length === 0 ? (
          <EmptyState icon="rounds">
            {filtered
              ? 'No rounds match these filters. Try a wider date range or another course.'
              : 'No rounds yet. Finish a round in the Budget Golfers app and upload it, and it will appear here.'}
          </EmptyState>
        ) : (
          <>
            <RoundList rounds={rounds} detail="stats" />
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              shown={{ limit: meta.limit, count: rounds.length }}
              onPage={(page) => update({ page })}
            />
          </>
        )}
      </div>
    </section>
  );
}
