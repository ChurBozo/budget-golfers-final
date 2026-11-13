// Round rules from A2 Table 10:
//   holesPlayed is 9 or 18 and equals holes.length; hole number 1-18 with no
//   repeats; par 3-6; strokes 1-20; putts 0 to strokes; playedAt not in the
//   future; totals are never accepted from the client.
// "Shot club must be in the bag" needs the database, so rounds.service checks it.
const { z, objectId, page, limit, clubCode, courseName, dateParam, boundedArray } = require('./common');

const SHOT_RESULTS = ['fairway', 'rough-left', 'rough-right', 'bunker', 'green', 'penalty'];

const latLng = z.object({
  lat: z.number().min(-90, 'must be between -90 and 90').max(90, 'must be between -90 and 90'),
  lng: z.number().min(-180, 'must be between -180 and 180').max(180, 'must be between -180 and 180'),
});

const shot = z.object({
  seq: z.number().int().min(1, 'must be between 1 and 30').max(30, 'must be between 1 and 30'),
  club: clubCode.nullish(),
  start: latLng.nullish(),
  end: latLng.nullish(),
  distanceMetres: z.number().min(0, 'must be between 0 and 700').max(700, 'must be between 0 and 700').nullish(),
  result: z.enum(SHOT_RESULTS).nullish(),
});

const strokes = z.number().int('must be a whole number').min(1, 'must be between 1 and 20').max(20, 'must be between 1 and 20');
const putts = z.number().int('must be a whole number').min(0, 'must be between 0 and strokes').max(20, 'must be between 0 and strokes');
const penalties = z.number().int('must be a whole number').min(0, 'must be between 0 and 10').max(10, 'must be between 0 and 10');
const par = z.number().int('must be a whole number').min(3, 'must be between 3 and 6').max(6, 'must be between 3 and 6');
const holeNumber = z.number().int('must be a whole number').min(1, 'must be between 1 and 18').max(18, 'must be between 1 and 18');

const hole = z
  .object({
    number: holeNumber,
    par,
    distanceMetres: z.number().min(0, 'must be between 0 and 1000').max(1000, 'must be between 0 and 1000').nullish(),
    strokes,
    putts,
    penalties: penalties.default(0),
    teeClub: clubCode.nullish(),
    fairwayHit: z.boolean().nullish(),
    greenInRegulation: z.boolean().nullish(),
    shots: boundedArray(z.array(shot), 20, 'can have at most 20 shots').nullish(),
  })
  .superRefine((h, ctx) => {
    if (h.putts > h.strokes) {
      ctx.addIssue({ code: 'custom', path: ['putts'], message: 'must be between 0 and strokes' });
    }
    if (h.penalties > h.strokes) {
      ctx.addIssue({ code: 'custom', path: ['penalties'], message: 'cannot be more than strokes' });
    }
  });

function noRepeatedHoles(holes, ctx) {
  const seen = new Set();
  holes.forEach((h, i) => {
    if (seen.has(h.number)) {
      ctx.addIssue({ code: 'custom', path: ['holes', i, 'number'], message: 'hole numbers cannot repeat' });
    }
    seen.add(h.number);
  });
}

const FUTURE_GRACE_MS = 5 * 60 * 1000;

const playedAt = z
  .string({ required_error: 'is required' })
  .datetime({ offset: true, message: 'must be an ISO date and time, e.g. 2026-09-12T02:10:00.000Z' })
  .transform((s) => new Date(s))
  .refine((d) => d.getTime() <= Date.now() + FUTURE_GRACE_MS, 'cannot be in the future');

const create = z
  .object({
    clientRoundId: z
      .string()
      .trim()
      .min(8, 'must be 8 to 64 characters')
      .max(64, 'must be 8 to 64 characters')
      .regex(/^[A-Za-z0-9_-]+$/, 'may only use letters, numbers, - and _')
      .optional(),
    // A2 sent courseId; Phase 2 adds course.name for self-named courses.
    courseId: objectId.optional(),
    course: z.object({ name: courseName }).optional(),
    tee: z.string().trim().max(20, 'must be 20 characters or fewer').nullish(),
    playedAt,
    source: z.enum(['mobile-app', 'web']).default('web'),
    holesPlayed: z.union([z.literal(9), z.literal(18)], { errorMap: () => ({ message: 'must be 9 or 18' }) }).optional(),
    holes: boundedArray(z.array(hole, { required_error: 'is required' }), 18, 'must contain 9 or 18 holes'),
    notes: z.string().trim().max(500, 'must be 500 characters or fewer').nullish(),
  })
  .superRefine((b, ctx) => {
    if (!b.courseId && !b.course) {
      ctx.addIssue({ code: 'custom', path: ['course', 'name'], message: 'is required (or send courseId)' });
    }
    if (b.courseId && b.course) {
      ctx.addIssue({ code: 'custom', path: ['courseId'], message: 'send courseId or course.name, not both' });
    }
    if (b.holes.length !== 9 && b.holes.length !== 18) {
      ctx.addIssue({ code: 'custom', path: ['holes'], message: 'must contain 9 or 18 holes' });
    }
    if (b.holesPlayed && b.holesPlayed !== b.holes.length) {
      ctx.addIssue({ code: 'custom', path: ['holesPlayed'], message: 'must equal the number of holes sent' });
    }
    noRepeatedHoles(b.holes, ctx);
  });

const holePatch = z
  .object({
    number: holeNumber,
    par: par.optional(),
    strokes: strokes.optional(),
    putts: putts.optional(),
    penalties: penalties.optional(),
    teeClub: clubCode.nullish(),
    fairwayHit: z.boolean().nullish(),
    greenInRegulation: z.boolean().nullish(),
  })
  .strip();

const patch = z
  .object({
    notes: z.string().trim().max(500, 'must be 500 characters or fewer').nullish(),
    tee: z.string().trim().max(20, 'must be 20 characters or fewer').nullish(),
    playedAt: playedAt.optional(),
    holes: boundedArray(z.array(holePatch), 18, 'can have at most 18 holes').optional(),
  })
  .superRefine((b, ctx) => {
    if (Object.keys(b).length === 0) {
      ctx.addIssue({ code: 'custom', path: [], message: 'send at least one field to change' });
    }
    if (b.holes) noRepeatedHoles(b.holes, ctx);
  });

const list = z
  .object({
    from: dateParam.optional(),
    to: dateParam.optional(),
    courseId: objectId.optional(),
    holes: z.coerce
      .number()
      .refine((n) => n === 9 || n === 18, 'must be 9 or 18')
      .optional(),
    sort: z.enum(['playedAt', '-playedAt', 'strokes', '-strokes']).default('-playedAt'),
    page,
    limit: limit(50, 10),
  })
  .refine((q) => !q.from || !q.to || Date.parse(q.from) <= Date.parse(q.to), {
    path: ['to'],
    message: 'must be on or after from',
  });

const params = z.object({ roundId: objectId });

module.exports = { create, patch, list, params, SHOT_RESULTS };
