// Leaderboard ranking (A2: GET /api/leaderboard). The database groups each
// golfer's 18-hole rounds in the period; this module turns those groups into
// ranked rows. Kept free of Express and Mongoose so it can be unit tested.
const { mean, round1 } = require('./math');

const MINIMUM_ROUNDS = 3;

// scores: one golfer's 18-hole scores, oldest first.
// improvement = average of the newer half minus the older half, so a
// negative number means the golfer is scoring lower (better) than before.
function summarise(scores) {
  const older = scores.slice(0, Math.floor(scores.length / 2));
  const newer = scores.slice(Math.floor(scores.length / 2));
  return {
    averageScore: round1(mean(scores)),
    improvement: older.length ? round1(mean(newer) - mean(older)) : null,
    roundsPlayed: scores.length,
  };
}

const SORTS = {
  // Lowest average first; more rounds breaks a tie.
  avgScore: (a, b) => a.averageScore - b.averageScore || b.roundsPlayed - a.roundsPlayed,
  // Biggest drop in score first.
  improved: (a, b) => (a.improvement ?? 0) - (b.improvement ?? 0) || a.averageScore - b.averageScore,
  // Most rounds first.
  rounds: (a, b) => b.roundsPlayed - a.roundsPlayed || a.averageScore - b.averageScore,
};

const KEY = {
  avgScore: (r) => r.averageScore,
  improved: (r) => r.improvement ?? 0,
  rounds: (r) => r.roundsPlayed,
};

// Golfers with the same value share a rank (1, 2, 2, 4).
function rank(rows, sort = 'avgScore') {
  const compare = SORTS[sort];
  const key = KEY[sort];
  const sorted = [...rows].sort((a, b) => compare(a, b) || a.displayName.localeCompare(b.displayName));
  let previous;
  return sorted.map((row, i) => {
    const value = key(row);
    const r = i > 0 && value === key(sorted[i - 1]) ? previous : i + 1;
    previous = r;
    return { rank: r, ...row };
  });
}

// The course a golfer plays most often, for golfers with no home course set.
function mostPlayed(names) {
  const counts = new Map();
  for (const n of names) counts.set(n, (counts.get(n) || 0) + 1);
  let best = null;
  let most = 0;
  for (const [name, count] of counts) {
    if (count > most) {
      best = name;
      most = count;
    }
  }
  return best;
}

module.exports = { MINIMUM_ROUNDS, summarise, rank, mostPlayed, SORTS: Object.keys(SORTS) };
