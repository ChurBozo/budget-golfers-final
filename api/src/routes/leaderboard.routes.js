// /api/leaderboard: community ranking of golfers who opted in.
const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const validate = require('../middleware/validate');
const { leaderboard } = require('../validators/other.schemas');
const controller = require('../controllers/leaderboard.controller');

const router = express.Router();

router.get('/', requireAuth, validate({ query: leaderboard.query }), controller.list);

module.exports = router;
