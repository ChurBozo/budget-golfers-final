// End-to-end tests of all 17 endpoints against a real MongoDB.
const request = require('supertest');
const createApp = require('../../src/app');
const { User, Round, Course, Club } = require('../../src/models');
const testDb = require('./db');

const app = createApp();

beforeAll(testDb.start);
afterAll(testDb.stop);

// ---------- helpers ----------
let n = 0;
async function newGolfer(overrides = {}) {
  n += 1;
  const body = {
    email: `golfer${n}@example.com`,
    password: 'Correct-Horse-7',
    displayName: `Golfer ${n}`,
    ...overrides,
  };
  const res = await request(app).post('/api/auth/register').send(body);
  expect(res.status).toBe(201);
  return { id: res.body.data.user.id, token: res.body.data.token, auth: { Authorization: `Bearer ${res.body.data.token}` }, body };
}

function holes(count = 18, strokes = 5, extra = {}) {
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    par: i % 4 === 1 ? 3 : 4,
    distanceMetres: i % 4 === 1 ? 150 : 340,
    strokes,
    putts: 2,
    penalties: 0,
    ...extra,
  }));
}

function roundBody(overrides = {}) {
  return {
    course: { name: 'Omanu Golf Club' },
    tee: 'Yellow',
    playedAt: '2026-09-12T02:10:00.000Z',
    source: 'mobile-app',
    holes: holes(),
    ...overrides,
  };
}

async function addRound(g, overrides) {
  const res = await request(app).post('/api/rounds').set(g.auth).send(roundBody(overrides));
  expect([200, 201]).toContain(res.status);
  return res.body.data;
}

