// JSON shape for a leaderboard row (A2 section 6.3.6). Only the display name,
// home course and averages are shared: never an email or a round (NFR9).
function row(r) {
  return {
    rank: r.rank,
    userId: r.userId,
    displayName: r.displayName,
    homeCourse: r.homeCourse ?? null,
    averageScore: r.averageScore,
    improvement: r.improvement,
    roundsPlayed: r.roundsPlayed,
  };
}

function currentUser(r) {
  if (!r) return null;
  return {
    rank: r.rank ?? null,
    averageScore: r.averageScore,
    improvement: r.improvement,
    roundsPlayed: r.roundsPlayed,
    onLeaderboard: r.rank !== null && r.rank !== undefined,
  };
}

module.exports = { row, currentUser };
