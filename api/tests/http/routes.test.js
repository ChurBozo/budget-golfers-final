// HTTP behaviour that does not need a database: the default 404 route,
// authentication, validation and the JSON error format.
const request = require('supertest');
const createApp = require('../../src/app');
const { signToken } = require('../../src/services/auth.service');

const app = createApp();
const userId = '66f0a1c2e4b0a1b2c3d4e5f6';
const auth = { Authorization: `Bearer ${signToken(userId).token}` };

function expectError(res, status, code) {
  expect(res.status).toBe(status);
  expect(res.headers['content-type']).toMatch(/application\/json/);
  expect(res.body.success).toBe(false);
  expect(res.body.error).toMatchObject({ status, code });
  expect(res.body.error.requestId).toMatch(/^req_[0-9a-f]{6}$/);
}

describe('default route (A3: catch unintended routes)', () => {
  test.each([
    ['get', '/api/does-not-exist'],
    ['get', '/nothing/here'],
    ['post', '/api/teapot'],
    ['delete', '/api'],
  ])('%s %s gives HTTP 404 with a JSON message', async (method, url) => {
    const res = await request(app)[method](url);
    expectError(res, 404, 'NOT_FOUND');
    expect(res.body.error.message).toContain(url.split('?')[0]);
  });
});

