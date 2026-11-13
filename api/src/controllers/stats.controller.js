const statsService = require('../services/stats.service');
const { send } = require('../views/envelope');

async function getStats(req, res) {
  send(res, await statsService.getStats(req.userId, req.valid.query.period));
}

module.exports = { getStats };
