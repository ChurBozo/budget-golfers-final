// Shared zod pieces for the request validators.
const { z } = require('zod');
const { CODE_PATTERN } = require('../utils/clubCodes');

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'must be a valid id');

const page = z.coerce.number().int('must be a whole number').min(1, 'must be 1 or more').default(1);

function limit(max, fallback) {
  return z.coerce
    .number()
    .int('must be a whole number')
    .min(1, 'must be 1 or more')
    .max(max, `must be ${max} or fewer`)
    .default(fallback);
}

const clubCode = z.string().trim().toLowerCase().regex(CODE_PATTERN, 'must be a club code such as "7i" or "driver"');

const email = z
  .string({ required_error: 'is required' })
  .trim()
  .toLowerCase()
  .max(254, 'must be 254 characters or fewer')
  .email('must be a valid email address');

const displayName = z
  .string({ required_error: 'is required' })
  .trim()
  .min(2, 'must be 2 to 30 characters')
  .max(30, 'must be 2 to 30 characters');

const courseName = z.string().trim().min(2, 'must be 2 to 80 characters').max(80, 'must be 2 to 80 characters');

// A date (2026-09-01) or a full ISO time. Used for the from / to filters.
const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, 'must be a date like 2026-09-01')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'must be a real date');

const userIdParams = z.object({ userId: objectId });

// An array with a length limit that is checked BEFORE any element.
// zod 3 checks every element of an array even when the array is already too
// long, and keeps every problem it finds (advisory GHSA-mrhx-c7xc-m3w5). In a
// test, a 1 MB body of 330,000 empty holes made 1.3 million problems and used
// about 350 MB of memory. Here the length is checked first and an array that
// is too long is rejected straight away (a fatal issue), so its elements are
// never checked. Anything that is not an array goes on to arraySchema, which
// gives its own "is required" or type message.
function boundedArray(arraySchema, max, message) {
  return z
    .unknown()
    .superRefine((value, ctx) => {
      if (Array.isArray(value) && value.length > max) {
        ctx.addIssue({ code: 'too_big', type: 'array', maximum: max, inclusive: true, message, fatal: true });
      }
    })
    .pipe(arraySchema);
}

module.exports = { z, objectId, page, limit, clubCode, email, displayName, courseName, dateParam, userIdParams, boundedArray };
