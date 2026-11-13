// VIEW: the community leaderboard table. The signed-in golfer's row gets the
// template's tr.me highlight. The column headings change the sort.
import { Link } from 'react-router-dom';
import { formatChange, formatNumber } from '../utils/format';

const COLUMNS = [
  { sort: 'avgScore', label: 'Avg score' },
  { sort: 'improved', label: 'Improvement' },
  { sort: 'rounds', label: 'Rounds' },
];

export function LeaderboardTable({ rows, myUserId, sort, sortLink }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Golfer</th>
            <th scope="col">Home course</th>
            {COLUMNS.map((c) => (
              <th key={c.sort} scope="col" className="num" aria-sort={sort === c.sort ? 'ascending' : undefined}>
                <Link to={sortLink(c.sort)}>{c.label}</Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const mine = r.userId === myUserId;
            return (
              <tr key={r.userId} className={mine ? 'me' : undefined} aria-current={mine ? 'true' : undefined}>
                <td className="rank">{r.rank}</td>
                <td>{mine ? `${r.displayName} (you)` : r.displayName}</td>
                <td>{r.homeCourse ?? <span className="muted">–</span>}</td>
                <td className="num">{formatNumber(r.averageScore)}</td>
                <td className="num">{formatChange(r.improvement)}</td>
                <td className="num">{r.roundsPlayed}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
