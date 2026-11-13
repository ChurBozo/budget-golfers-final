// VIEW: the hole-by-hole scorecard (template .scorecard) with birdie circles,
// bogey squares, the distance row in the golfer's units, and the shot list.
import { clubLabel, clubShort, resultLabel } from '../utils/clubs';
import { scoreClass, unitLabel } from '../utils/format';

export function ScoreMark({ strokes, par }) {
  return (
    <span className={`sc ${scoreClass(strokes, par)}`} aria-label={`${strokes} on a par ${par}`}>
      {strokes}
    </span>
  );
}

function NineTable({ nine, units, grandTotal }) {
  const { holes, totals, label } = nine;
  return (
    <div className="table-wrap">
      <table className="scorecard">
        <thead>
          <tr>
            <th scope="col">Hole</th>
            {holes.map((h) => (
              <th key={h.number} scope="col">
                {h.number}
              </th>
            ))}
            <th scope="col">{label}</th>
            {grandTotal && <th scope="col">Total</th>}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Par</td>
            {holes.map((h) => (
              <td key={h.number}>{h.par}</td>
            ))}
            <td>
              <b>{totals.par}</b>
            </td>
            {grandTotal && (
              <td>
                <b>{grandTotal.par}</b>
              </td>
            )}
          </tr>
          <tr>
            <td>Distance ({unitLabel(units)})</td>
            {holes.map((h) => (
              <td key={h.number}>{h.distance ?? '–'}</td>
            ))}
            <td>
              <b>{totals.distance ?? '–'}</b>
            </td>
            {grandTotal && (
              <td>
                <b>{grandTotal.distance ?? '–'}</b>
              </td>
            )}
          </tr>
          <tr>
            <td>Score</td>
            {holes.map((h) => (
              <td key={h.number}>
                <ScoreMark strokes={h.strokes} par={h.par} />
              </td>
            ))}
            <td>
              <b>{totals.strokes}</b>
            </td>
            {grandTotal && (
              <td>
                <b>{grandTotal.strokes}</b>
              </td>
            )}
          </tr>
          <tr>
            <td>Putts</td>
            {holes.map((h) => (
              <td key={h.number}>{h.putts}</td>
            ))}
            <td>
              <b>{totals.putts}</b>
            </td>
            {grandTotal && (
              <td>
                <b>{grandTotal.putts}</b>
              </td>
            )}
          </tr>
          <tr>
            <td>Club off tee</td>
            {holes.map((h) => (
              <td key={h.number} title={h.teeClub ? clubLabel(h.teeClub) : undefined}>
                {clubShort(h.teeClub)}
              </td>
            ))}
            <td />
            {grandTotal && <td />}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function Scorecard({ nines, units }) {
  const grandTotal =
    nines.length === 2
      ? {
          par: nines[0].totals.par + nines[1].totals.par,
          strokes: nines[0].totals.strokes + nines[1].totals.strokes,
          putts: nines[0].totals.putts + nines[1].totals.putts,
          distance:
            nines[0].totals.distance === null || nines[1].totals.distance === null
              ? null
              : nines[0].totals.distance + nines[1].totals.distance,
        }
      : null;
  return (
    <div className="stack" style={{ gap: 12 }}>
      {nines.map((nine, i) => (
        <NineTable key={nine.label} nine={nine} units={units} grandTotal={i === nines.length - 1 ? grandTotal : null} />
      ))}
    </div>
  );
}

export function ScoreKey() {
  return (
    <div className="key">
      <span className="sc birdie">3</span>Birdie
      <span className="sc par">4</span>Par
      <span className="sc bogey">5</span>Bogey
      <span className="sc double">6</span>Double bogey or worse
    </div>
  );
}

/** Shots for each hole, expandable (Wireframe 4, marker 4). */
export function ShotList({ holes, units }) {
  const withShots = holes.filter((h) => h.shots.length > 0);
  return (
    <div className="shot-list">
      {withShots.map((h) => (
        <details key={h.number}>
          <summary>
            <b>Hole {h.number}</b>
            <span className="muted">
              Par {h.par} · {h.shots.length} shot{h.shots.length === 1 ? '' : 's'} · {h.putts} putt{h.putts === 1 ? '' : 's'}
              {h.penalties > 0 && ` · ${h.penalties} penalty`}
            </span>
            <ScoreMark strokes={h.strokes} par={h.par} />
          </summary>
          <ol>
            {h.shots.map((s) => (
              <li key={s.seq}>
                <b>{clubLabel(s.club)}</b>
                <span>{s.distance !== null && s.distance !== undefined ? `${s.distance} ${unitLabel(units)}` : 'not measured'}</span>
                <span className="muted">{resultLabel(s.result)}</span>
              </li>
            ))}
          </ol>
        </details>
      ))}
    </div>
  );
}
