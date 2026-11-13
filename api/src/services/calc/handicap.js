// Handicap estimate, following the World Handicap System method in a
// simplified form (R&A & USGA, 2024):
//   1. Each hole is capped at double bogey (par + 2) to give an adjusted score.
//   2. Score differential = (adjusted score - course rating) x 113 / slope.
//      Self-named courses usually have no rating, so the rating defaults to
//      the round's par and the slope to the standard 113.
//   3. The estimate uses the best differentials from the most recent 20
//      18-hole rounds (Rule 5.2 table). At least 3 rounds are needed.
// It is an estimate for the golfer's own interest, not an official handicap.
const { mean, round1 } = require('./math');

const STANDARD_SLOPE = 113;
const MAX_HANDICAP = 54;

// [rounds available] -> [how many lowest differentials to average, adjustment]
const TABLE = [
  [3, 1, -2.0],
  [4, 1, -1.0],
  [5, 1, 0],
  [6, 2, -1.0],
  [8, 2, 0],
  [11, 3, 0],
  [14, 4, 0],
  [16, 5, 0],
  [18, 6, 0],
  [19, 7, 0],
  [20, 8, 0],
];

function adjustedScore(holes) {
  return holes.reduce((s, h) => s + Math.min(h.strokes, h.par + 2), 0);
}

function scoreDifferential(round, rating) {
  const courseRating = rating?.courseRating ?? round.course?.par ?? round.holes.reduce((s, h) => s + h.par, 0);
  const slope = rating?.slopeRating ?? STANDARD_SLOPE;
  return ((adjustedScore(round.holes) - courseRating) * STANDARD_SLOPE) / slope;
}

// differentials: newest first. Only the first 20 are used.
function handicapFromDifferentials(differentials) {
  const recent = differentials.slice(0, 20);
  if (recent.length < 3) return null;
  const [, count, adjustment] = TABLE.find(([n]) => recent.length <= n);
  const best = [...recent].sort((a, b) => a - b).slice(0, count);
  const estimate = mean(best) + adjustment;
  return round1(Math.min(estimate, MAX_HANDICAP));
}

// rounds: newest first. ratingFor(round) may return { courseRating, slopeRating }.
function handicapEstimate(rounds, ratingFor = () => null) {
  const full = rounds.filter((r) => r.holesPlayed === 18);
  return handicapFromDifferentials(full.map((r) => scoreDifferential(r, ratingFor(r))));
}

module.exports = { adjustedScore, scoreDifferential, handicapFromDifferentials, handicapEstimate };
