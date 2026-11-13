// GET /api/stats/:userId: one request gives the dashboard's stat cards,
// trend chart and accuracy card everything they need.
const { User, Round } = require('../models');
const { buildStats } = require('./calc/stats');

async function getStats(userId, period, now = new Date()) {
  const [rounds, user] = await Promise.all([
    Round.find({ userId }).sort({ playedAt: -1 }).lean(),
    User.findById(userId, { 'statsSnapshot.handicapEstimate': 1 }).lean(),
  ]);
  const stats = buildStats({
    rounds,
    period,
    handicapEstimate: user?.statsSnapshot?.handicapEstimate ?? null,
    now,
  });
  return { userId: String(userId), ...stats };
}

module.exports = { getStats };