// ---------- auth ----------
describe('POST /api/auth/register and /login', () => {
  test('register returns 201, a token and the user without the password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'Aroha.M@Example.com', password: 'Correct-Horse-7', displayName: 'Aroha M.', homeCourseName: 'Omanu Golf Club' });
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/users/${res.body.data.user.id}`);
    expect(res.body.data).toMatchObject({
      expiresIn: 3600,
      user: { email: 'aroha.m@example.com', displayName: 'Aroha M.', preferences: { units: 'metric', theme: 'light', showOnLeaderboard: true } },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    const stored = await User.findOne({ email: 'aroha.m@example.com' }).select('+passwordHash').lean();
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt hash, not the password
  });

  test('the same email again gives 409 EMAIL_TAKEN', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'aroha.m@example.com', password: 'Another-Pass-1', displayName: 'Copy' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  test('login works with any capitalisation of the email', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'AROHA.M@example.com', password: 'Correct-Horse-7' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.displayName).toBe('Aroha M.');
  });

  test('the app gets a longer token and its device is remembered', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'aroha.m@example.com', password: 'Correct-Horse-7', client: 'mobile-app', device: { deviceId: 'app-7d2e41', platform: 'android' } });
    expect(res.body.data.expiresIn).toBe(60 * 60 * 24 * 30);
    const user = await User.findOne({ email: 'aroha.m@example.com' }).lean();
    expect(user.devices).toEqual([expect.objectContaining({ deviceId: 'app-7d2e41', platform: 'android' })]);
  });

  test('a wrong password or unknown email gives the same 401', async () => {
    const wrong = await request(app).post('/api/auth/login').send({ email: 'aroha.m@example.com', password: 'nope-nope' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'nope-nope' });
    for (const res of [wrong, unknown]) {
      expect(res.status).toBe(401);
      expect(res.body.error).toMatchObject({ code: 'UNAUTHENTICATED', message: 'Email or password is incorrect.' });
    }
  });
});

// ---------- users ----------
describe('/api/users', () => {
  test('GET /me returns the profile with the home course and links', async () => {
    const g = await newGolfer({ homeCourseName: 'Tauranga Golf Club' });
    const res = await request(app).get('/api/users/me').set(g.auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: g.id,
      homeCourse: { name: 'Tauranga Golf Club' },
      handicapEstimate: null,
      links: { self: `/api/users/${g.id}`, stats: `/api/stats/${g.id}`, clubs: `/api/clubs/${g.id}` },
    });
  });

  test('PATCH changes name and preferences, ignores role', async () => {
    const g = await newGolfer();
    const res = await request(app)
      .patch(`/api/users/${g.id}`)
      .set(g.auth)
      .send({ displayName: 'Aroha Morgan', preferences: { units: 'imperial', showOnLeaderboard: false }, role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ displayName: 'Aroha Morgan', preferences: { units: 'imperial', theme: 'light', showOnLeaderboard: false } });
    expect((await User.findById(g.id).lean()).role).toBe('golfer');
  });

  test('PATCH homeCourseId must be one of my courses', async () => {
    const g = await newGolfer();
    const other = await newGolfer({ homeCourseName: 'Mount Maunganui Golf Club' });
    const theirs = (await request(app).get('/api/users/me').set(other.auth)).body.data.homeCourse.id;
    const res = await request(app).patch(`/api/users/${g.id}`).set(g.auth).send({ homeCourseId: theirs });
    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual([{ field: 'homeCourseId', issue: 'is not one of your courses' }]);
  });

  test('export as JSON and CSV', async () => {
    const g = await newGolfer();
    await addRound(g, { notes: '=SUM(A1)' });
    const json = await request(app).get(`/api/users/${g.id}/export?format=json`).set(g.auth);
    expect(json.status).toBe(200);
    expect(json.headers['content-disposition']).toMatch(/attachment; filename="?budget-golfers-\d{4}-\d{2}-\d{2}\.json"?/);
    expect(json.body.data.rounds).toHaveLength(1);
    expect(json.body.data.rounds[0].holes).toHaveLength(18);

    const csv = await request(app).get(`/api/users/${g.id}/export?format=csv`).set(g.auth);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text.charCodeAt(0)).toBe(0xfeff); // byte order mark for Excel
    const lines = csv.text.trim().split('\r\n');
    expect(lines[0]).toMatch(/^roundId,playedAt,course/);
    expect(lines.slice(1, 19)).toHaveLength(18); // one row per hole
    expect(csv.text).toContain("'=SUM(A1)"); // formula injection blocked
  });

  test('DELETE removes the account and everything stored for it', async () => {
    const g = await newGolfer();
    await addRound(g);
    await request(app).get(`/api/clubs/${g.id}`).set(g.auth);
    const res = await request(app).delete(`/api/users/${g.id}`).set(g.auth);
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(await User.countDocuments({ _id: g.id })).toBe(0);
    expect(await Round.countDocuments({ userId: g.id })).toBe(0);
    expect(await Course.countDocuments({ createdBy: g.id })).toBe(0);
    expect(await Club.countDocuments({ userId: g.id })).toBe(0);
    // The old token no longer works.
    expect((await request(app).get('/api/users/me').set(g.auth)).status).toBe(401);
  });
});

// ---------- rounds ----------
describe('POST /api/rounds (app upload)', () => {
  test('201 with totals worked out by the server and a Location header', async () => {
    const g = await newGolfer();
    const res = await request(app)
      .post('/api/rounds')
      .set(g.auth)
      .send(roundBody({ clientRoundId: 'a3f1c9e2-5b7d-4e8a-9c1f-2d6b8e4a7c10', totals: { strokes: 1 } }));
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/rounds/${res.body.data.id}`);
    expect(res.body.data).toMatchObject({
      clientRoundId: 'a3f1c9e2-5b7d-4e8a-9c1f-2d6b8e4a7c10',
      totals: { strokes: 90, toPar: 23, putts: 36 }, // the sent totals were ignored
      duplicate: false,
    });
  });

  test('the same clientRoundId again returns 200 duplicate:true and stores nothing new', async () => {
    const g = await newGolfer();
    const body = roundBody({ clientRoundId: 'b1b1b1b1-0000-4000-8000-000000000001' });
    const first = await request(app).post('/api/rounds').set(g.auth).send(body);
    const again = await request(app).post('/api/rounds').set(g.auth).send(body);
    expect(again.status).toBe(200);
    expect(again.body.data).toMatchObject({ id: first.body.data.id, duplicate: true });
    expect(await Round.countDocuments({ userId: g.id })).toBe(1);
  });

  test('two uploads of the same round at the same moment still store one', async () => {
    const g = await newGolfer();
    const body = roundBody({ clientRoundId: 'c2c2c2c2-0000-4000-8000-000000000002' });
    const results = await Promise.all([1, 2, 3].map(() => request(app).post('/api/rounds').set(g.auth).send(body)));
    expect(results.map((r) => r.status).sort()).toEqual([200, 200, 201]);
    expect(await Round.countDocuments({ userId: g.id })).toBe(1);
  });

  test('another golfer can use the same clientRoundId', async () => {
    const a = await newGolfer();
    const b = await newGolfer();
    const body = roundBody({ clientRoundId: 'd3d3d3d3-0000-4000-8000-000000000003' });
    expect((await request(app).post('/api/rounds').set(a.auth).send(body)).status).toBe(201);
    expect((await request(app).post('/api/rounds').set(b.auth).send(body)).status).toBe(201);
  });

  test('self-named courses: different spellings find the same course', async () => {
    const g = await newGolfer();
    const r1 = await addRound(g, { course: { name: 'Omanu Golf Club' } });
    const r2 = await addRound(g, { course: { name: '  omanu   golf CLUB ' } });
    const d1 = (await request(app).get(r1.links.self).set(g.auth)).body.data;
    const d2 = (await request(app).get(r2.links.self).set(g.auth)).body.data;
    expect(d1.course.id).toBe(d2.course.id);
    expect(await Course.countDocuments({ createdBy: g.id })).toBe(1);
  });

  test('the course learns its holes, tees and par from rounds', async () => {
    const g = await newGolfer();
    await addRound(g, { course: { name: 'Pāpāmoa Muni 9' }, holes: holes(9) });
    const list = (await request(app).get('/api/courses').set(g.auth)).body.data;
    expect(list).toEqual([expect.objectContaining({ name: 'Pāpāmoa Muni 9', holes: 9, par: null })]);
    const detail = (await request(app).get(`/api/courses/${list[0].id}`).set(g.auth)).body.data;
    expect(detail.tees).toEqual([expect.objectContaining({ name: 'Yellow' })]);
    expect(detail.holes[0]).toEqual({ number: 1, par: 4, strokeIndex: null, metres: { Yellow: 340 } });
  });

  test('GPS shots are stored as GeoJSON and measured by the server', async () => {
    const g = await newGolfer();
    const shots = [
      { seq: 1, club: 'driver', start: { lat: -37.67412, lng: 176.22401 }, end: { lat: -37.67595, lng: 176.22498 }, distanceMetres: 5, result: 'rough-left' },
      { seq: 2, club: '7i', start: { lat: -37.67595, lng: 176.22498 }, end: { lat: -37.6769, lng: 176.2253 }, result: 'bunker' },
    ];
    const created = await addRound(g, { holes: holes(18, 5).map((h, i) => (i === 6 ? { ...h, shots } : h)) });
    const stored = await Round.findById(created.id).lean();
    expect(stored.holes[6].shots[0].start).toEqual({ type: 'Point', coordinates: [176.22401, -37.67412] });
    const detail = (await request(app).get(created.links.self).set(g.auth)).body.data;
    expect(detail.holes[6].shots[0]).toMatchObject({ seq: 1, club: 'driver', start: { lat: -37.67412, lng: 176.22401 }, result: 'rough-left' });
    expect(detail.holes[6].shots[0].distanceMetres).toBeGreaterThan(200); // not the 5 that was sent
  });

  test('a custom club must be in the bag first', async () => {
    const g = await newGolfer();
    const body = roundBody({ holes: holes().map((h, i) => (i === 0 ? { ...h, teeClub: 'mini-driver' } : h)) });
    const res = await request(app).post('/api/rounds').set(g.auth).send(body);
    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual([{ field: 'holes[0].teeClub', issue: 'is not in your bag' }]);

    await request(app).put(`/api/clubs/${g.id}`).set(g.auth).send({ clubs: [{ code: 'mini-driver', label: 'Mini driver', inBag: true }] });
    expect((await request(app).post('/api/rounds').set(g.auth).send(body)).status).toBe(201);
  });

  test('courseId must be my own course', async () => {
    const a = await newGolfer({ homeCourseName: 'Secret Course' });
    const b = await newGolfer();
    const courseId = (await request(app).get('/api/users/me').set(a.auth)).body.data.homeCourse.id;
    const res = await request(app).post('/api/rounds').set(b.auth).send(roundBody({ course: undefined, courseId }));
    expect(res.status).toBe(422);
    expect(res.body.error.details[0]).toEqual({ field: 'courseId', issue: 'is not one of your courses' });
  });
});

