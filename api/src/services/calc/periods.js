// Turns a period name into the rounds it covers.
//   Stats:       last5 | last20 (most recent rounds), year (this calendar year), all
//   Leaderboard: season (this calendar year), month (last 30 days), all

function startOfYear(now) {
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
}

// rounds: newest first. Returns { current, previous } arrays.
function statsWindow(rounds, period, now = new Date()) {
  switch (period) {
    case 'last5':
      return { current: rounds.slice(0, 5), previous: rounds.slice(5, 10) };
    case 'last20':
      return { current: rounds.slice(0, 20), previous: rounds.slice(20, 40) };
    case 'year': {
      const start = startOfYear(now);
      const prevStart = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
      return {
        current: rounds.filter((r) => r.playedAt >= start),
        previous: rounds.filter((r) => r.playedAt >= prevStart && r.playedAt < start),
      };
    }
    case 'all':
    default:
      return { current: rounds, previous: [] };
  }
}

// The earliest playedAt a leaderboard period includes (null = no limit).
function leaderboardStart(period, now = new Date()) {
  if (period === 'season') return startOfYear(now);
  if (period === 'month') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return null;
}

module.exports = { statsWindow, leaderboardStart, startOfYear };
