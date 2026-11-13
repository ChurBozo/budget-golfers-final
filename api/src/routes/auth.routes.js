// /api/auth: public routes, rate limited (A2 section 6.5).
const express = require('express');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimits');
const schemas = require('../validators/auth.schemas');
const controller = require('../controllers/auth.controller');

const router = express.Router();

router.post('/register', authLimiter, validate({ body: schemas.register }), controller.register);
router.post('/login', authLimiter, validate({ body: schemas.login }), controller.login);

module.exports = router;