describe('GET /api/rounds (list, filters, paging)', () => {
  let g;
  beforeAll(async () => {
    g = await newGolfer();
    await addRound(g, { playedAt: '2026-08-01T01:00:00.000Z', holes: holes(18, 6) }); // 108
    await addRound(g, { playedAt: '2026-08-15T01:00:00.000Z', holes: holes(18, 4) }); // 72 personal best
    await addRound(g, { playedAt: '2026-09-01T01:00:00.000Z', course: { name: 'Tauranga Golf Club' } }); // 90
    await addRound(g, { playedAt: '2026-09-20T01:00:00.000Z', holes: holes(9) }); // 9 holes
  });

  test('newest first, without hole data, with a personal best flag', async () => {
    const res = await request(app).get('/api/rounds').set(g.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => r.playedAt.slice(0, 10))).toEqual(['2026-09-20', '2026-09-01', '2026-08-15', '2026-08-01']);
    expect(res.body.data[0].holes).toBeUndefined();
    expect(res.body.data.filter((r) => r.isPersonalBest).map((r) => [r.holesPlayed, r.totals.strokes])).toEqual([
      [9, 45],
      [18, 72],
    ]);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 10, total: 4, totalPages: 1, sort: '-playedAt' });
  });

  test('filters by date range, holes and course', async () => {
    const byDate = await request(app).get('/api/rounds?from=2026-08-10&to=2026-09-01').set(g.auth);
    expect(byDate.body.data).toHaveLength(2); // "to" includes the whole day
    const nine = await request(app).get('/api/rounds?holes=9').set(g.auth);
    expect(nine.body.data).toHaveLength(1);
    const courses = (await request(app).get('/api/courses?search=taur').set(g.auth)).body.data;
    const byCourse = await request(app).get(`/api/rounds?courseId=${courses[0].id}`).set(g.auth);
    expect(byCourse.body.data.map((r) => r.course.name)).toEqual(['Tauranga Golf Club']);
    expect(byCourse.body.meta.filters.courseId).toBe(courses[0].id);
  });

  test('sorts by score and pages with links', async () => {
    const res = await request(app).get('/api/rounds?sort=strokes&limit=2&page=1').set(g.auth);
    expect(res.body.data.map((r) => r.totals.strokes)).toEqual([45, 72]);
    expect(res.body.meta.totalPages).toBe(2);
    expect(res.body.links).toEqual({
      self: '/api/rounds?sort=strokes&page=1&limit=2',
      next: '/api/rounds?sort=strokes&page=2&limit=2',
      prev: null,
    });
  });

  test("another golfer's rounds are never listed", async () => {
    const other = await newGolfer();
    expect((await request(app).get('/api/rounds').set(other.auth)).body.data).toEqual([]);
  });
});

