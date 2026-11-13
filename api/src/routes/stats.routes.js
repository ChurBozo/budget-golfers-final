// /api/stats/:userId: calculated statistics, owner only.
const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireSelf = require('../middleware/requireSelf');
const validate = require('../middleware/validate');
const { stats } = require('../validators/other.schemas');
const controller = require('../controllers/stats.controller');

const router = express.Router();

router.get(
  '/:userId',
  requireAuth,
  requireSelf('You can only view your own statistics.'),
  validate({ params: stats.params, query: stats.query }),
  controller.getStats,
);

module.exports = router;
