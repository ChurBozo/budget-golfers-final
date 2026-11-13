// One error handler turns every error into the same JSON structure
// (A2 section 6.4): { success:false, error:{ status, code, message, details?, requestId } }.
// Unexpected errors return a generic 500 message; the details only go to the log.
const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const { formatPath } = require('./validate');

function fromMongoose(err) {
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({
      field: formatPath(String(e.path).split('.').map((p) => (/^\d+$/.test(p) ? Number(p) : p))),
      issue: e.message,
    }));
    return AppError.validation(details);
  }
  if (err instanceof mongoose.Error.CastError) {
    return AppError.notFound();
  }
  return null;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let appErr = err instanceof AppError ? err : fromMongoose(err);

  // Malformed JSON body (express.json) or a body over the size limit.
  if (!appErr && err.type === 'entity.parse.failed') {
    appErr = AppError.badRequest('The request body is not valid JSON.');
  }
  if (!appErr && err.type === 'entity.too.large') {
    appErr = new AppError(413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.');
  }
  if (!appErr) {
    console.error(`[${req.id}] ${req.method} ${req.originalUrl}`, err);
    appErr = new AppError(500, 'SERVER_ERROR', 'Something went wrong on our side. Please try again.');
  }

  const body = {
    success: false,
    error: {
      status: appErr.status,
      code: appErr.code,
      message: appErr.message,
      ...(appErr.details ? { details: appErr.details } : {}),
      requestId: req.id,
    },
  };
  res.status(appErr.status).json(body);
}

module.exports = errorHandler;
