// Checks the seed files load into MongoDB and give the numbers the website
// will show for the main test account.
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const mongoose = require('mongoose');
const { EJSON } = mongoose.mongo.BSON;
const createApp = require('../../src/app');
const models = require('../../src/models');
const testDb = require('./db');

const app = createApp();
const DATA = path.join(__dirname, '../../seed/data');
const load = (name) => EJSON.parse(fs.readFileSync(path.join(DATA, `${name}.json`), 'utf8'), { relaxed: false });

beforeAll(async () => {
  await testDb.start();
  for (const [name, Model] of [['users', models.User], ['courses', models.Course], ['rounds', models.Round], ['clubs', models.Club]]) {
    await Model.collection.insertMany(load(name));
  }
});
afterAll(testDb.stop);

test('every seed document passes its Mongoose schema', async () => {
  for (const Model of Object.values(models)) {
    const docs = await Model.find();
    for (const doc of docs) {
      await expect(doc.validate()).resolves.toBeUndefined();
    }
  }
});

test('the collections have the expected sizes', async () => {
  expect(await models.User.countDocuments()).toBe(8);
  expect(await models.Course.countDocuments()).toBe(15);
  expect(await models.Round.countDocuments()).toBe(107);
  expect(await models.Club.countDocuments()).toBe(7);
});

test('all test accounts sign in with the documented password', async () => {
  for (const email of ['aroha.m@example.com', 'tane.w@example.com', 'new.golfer@example.com']) {
    const res = await request(app).post('/api/auth/login').send({ email, password: 'Correct-Horse-7' });
    expect(res.status).toBe(200);
  }
});

test("the A2 example round is in the database and is Aroha's personal best", async () => {
  const login = await request(app).post('/api/auth/login').send({ email: 'aroha.m@example.com', password: 'Correct-Horse-7' });
  const auth = { Authorization: `Bearer ${login.body.data.token}` };
  const round = await request(app).get('/api/rounds/66f2c9e0b1a2c3d4e5f60718').set(auth);
  expect(round.body.data).toMatchObject({
    clientRoundId: 'a3f1c9e2-5b7d-4e8a-9c1f-2d6b8e4a7c10',
    playedAt: '2026-09-12T02:10:00.000Z',
    course: { id: '66e9b7d1a2c3d4e5f6a7b8c9', name: 'Omanu Golf Club', par: 72 },
    tee: 'Yellow',
    totals: { strokes: 84, toPar: 12, putts: 31 },
    notes: 'Windy back nine',
  });
  const stats = await request(app).get('/api/stats/66f0a1c2e4b0a1b2c3d4e5f6?period=all').set(auth);
  expect(stats.body.data.scoring).toMatchObject({ bestScore: 84, bestRoundId: '66f2c9e0b1a2c3d4e5f60718' });
});

test('stored totals and snapshots match what the API calculates', async () => {
  const { roundTotals } = require('../../src/services/calc/totals');
  const { snapshotFor } = require('../../src/services/recalc.service');
  for (const r of await models.Round.find().lean()) {
    expect(r.totals).toEqual(roundTotals(r.holes));
  }
  for (const u of await models.User.find().lean()) {
    const fresh = await snapshotFor(u._id);
    expect(u.statsSnapshot).toEqual(fresh);
  }
});
