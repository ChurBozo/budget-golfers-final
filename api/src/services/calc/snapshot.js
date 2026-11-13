// users.statsSnapshot: a small summary stored on the user after every round
// change, so the user chip and the leaderboard index never re-add every round.
const { mean, round1 } = require('./math');
const { handicapEstimate } = require('./handicap');

// rounds: newest first.
function buildSnapshot(rounds, ratingFor) {
  const full = rounds.filter((r) => r.holesPlayed === 18);
  const scores = full.map((r) => r.totals.strokes);
  return {
    roundsPlayed: rounds.length,
    averageScoreLast20: round1(mean(scores.slice(0, 20))),
    averageScorePrev20: round1(mean(scores.slice(20, 40))),
    bestScore: scores.length ? Math.min(...scores) : null,
    handicapEstimate: handicapEstimate(rounds, ratingFor),
    lastRoundAt: rounds.length ? rounds[0].playedAt : null,
  };
}

module.exports = { buildSnapshot };
