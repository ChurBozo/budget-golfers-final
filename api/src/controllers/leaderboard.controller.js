const leaderboardService = require('../services/leaderboard.service');
const { MINIMUM_ROUNDS } = require('../services/calc/leaderboard');
const { send } = require('../views/envelope');
const view = require('../views/leaderboard.view');

async function list(req, res) {
  const q = req.valid.query;
  const result = await leaderboardService.leaderboard({ ...q, userId: req.userId });
  send(res, result.rows.map(view.row), {
    meta: {
      sort: q.sort,
      period: q.period,
      minimumRounds: MINIMUM_ROUNDS,
      page: q.page,
      limit: q.limit,
      total: result.total,
      currentUser: view.currentUser(result.currentUser),
      generatedAt: result.generatedAt,
    },
  });
}

module.exports = { list };
