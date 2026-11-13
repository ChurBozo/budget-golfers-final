// Rebuilds the database from seed/data/*.json.
//
//   npm run seed                  load the files exactly as they are
//   npm run seed -- --relative    move every date forward so the newest round
//                                 was played 2 days ago (use this when marking
//                                 long after November 2026, so the "season" and
//                                 "month" leaderboards still have rounds)
//
// It drops the four collections first, so it can be run as often as needed.
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { EJSON } = mongoose.mongo.BSON;

const env = require('../src/config/env');
const db = require('../src/config/db');
const models = require('../src/models');

const DATA = path.join(__dirname, 'data');
const COLLECTIONS = [
  ['users', models.User],
  ['courses', models.Course],
  ['rounds', models.Round],
  ['clubs', models.Club],
];

function load(name) {
  return EJSON.parse(fs.readFileSync(path.join(DATA, `${name}.json`), 'utf8'), { relaxed: false });
}

// Shifts every Date in a document by ms (walks nested objects and arrays).
function shiftDates(value, ms) {
  if (value instanceof Date) return new Date(value.getTime() + ms);
  if (Array.isArray(value)) return value.map((v) => shiftDates(v, ms));
  if (value && typeof value === 'object' && value.constructor === Object) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shiftDates(v, ms)]));
  }
  return value;
}

async function main() {
  const relative = process.argv.includes('--relative');
  const data = Object.fromEntries(COLLECTIONS.map(([name]) => [name, load(name)]));

  if (relative) {
    const newest = Math.max(...data.rounds.map((r) => r.playedAt.getTime()));
    const ms = Date.now() - 2 * 864e5 - newest;
    for (const [name] of COLLECTIONS) data[name] = data[name].map((d) => shiftDates(d, ms));
    console.log(`Dates moved forward by ${Math.round(ms / 864e5)} days.`);
  }

  await db.connect(env.mongoUri);
  console.log(`Connected to ${env.mongoUri.replace(/\/\/([^@/]+)@/, '//***@')}`);

  for (const [name, Model] of COLLECTIONS) {
    await Model.collection.drop().catch(() => {});
    await Model.createCollection();
    await Model.syncIndexes();
    await Model.collection.insertMany(data[name]);
    console.log(`  ${name.padEnd(8)} ${String(data[name].length).padStart(4)} documents`);
  }

  console.log('\nTest accounts (password for all: Correct-Horse-7):');
  for (const u of data.users) {
    const rounds = data.rounds.filter((r) => String(r.userId) === String(u._id)).length;
    console.log(`  ${u.email.padEnd(24)} ${u.displayName.padEnd(12)} ${String(rounds).padStart(3)} rounds`);
  }
  await db.disconnect();
}

main().catch(async (err) => {
  console.error('Seeding failed:', err.message);
  await db.disconnect().catch(() => {});
  process.exit(1);
});
