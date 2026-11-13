// Runs a zod schema over the body, query or params before the controller.
// - body problems   -> 422 VALIDATION_FAILED (valid JSON that breaks a rule)
// - query / params  -> 400 BAD_REQUEST (for example limit=500)
// Unknown fields are removed, so a client cannot set role or totals itself.
// Express 5 makes req.query read-only, so the cleaned values go on req.valid.
const AppError = require('../utils/AppError');

// At most 50 field errors go back, so a very wrong body cannot make a huge reply.
const MAX_DETAILS = 50;

function toDetails(issues) {
  return issues.slice(0, MAX_DETAILS).map((issue) => ({
    field: formatPath(issue.path),
    issue: issue.message,
  }));
}

function formatPath(path) {
  if (!path.length) return '(body)';
  return path.reduce((out, part) => (typeof part === 'number' ? `${out}[${part}]` : out ? `${out}.${part}` : String(part)), '');
}

function validate(schemas) {
  return function runValidation(req, res, next) {
    req.valid = req.valid || {};
    for (const where of ['params', 'query', 'body']) {
      const schema = schemas[where];
      if (!schema) continue;
      const input = where === 'body' ? req.body ?? {} : req[where];
      const result = schema.safeParse(input);
      if (!result.success) {
        const details = toDetails(result.error.issues);
        return next(
          where === 'body'
            ? AppError.validation(details)
            : AppError.badRequest(`Some ${where === 'query' ? 'query parameters' : 'path values'} are not valid.`, details),
        );
      }
      req.valid[where] = result.data;
    }
    return next();
  };
}

module.exports = validate;
module.exports.formatPath = formatPath;
