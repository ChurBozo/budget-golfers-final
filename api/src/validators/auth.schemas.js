const { z, email, displayName, courseName } = require('./common');

const password = z
  .string({ required_error: 'is required' })
  .min(8, 'must be at least 8 characters')
  .max(72, 'must be 72 characters or fewer');

// The app identifies itself so it can get a longer-lived token.
const client = z.enum(['web', 'mobile-app']).default('web');

const device = z
  .object({
    deviceId: z.string().trim().min(1).max(64),
    platform: z.enum(['android', 'ios', 'web', 'other']).default('other'),
  })
  .optional();

const register = z.object({
  email,
  password,
  displayName,
  // Courses are self-named, so a home course is given by name.
  homeCourseName: courseName.optional(),
  client,
  device,
});

const login = z.object({
  email,
  password: z.string({ required_error: 'is required' }).min(1, 'is required').max(200),
  client,
  device,
});

module.exports = { register, login };