describe('GET, PATCH, DELETE /api/rounds/:roundId', () => {
  test('GET returns the full round; another golfer gets 404', async () => {
    const g = await newGolfer();
    const round = await addRound(g, { notes: 'Windy back nine' });
    const res = await request(app).get(`/api/rounds/${round.id}`).set(g.auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ holesPlayed: 18, course: { name: 'Omanu Golf Club', par: 67 }, notes: 'Windy back nine' });
    expect(res.body.data.holes).toHaveLength(18);

    const other = await newGolfer();
    const theirs = await request(app).get(`/api/rounds/${round.id}`).set(other.auth);
    expect(theirs.status).toBe(404); // existence is not revealed
    expect((await request(app).delete(`/api/rounds/${round.id}`).set(other.auth)).status).toBe(404);
  });

  test('PATCH corrects a hole and the totals and stats are recalculated', async () => {
    const g = await newGolfer();
    const round = await addRound(g);
    const res = await request(app)
      .patch(`/api/rounds/${round.id}`)
      .set(g.auth)
      .send({ notes: 'Windy back nine', holes: [{ number: 2, strokes: 3, putts: 2 }] });
    expect(res.status).toBe(200);
    // hole 2 is a par 3: on the green in 1, so it is now a green in regulation
    expect(res.body.data.totals).toMatchObject({ strokes: 88, putts: 36, greensInRegulation: 1 });
    expect(res.body.data.holes[1]).toMatchObject({ number: 2, strokes: 3, putts: 2, greenInRegulation: true });
    const stats = (await request(app).get(`/api/stats/${g.id}?period=all`).set(g.auth)).body.data;
    expect(stats.scoring.bestScore).toBe(88);
  });

  test('PATCH rejects a hole that is not in the round, or putts above strokes', async () => {
    const g = await newGolfer();
    const round = await addRound(g, { holes: holes(9) });
    const missing = await request(app).patch(`/api/rounds/${round.id}`).set(g.auth).send({ holes: [{ number: 14, strokes: 4 }] });
    expect(missing.status).toBe(422);
    expect(missing.body.error.details).toEqual([{ field: 'holes[0].number', issue: 'is not a hole in this round' }]);
    const putts = await request(app).patch(`/api/rounds/${round.id}`).set(g.auth).send({ holes: [{ number: 1, strokes: 2 }] });
    expect(putts.status).toBe(200); // 2 strokes, 2 putts is allowed
    const bad = await request(app).patch(`/api/rounds/${round.id}`).set(g.auth).send({ holes: [{ number: 1, putts: 3 }] });
    expect(bad.status).toBe(422);
  });

  test('DELETE gives 204, then the round is gone and stats update', async () => {
    const g = await newGolfer();
    const round = await addRound(g);
    const res = await request(app).delete(`/api/rounds/${round.id}`).set(g.auth);
    expect(res.status).toBe(204);
    expect((await request(app).get(`/api/rounds/${round.id}`).set(g.auth)).status).toBe(404);
    expect((await User.findById(g.id).lean()).statsSnapshot.roundsPlayed).toBe(0);
  });
});

