// VIEW: chips, the round filter bar and pagination. The view passes values
// in and gets events back; the values themselves live in the URL.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiTag, Icon } from './Common';

/** Template .chips: each chip is a Link that changes one query parameter. */
export function Chips({ label, items, active, linkFor }) {
  return (
    <nav className="chips" aria-label={label}>
      {items.map((item) => (
        <Link
          key={item.value}
          className={item.value === active ? 'chip active' : 'chip'}
          to={linkFor(item.value)}
          aria-current={item.value === active ? 'true' : undefined}
          replace
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** FilterBar from the template. Changes apply when the golfer presses Apply. */
export function FilterBar({ courses, values, onApply, onReset }) {
  const [draft, setDraft] = useState(values);
  useEffect(() => setDraft(values), [values.courseId, values.from, values.to, values.holes]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }));
  const submit = (e) => {
    e.preventDefault();
    onApply(draft);
  };
  const filtered = values.courseId || values.from || values.to || values.holes;

  return (
    <form className="card filter-bar" onSubmit={submit} aria-label="Filter rounds">
      <div className="field ajax">
        <ApiTag>GET /api/courses</ApiTag>
        <label htmlFor="course">Course</label>
        <select id="course" value={draft.courseId || ''} onChange={set('courseId')}>
          <option value="">All courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="from">From</label>
        <input id="from" type="date" value={draft.from || ''} max={draft.to || undefined} onChange={set('from')} />
      </div>
      <div className="field">
        <label htmlFor="to">To</label>
        <input id="to" type="date" value={draft.to || ''} min={draft.from || undefined} onChange={set('to')} />
      </div>
      <div className="field">
        <label htmlFor="holes">Holes</label>
        <select id="holes" value={draft.holes || ''} onChange={set('holes')}>
          <option value="">9 or 18</option>
          <option value="18">18 only</option>
          <option value="9">9 only</option>
        </select>
      </div>
      <div className="filter-actions">
        <button className="btn" type="submit">
          <Icon name="filter" />
          Apply
        </button>
        {filtered && (
          <button className="btn btn-ghost" type="button" onClick={onReset}>
            Clear
          </button>
        )}
      </div>
    </form>
  );
}

export function Pagination({ page, totalPages, total, shown, onPage, noun = 'rounds' }) {
  const first = total === 0 ? 0 : (page - 1) * shown.limit + 1;
  const last = Math.min(total, first + shown.count - 1);
  return (
    <div className="pagination">
      <span className="muted">
        Showing {first}–{last} of {total} {noun}
      </span>
      <span className="pager">
        <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>{' '}
        <button type="button" className="btn btn-sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </span>
    </div>
  );
}
