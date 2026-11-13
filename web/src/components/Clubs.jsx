// VIEW: club distances as the template's bars, and the club detail table.
import { unitLabel } from '../utils/format';
import { clubCompact, clubLabel } from '../utils/clubs';

export function ClubBars({ clubs, units }) {
  return (
    <div className="bars" role="list" aria-label="Average distance per club">
      {clubs.map((c) => (
        <div className="bar-row" key={c.code} role="listitem">
          <b title={c.label}>{clubCompact(c.code) || c.label}</b>
          <div className="bar" aria-hidden="true">
            <i style={{ width: `${c.widthPct}%` }} />
          </div>
          <span>
            {c.average} {unitLabel(units)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Club detail (template): shots, longest and spread for each measured club. */
export function ClubTable({ clubs, units }) {
  const u = unitLabel(units);
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Club</th>
            <th scope="col" className="num">
              Shots
            </th>
            <th scope="col" className="num">
              Longest
            </th>
            <th scope="col" className="num">
              Spread
            </th>
          </tr>
        </thead>
        <tbody>
          {clubs.map((c) => (
            <tr key={c.code}>
              <td title={clubLabel(c.code)}>
                {clubCompact(c.code) || c.label}
                {!c.inBag && <span className="muted"> (out of bag)</span>}
              </td>
              <td className="num">{c.shotCount}</td>
              <td className="num">{c.longest !== null ? `${c.longest} ${u}` : '–'}</td>
              <td className="num">{c.spread !== null ? `±${c.spread} ${u}` : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