describe('health and index', () => {
  test('GET /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { status: 'ok' } });
  });
  test('GET /api lists the resources', async () => {
    const res = await request(app).get('/api');
    expect(Object.keys(res.body.data.resources)).toEqual(['auth', 'users', 'rounds', 'courses', 'stats', 'clubs', 'leaderboard']);
  });
  test('security headers are set and Express is not advertised', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('authentication', () => {
  test.each([
    ['/api/users/me'],
    ['/api/rounds'],
    ['/api/courses'],
    [`/api/stats/${userId}`],
    [`/api/clubs/${userId}`],
    ['/api/leaderboard'],
  ])('%s without a token gives 401', async (url) => {
    expectError(await request(app).get(url), 401, 'UNAUTHENTICATED');
  });

  test('a forged token gives 401', async () => {
    const res = await request(app).get('/api/rounds').set('Authorization', 'Bearer abc.def.ghi');
    expectError(res, 401, 'UNAUTHENTICATED');
  });

  test("another golfer's stats give 403, as in A2 section 6.4", async () => {
    const res = await request(app).get('/api/stats/66f0a1c2e4b0a1b2c3d4e001').set(auth);
    expectError(res, 403, 'FORBIDDEN');
    expect(res.body.error.message).toBe('You can only view your own statistics.');
  });

  test("changing another golfer's account or clubs gives 403", async () => {
    expectError(await request(app).patch('/api/users/66f0a1c2e4b0a1b2c3d4e001').set(auth).send({ displayName: 'X' }), 403, 'FORBIDDEN');
    expectError(await request(app).put('/api/clubs/66f0a1c2e4b0a1b2c3d4e001').set(auth).send({ clubs: [] }), 403, 'FORBIDDEN');
  });
});

describe('validation (422 for the body, 400 for the query)', () => {
  const holes = Array.from({ length: 18 }, (_, i) => ({ number: i + 1, par: 4, strokes: 5, putts: 2 }));
  const round = { course: { name: 'Omanu Golf Club' }, playedAt: '2026-09-12T02:10:00.000Z', holes };

  test('strokes out of range gives the A2 example error', async () => {
    const bad = { ...round, holes: holes.map((h, i) => (i === 3 ? { ...h, strokes: 25 } : h)) };
    const res = await request(app).post('/api/rounds').set(auth).send(bad);
    expectError(res, 422, 'VALIDATION_FAILED');
    expect(res.body.error.details).toEqual([{ field: 'holes[3].strokes', issue: 'must be between 1 and 20' }]);
  });

  test('putts cannot be more than strokes', async () => {
    const bad = { ...round, holes: holes.map((h, i) => (i === 0 ? { ...h, putts: 6 } : h)) };
    const res = await request(app).post('/api/rounds').set(auth).send(bad);
    expect(res.body.error.details).toContainEqual({ field: 'holes[0].putts', issue: 'must be between 0 and strokes' });
  });

  test('a round must have 9 or 18 holes with no repeats', async () => {
    const res = await request(app)
      .post('/api/rounds')
      .set(auth)
      .send({ ...round, holes: [...holes.slice(0, 11), { ...holes[0] }] });
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['holes', 'holes[11].number']));
  });

  // zod advisory GHSA-mrhx-c7xc-m3w5: a long array of bad elements used to make
  // one problem per field per element (1.3 million for a 1 MB body).
  test('a huge holes array is rejected on its length alone', async () => {
    const res = await request(app)
      .post('/api/rounds')
      .set(auth)
      .send({ ...round, holes: Array.from({ length: 100000 }, () => ({})) });
    expectError(res, 422, 'VALIDATION_FAILED');
    expect(res.body.error.details).toEqual([{ field: 'holes', issue: 'must contain 9 or 18 holes' }]);
  });

  test('a huge shots array is rejected on its length alone', async () => {
    const bad = { ...round, holes: holes.map((h, i) => (i === 0 ? { ...h, shots: Array.from({ length: 100000 }, () => ({})) } : h)) };
    const res = await request(app).post('/api/rounds').set(auth).send(bad);
    expectError(res, 422, 'VALIDATION_FAILED');
    expect(res.body.error.details).toEqual([{ field: 'holes[0].shots', issue: 'can have at most 20 shots' }]);
  });

  test('at most 50 field errors are sent back', async () => {
    const bad = { ...round, holes: holes.map((h) => ({ ...h, shots: Array.from({ length: 20 }, () => ({})) })) };
    const res = await request(app).post('/api/rounds').set(auth).send(bad);
    expectError(res, 422, 'VALIDATION_FAILED');
    expect(res.body.error.details).toHaveLength(50);
  });

  test('playedAt cannot be in the future', async () => {
    const res = await request(app).post('/api/rounds').set(auth).send({ ...round, playedAt: '2099-01-01T00:00:00.000Z' });
    expect(res.body.error.details).toContainEqual({ field: 'playedAt', issue: 'cannot be in the future' });
  });

  test('a course name or courseId is required', async () => {
    const { course, ...noCourse } = round;
    const res = await request(app).post('/api/rounds').set(auth).send(noCourse);
    expectError(res, 422, 'VALIDATION_FAILED');
    expect(res.body.error.details[0].field).toBe('course.name');
  });

  test('limit=500 gives 400 BAD_REQUEST (A2 Table 8)', async () => {
    const res = await request(app).get('/api/rounds?limit=500').set(auth);
    expectError(res, 400, 'BAD_REQUEST');
    expect(res.body.error.details).toEqual([{ field: 'limit', issue: 'must be 50 or fewer' }]);
  });

  test('an unknown leaderboard sort gives 400', async () => {
    expectError(await request(app).get('/api/leaderboard?sort=best').set(auth), 400, 'BAD_REQUEST');
  });

  test('a malformed round id gives 400', async () => {
    expectError(await request(app).get('/api/rounds/not-an-id').set(auth), 400, 'BAD_REQUEST');
  });

  test('malformed JSON gives 400', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expectError(res, 400, 'BAD_REQUEST');
  });

  test('register checks every field', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'not-an-email', password: 'short', displayName: 'A' });
    expectError(res, 422, 'VALIDATION_FAILED');
    expect(res.body.error.details.map((d) => d.field)).toEqual(['email', 'password', 'displayName']);
  });

  test('more than 14 clubs in the bag is refused', async () => {
    const codes = ['driver', '3w', '5w', '7w', '3h', '4h', '5i', '6i', '7i', '8i', '9i', 'pw', 'gw', 'sw', 'lw'];
    const res = await request(app).put(`/api/clubs/${userId}`).set(auth).send({ clubs: codes.map((code) => ({ code, inBag: true })) });
    expectError(res, 422, 'VALIDATION_FAILED');
    expect(res.body.error.details[0].issue).toMatch(/at most 14/);
  });
});