// ---------- stats, clubs, leaderboard ----------
describe('GET /api/stats/:userId', () => {
  test('works out the dashboard numbers and the handicap estimate', async () => {
    const g = await newGolfer();
    for (const [day, s] of [['01', 6], ['05', 5], ['09', 5], ['13', 4]]) {
      await addRound(g, { playedAt: `2026-08-${day}T01:00:00.000Z`, holes: holes(18, s) });
    }
    const res = await request(app).get(`/api/stats/${g.id}?period=last5`).set(g.auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      userId: g.id,
      period: 'last5',
      roundsInPeriod: 4,
      roundsAllTime: 4,
      scoring: { averageScore: 90, bestScore: 72, changeVsPreviousPeriod: null },
      putting: { puttsPerRound: 36 },
    });
    expect(res.body.data.trend.map((t) => t.score)).toEqual([72, 90, 90, 108]);
    // 4 rounds: lowest differential - 1.0 = (72 - 67) - 1 = 4
    expect(res.body.data.handicapEstimate).toBe(4);
    expect((await request(app).get('/api/users/me').set(g.auth)).body.data.handicapEstimate).toBe(4);
  });

  test('a golfer with no rounds gets empty numbers, not an error', async () => {
    const g = await newGolfer();
    const res = await request(app).get(`/api/stats/${g.id}`).set(g.auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ roundsInPeriod: 0, scoring: { averageScore: null }, trend: [] });
  });
});

