// Checks the "Authorization: Bearer <token>" header. On success the caller's
// id is on req.userId; every query then uses that id, never one from the body.
const AppError = require('../utils/AppError');
const authService = require('../services/auth.service');

function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(AppError.unauthenticated('Sign in to use this part of Budget Golfers.'));
  }
  try {
    req.userId = authService.verifyToken(token);
    return next();
  } catch {
    return next(AppError.unauthenticated('Your session has expired. Please sign in again.'));
  }
}

module.exports = requireAuth;
