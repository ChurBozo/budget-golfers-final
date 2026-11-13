// Gives every request a short id (req_7f3a2c). It is returned in error bodies
// and the X-Request-Id header, and written to the log, so a golfer's error
// report can be matched to the server log without exposing internals.
const crypto = require('crypto');

function requestId(req, res, next) {
  req.id = `req_${crypto.randomBytes(3).toString('hex')}`;
  res.set('X-Request-Id', req.id);
  next();
}

module.exports = requestId;