describe('/api/clubs/:userId', () => {
  test('a new golfer starts with the default 14-club bag', async () => {
    const g = await newGolfer();
    const res = await request(app).get(`/api/clubs/${g.id}`).set(g.auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ userId: g.id, units: 'metric', minimumShots: 5 });
    expect(res.body.data.clubs.filter((c) => c.inBag)).toHaveLength(14);
  });

  test('PUT replaces the bag; distances come only from recorded shots', async () => {
    const g = await newGolfer();
    const shots = (club, d) => [{ seq: 1, club, start: { lat: -37.6741, lng: 176.224 }, end: { lat: -37.6741 + d / 111195, lng: 176.224 } }];
    const hs = holes().map((h, i) => ({ ...h, shots: shots('driver', 200 + i) }));
    await addRound(g, { holes: hs });
    const res = await request(app)
      .put(`/api/clubs/${g.id}`)
      .set(g.auth)
      .send({ clubs: [{ code: 'driver', inBag: true, stats: { averageMetres: 999 } }, { code: '4i', inBag: false }, { code: '5h', label: '5 hybrid', inBag: true }] });
    expect(res.status).toBe(200);
    const driver = res.body.data.clubs.find((c) => c.code === 'driver');
    expect(driver).toMatchObject({ shotCount: 18, enoughData: true, longestMetres: 217 });
    expect(driver.averageMetres).toBeGreaterThanOrEqual(208);
    expect(driver.averageMetres).toBeLessThanOrEqual(209);
    expect(res.body.data.clubs.map((c) => c.code)).toEqual(['driver', '5h', '4i']);
  });
});

describe('GET /api/leaderboard', () => {
  test('ranks opted-in golfers with at least 3 rounds, and includes my own rank', async () => {
    await testDb.clear();
    const fast = await newGolfer({ displayName: 'Tane W.', homeCourseName: 'Tauranga Golf Club' });
    const slow = await newGolfer({ displayName: 'Aroha M.' });
    const hidden = await newGolfer({ displayName: 'Hidden' });
    const few = await newGolfer({ displayName: 'Two Rounds' });
    const now = Date.now();
    const at = (daysAgo) => new Date(now - daysAgo * 864e5).toISOString();
    for (const d of [20, 10, 2]) {
      await addRound(fast, { playedAt: at(d), holes: holes(18, 4) });
      await addRound(slow, { playedAt: at(d), holes: holes(18, 5) });
      await addRound(hidden, { playedAt: at(d), holes: holes(18, 4) });
    }
    await addRound(few, { playedAt: at(1) });
    await addRound(few, { playedAt: at(1), course: { name: 'Another' } });
    await addRound(slow, { playedAt: at(1), holes: holes(9, 3) }); // 9-hole rounds do not count
    await request(app).patch(`/api/users/${hidden.id}`).set(hidden.auth).send({ preferences: { showOnLeaderboard: false } });

    const res = await request(app).get('/api/leaderboard?sort=avgScore&period=month').set(slow.auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { rank: 1, userId: fast.id, displayName: 'Tane W.', homeCourse: 'Tauranga Golf Club', averageScore: 72, improvement: 0, roundsPlayed: 3 },
      { rank: 2, userId: slow.id, displayName: 'Aroha M.', homeCourse: null, averageScore: 90, improvement: 0, roundsPlayed: 3 },
    ]);
    expect(JSON.stringify(res.body)).not.toMatch(/@example\.com/); // no emails (NFR9)
    expect(res.body.meta).toMatchObject({ sort: 'avgScore', period: 'month', minimumRounds: 3, total: 2, currentUser: { rank: 2, onLeaderboard: true } });

    const mine = await request(app).get('/api/leaderboard').set(hidden.auth);
    expect(mine.body.meta.currentUser).toMatchObject({ rank: null, onLeaderboard: false, roundsPlayed: 3 });
  });
});
