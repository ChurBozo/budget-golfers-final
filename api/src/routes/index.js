// The API router. Each resource has its own router file, mounted here under
// /api (A2 Table 7). Routers only map a method and path to middleware and a
// controller; they hold no logic.
const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Budget Golfers API',
      resources: {
        auth: '/api/auth',
        users: '/api/users',
        rounds: '/api/rounds',
        courses: '/api/courses',
        stats: '/api/stats/:userId',
        clubs: '/api/clubs/:userId',
        leaderboard: '/api/leaderboard',
      },
    },
  });
});

router.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', time: new Date().toISOString() } });
});

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./users.routes'));
router.use('/rounds', require('./rounds.routes'));
router.use('/courses', require('./courses.routes'));
router.use('/stats', require('./stats.routes'));
router.use('/clubs', require('./clubs.routes'));
router.use('/leaderboard', require('./leaderboard.routes'));

module.exports = router;
