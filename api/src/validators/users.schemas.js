const { z, objectId, displayName, userIdParams } = require('./common');

const patch = z
  .object({
    displayName: displayName.optional(),
    homeCourseId: objectId.nullable().optional(),
    preferences: z
      .object({
        units: z.enum(['metric', 'imperial']).optional(),
        theme: z.enum(['light', 'dark']).optional(),
        showOnLeaderboard: z.boolean({ invalid_type_error: 'must be true or false' }).optional(),
      })
      .optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'send at least one field to change' });

const exportQuery = z.object({
  format: z.enum(['csv', 'json']).default('json'),
});

module.exports = { patch, exportQuery, params: userIdParams };
