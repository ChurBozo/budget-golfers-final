// An error that knows its HTTP status and API error code (A2 Table 8).
// Services and controllers throw these; middleware/errorHandler.js turns
// them into the standard JSON error body.
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    if (details) this.details = details;
  }

  static badRequest(message = 'The request is not valid.', details) {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }

  static unauthenticated(message = 'Please sign in to continue.') {
    return new AppError(401, 'UNAUTHENTICATED', message);
  }

  static forbidden(message = 'You do not have access to this resource.') {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'The resource was not found.') {
    return new AppError(404, 'NOT_FOUND', message);
  }

  static emailTaken() {
    return new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
  }

  static validation(details, message = 'Some fields are not valid.') {
    return new AppError(422, 'VALIDATION_FAILED', message, details);
  }
}

module.exports = AppError;
