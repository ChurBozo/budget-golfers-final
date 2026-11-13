// Validators for courses, stats, clubs and the leaderboard.
const { z, objectId, page, limit, clubCode, userIdParams, boundedArray } = require('./common');
const { MAX_IN_BAG, isStandard } = require('../utils/clubCodes');

const courses = {
  list: z.object({
    search: z.string().trim().max(60, 'must be 60 characters or fewer').optional(),
    region: z.string().trim().max(60, 'must be 60 characters or fewer').optional(),
    page,
    limit: limit(100, 50),
  }),
  params: z.object({ courseId: objectId }),
};

const stats = {
  params: userIdParams,
  query: z.object({
    period: z.enum(['last5', 'last20', 'year', 'all']).default('last20'),
  }),
};

const clubs = {
  params: userIdParams,
  put: z
    .object({
      clubs: boundedArray(
        z
          .array(
            z.object({
              code: clubCode,
              label: z.string().trim().min(1).max(30, 'must be 30 characters or fewer').optional(),
              inBag: z.boolean().default(true),
            }),
            { required_error: 'is required' },
          )
          .min(1, 'must list at least one club'),
        40,
        'can list at most 40 clubs',
      ),
    })
    .superRefine((b, ctx) => {
      const seen = new Set();
      b.clubs.forEach((c, i) => {
        if (seen.has(c.code)) ctx.addIssue({ code: 'custom', path: ['clubs', i, 'code'], message: 'club codes cannot repeat' });
        seen.add(c.code);
        if (!isStandard(c.code) && !c.label) {
          ctx.addIssue({ code: 'custom', path: ['clubs', i, 'label'], message: 'is required for a custom club' });
        }
      });
      const inBag = b.clubs.filter((c) => c.inBag).length;
      if (inBag > MAX_IN_BAG) {
        ctx.addIssue({ code: 'custom', path: ['clubs'], message: `can have at most ${MAX_IN_BAG} clubs in the bag (found ${inBag})` });
      }
    }),
};

const leaderboard = {
  query: z.object({
    sort: z.enum(['avgScore', 'improved', 'rounds']).default('avgScore'),
    period: z.enum(['season', 'month', 'all']).default('season'),
    page,
    limit: limit(100, 25),
  }),
};

module.exports = { courses, stats, clubs, leaderboard };
