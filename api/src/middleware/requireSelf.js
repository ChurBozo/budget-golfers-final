// For routes with :userId (users, stats, clubs). A valid token for someone
// else's :userId gets 403 FORBIDDEN, as in A2 section 6.4.
const AppError = require('../utils/AppError');

function requireSelf(message) {
  return function checkSelf(req, res, next) {
    if (req.params.userId !== req.userId) {
      return next(AppError.forbidden(message));
    }
    return next();
  };
}

module.exports = requireSelf;
