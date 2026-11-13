// VIEW: rounds as the template's .round-list rows. Each row links to
// /rounds/:roundId with React Router's Link (no page reload).
import { Link } from 'react-router-dom';
import { dateTile, formatToPar } from '../utils/format';

export function RoundRow({ round, detail = 'tees' }) {
  const { day, month } = dateTile(round.playedAt);
  const t = round.totals;
  const sub =
    detail === 'stats'
      ? `${round.holesPlayed} holes · ${t.putts} putts · ${t.fairwaysHit} of ${t.fairwaysPossible} fairways`
      : [`${round.holesPlayed} holes`, round.tee && `${round.tee} tees`].filter(Boolean).join(' · ');
  return (
    <li className="round-item">
      <Link to={`/rounds/${round.id}`} aria-label={`${round.course.name}, ${day} ${month}, score ${t.strokes}`}>
        <div className="date-tile">
          <b>{day}</b>
          <small>{month}</small>
        </div>
        <div>
          <b>{round.course.name}</b>
          <br />
          <span className="muted">{sub}</span>
        </div>
        <span className="badge hide-sm">{round.isPersonalBest ? 'Personal best' : formatToPar(t.toPar)}</span>
        <span className="score-big">{t.strokes}</span>
      </Link>
    </li>
  );
}

export function RoundList({ rounds, detail }) {
  return (
    <ul className="round-list">
      {rounds.map((r) => (
        <RoundRow key={r.id} round={r} detail={detail} />
      ))}
    </ul>
  );
}
