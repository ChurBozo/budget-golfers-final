// 429 RATE_LIMITED when one address sends too many requests (A2 section 6.5).
// Sign-in and register are limited hardest, to slow password guessing.
const rateLimit = require('express-rate-limit');
const env = require('../config/env');

function limiter({ windowMs, limit, message }) {
  if (!env.rateLimitEnabled) return (req, res, next) => next();
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler(req, res) {
      res.status(429).json({
        success: false,
        error: { status: 429, code: 'RATE_LIMITED', message, requestId: req.id },
      });
    },
  });
}

const authLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: 'Too many sign-in attempts. Please wait 15 minutes and try again.',
});

const apiLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  message: 'Too many requests. Please slow down and try again shortly.',
});

module.exports = { authLimiter, apiLimiter };
