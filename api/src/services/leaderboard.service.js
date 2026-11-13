// GET /api/leaderboard. A MongoDB aggregation groups each golfer's 18-hole
// rounds in the period and joins their name and home course; calc/leaderboard.js
// then ranks them. Only golfers who opted in and have at least 3 rounds appear.
const { Round } = require('../models');
const { leaderboardStart } = require('./calc/periods');
const { MINIMUM_ROUNDS, summarise, rank } = require('./calc/leaderboard');

async function groupRounds(start) {
  const match = { holesPlayed: 18 };
  if (start) match.playedAt = { $gte: start };
  return Round.aggregate([
    { $match: match },
    { $sort: { playedAt: 1 } },
    {
      $group: {
        _id: '$userId',
        scores: { $push: '$totals.strokes' },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
        pipeline: [{ $project: { displayName: 1, homeCourseId: 1, 'preferences.showOnLeaderboard': 1 } }],
      },
    },
    { $unwind: '$user' },
    {
      $lookup: {
        from: 'courses',
        localField: 'user.homeCourseId',
        foreignField: '_id',
        as: 'home',
        pipeline: [{ $project: { name: 1 } }],
      },
    },
  ]);
}

async function leaderboard({ sort, period, page, limit, userId, now = new Date() }) {
  const groups = await groupRounds(leaderboardStart(period, now));

  const rows = groups.map((g) => ({
    userId: String(g._id),
    displayName: g.user.displayName,
    // Only the home course the golfer chose is shared (NFR9 privacy).
    homeCourse: g.home[0]?.name ?? null,
    optedIn: g.user.preferences?.showOnLeaderboard !== false,
    ...summarise(g.scores),
  }));

  const eligible = rows.filter((r) => r.optedIn && r.roundsPlayed >= MINIMUM_ROUNDS);
  const ranked = rank(eligible, sort);
  const start = (page - 1) * limit;

  const mine = ranked.find((r) => r.userId === String(userId)) || rows.find((r) => r.userId === String(userId));

  return {
    rows: ranked.slice(start, start + limit),
    total: ranked.length,
    currentUser: mine ? { ...mine, rank: mine.rank ?? null } : null,
    generatedAt: now.toISOString(),
  };
}

module.exports = { leaderboard };
