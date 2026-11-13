// Generates the test data in seed/data/*.json (MongoDB Extended JSON, one
// array per collection). It is deterministic: the same code always produces
// the same golfers, rounds and shots, so the files can be regenerated.
//
// It uses the API's own calculation code (totals, GPS distances, stats
// snapshot, club averages), so the stored values are exactly what the API
// would have worked out if the rounds had been uploaded one by one.
//
//   npm run seed:generate     -> writes seed/data/*.json
//   npm run seed              -> loads them into MongoDB
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { EJSON, ObjectId } = require('mongoose').mongo.BSON;

const { toStoredHole } = require('../src/services/rounds.service');
const { roundTotals, roundPar } = require('../src/services/calc/totals');
const { offset } = require('../src/services/calc/geo');
const { buildSnapshot } = require('../src/services/calc/snapshot');
const { computeClubStats, mergeBag } = require('../src/services/calc/clubStats');
const { ratingLookup } = require('../src/services/courses.service');
const { DEFAULT_BAG, labelFor } = require('../src/utils/clubCodes');
const { slugify } = require('../src/utils/slug');

const OUT = path.join(__dirname, 'data');
const PASSWORD = 'Correct-Horse-7';
const GENERATED_AT = new Date('2026-11-05T00:00:00.000Z');

// ---------- deterministic random numbers ----------
let state = 20261106;
function rand() {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const chance = (p) => rand() < p;
const between = (a, b) => a + (b - a) * rand();
const pick = (items) => items[Math.floor(rand() * items.length)];
function normal(mean, sd) {
  const u = Math.max(rand(), 1e-9);
  const v = rand();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function uuid() {
  const hex = () => Math.floor(rand() * 16).toString(16);
  const s = Array.from({ length: 32 }, hex).join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-${'89ab'[Math.floor(rand() * 4)]}${s.slice(17, 20)}-${s.slice(20)}`;
}

// ---------- ids ----------
const oid = (hex) => new ObjectId(hex);
let roundCounter = 0x0700;
let courseCounter = 0xb900;
const nextRoundId = () => oid(`66f2c9e0b1a2c3d4e5f6${(roundCounter++).toString(16).padStart(4, '0')}`);
const nextCourseId = () => oid(`66e9b7d1a2c3d4e5f6a7${(courseCounter++).toString(16).padStart(4, '0')}`);

// ---------- course layouts (test data) ----------
const LAYOUTS = {
  omanu: {
    name: 'Omanu Golf Club',
    region: 'Bay of Plenty',
    // The design's example course keeps its location and ratings (A2 courses.json).
    location: { lat: -37.6739, lng: 176.2238 },
    base: { lat: -37.6739, lng: 176.2238 },
    par: [4, 3, 4, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5],
    strokeIndex: [7, 17, 3, 11, 1, 13, 5, 15, 9, 8, 4, 18, 12, 2, 10, 16, 6, 14],
    yellow: [352, 148, 338, 452, 371, 318, 345, 161, 470, 330, 362, 139, 447, 381, 322, 152, 341, 463],
    tees: [
      { name: 'Yellow', courseRating: 69.8, slopeRating: 121 },
      { name: 'White', courseRating: 71.2, slopeRating: 125, extra: 1.055 },
    ],
  },
  tauranga: {
    name: 'Tauranga Golf Club',
    region: 'Bay of Plenty',
    base: { lat: -37.7108, lng: 176.1446 },
    par: [4, 4, 3, 5, 4, 4, 3, 4, 4, 4, 5, 3, 4, 4, 4, 3, 5, 4],
    strokeIndex: [5, 9, 15, 3, 1, 11, 17, 7, 13, 6, 2, 16, 10, 4, 12, 18, 8, 14],
    yellow: [341, 322, 156, 455, 389, 301, 133, 356, 318, 344, 470, 167, 312, 377, 329, 142, 448, 331],
    tees: [{ name: 'Yellow' }, { name: 'White', extra: 1.05 }],
  },
  mount: {
    name: 'Mount Maunganui Golf Club',
    region: 'Bay of Plenty',
    base: { lat: -37.6445, lng: 176.1925 },
    par: [4, 4, 4, 3, 4, 5, 3, 4, 4, 4, 3, 4, 5, 4, 4, 3, 4, 4],
    strokeIndex: [3, 9, 1, 15, 11, 5, 17, 7, 13, 4, 16, 8, 2, 10, 6, 18, 12, 14],
    yellow: [361, 312, 377, 141, 299, 451, 158, 335, 327, 346, 150, 318, 462, 301, 368, 128, 334, 310],
    tees: [{ name: 'Yellow' }],
  },
  muni: {
    // A self-named municipal 9-hole course with no map location.
    name: 'Pāpāmoa Muni 9',
    base: { lat: -37.7002, lng: 176.2954 },
    par: [4, 3, 4, 4, 3, 5, 4, 3, 4],
    yellow: [298, 121, 276, 305, 140, 418, 288, 109, 262],
    tees: [{ name: 'Yellow' }],
  },
};

function holeLength(layout, i, tee) {
  const t = layout.tees.find((x) => x.name === tee) || layout.tees[0];
  return Math.round(layout.yellow[i] * (t.extra || 1));
}

function courseDoc(key, userId, createdAt) {
  const L = LAYOUTS[key];
  const doc = {
    _id: nextCourseId(),
    name: L.name,
    slug: slugify(L.name),
    createdBy: userId,
    tees: L.tees.map((t) => {
      const total = L.yellow.reduce((s, m, i) => s + holeLength(L, i, t.name), 0);
      const out = { name: t.name, par: L.par.length === 18 ? L.par.reduce((a, b) => a + b, 0) : undefined, totalMetres: total };
      if (t.courseRating) out.courseRating = t.courseRating;
      if (t.slopeRating) out.slopeRating = t.slopeRating;
      if (out.par === undefined) delete out.par;
      return out;
    }),
    holes: L.par.map((par, i) => {
      const h = { number: i + 1, par, metres: Object.fromEntries(L.tees.map((t) => [t.name, holeLength(L, i, t.name)])) };
      if (L.strokeIndex) h.strokeIndex = L.strokeIndex[i];
      return h;
    }),
    createdAt,
    updatedAt: createdAt,
  };
  if (L.region) doc.region = L.region;
  if (L.location) doc.location = { type: 'Point', coordinates: [L.location.lng, L.location.lat] };
  return doc;
}

// ---------- golfers ----------
const BASE_DISTANCES = {
  driver: 212, '3w': 190, '5w': 176, '4h': 165, '5i': 152, '6i': 146, '7i': 140,
  '8i': 128, '9i': 116, pw: 102, gw: 88, sw: 72, lw: 55,
};

const GOLFERS = [
  {
    id: '66f0a1c2e4b0a1b2c3d4e5f6', clubsId: '66f0a1c2e4b0a1b2c3d4e600',
    email: 'aroha.m@example.com', recent: 4, displayName: 'Aroha M.', home: 'omanu', courses: ['omanu', 'tauranga', 'muni'],
    prefs: { units: 'metric', theme: 'light', showOnLeaderboard: true },
    rounds: 32, nineHole: 3, overParStart: 1.3, overParEnd: 1.0, power: 1.0, fairway: 0.48, missLeft: 0.68, gpsShare: 0.85,
    device: { deviceId: 'app-7d2e41', platform: 'android' }, joined: '2025-10-18T08:30:00.000Z', tee: 'Yellow',
    bag: ['driver', '3w', '5w', '4h', '4i', '5i', '6i', '7i', '8i', '9i', 'pw', 'sw', 'lw', 'putter'],
  },
  {
    id: '66f0a1c2e4b0a1b2c3d4e001', email: 'tane.w@example.com', recent: 5, displayName: 'Tane W.', home: 'tauranga',
    courses: ['tauranga', 'omanu', 'mount'], prefs: { units: 'metric', theme: 'dark', showOnLeaderboard: true },
    rounds: 24, nineHole: 0, overParStart: 0.42, overParEnd: 0.3, power: 1.16, fairway: 0.62, missLeft: 0.4, gpsShare: 0.7,
    device: { deviceId: 'app-a19c03', platform: 'android' }, joined: '2025-10-25T05:00:00.000Z', tee: 'White',
  },
  {
    id: '66f0a1c2e4b0a1b2c3d4e002', email: 'mei.l@example.com', recent: 4, displayName: 'Mei L.', home: 'omanu',
    courses: ['omanu', 'mount'], prefs: { units: 'metric', theme: 'light', showOnLeaderboard: true },
    rounds: 18, nineHole: 1, overParStart: 0.78, overParEnd: 0.45, power: 0.95, fairway: 0.58, missLeft: 0.5, gpsShare: 0.6,
    device: { deviceId: 'app-5be711', platform: 'android' }, joined: '2025-11-02T04:00:00.000Z', tee: 'Yellow',
  },
  {
    id: '66f0a1c2e4b0a1b2c3d4e003', email: 'sam.k@example.com', recent: 3, displayName: 'Sam K.', home: 'mount',
    courses: ['mount', 'muni'], prefs: { units: 'metric', theme: 'light', showOnLeaderboard: true },
    rounds: 9, nineHole: 2, overParStart: 1.45, overParEnd: 1.35, power: 0.9, fairway: 0.4, missLeft: 0.35, gpsShare: 0.5,
    joined: '2026-02-10T06:00:00.000Z', tee: 'Yellow',
  },
  {
    id: '66f0a1c2e4b0a1b2c3d4e004', email: 'priya.r@example.com', recent: 3, displayName: 'Priya R.', home: 'tauranga',
    courses: ['tauranga', 'omanu'], prefs: { units: 'imperial', theme: 'dark', showOnLeaderboard: true },
    rounds: 12, nineHole: 0, overParStart: 0.95, overParEnd: 0.85, power: 0.92, fairway: 0.55, missLeft: 0.45, gpsShare: 0.75,
    device: { deviceId: 'app-c0ffee', platform: 'android' }, joined: '2026-01-15T07:00:00.000Z', tee: 'Yellow',
  },
  {
    // Has opted out of the leaderboard, to show the privacy setting working.
    id: '66f0a1c2e4b0a1b2c3d4e005', email: 'hemi.t@example.com', recent: 3, displayName: 'Hemi T.', home: 'omanu',
    courses: ['omanu'], prefs: { units: 'metric', theme: 'light', showOnLeaderboard: false },
    rounds: 10, nineHole: 0, overParStart: 0.75, overParEnd: 0.65, power: 1.05, fairway: 0.5, missLeft: 0.55, gpsShare: 0.4,
    joined: '2026-03-01T06:00:00.000Z', tee: 'Yellow',
  },
  {
    // Only 2 rounds: below the leaderboard's 3-round minimum.
    id: '66f0a1c2e4b0a1b2c3d4e006', email: 'lucy.b@example.com', displayName: 'Lucy B.', home: 'muni',
    courses: ['muni', 'omanu'], prefs: { units: 'metric', theme: 'light', showOnLeaderboard: true },
    rounds: 2, nineHole: 0, overParStart: 1.6, overParEnd: 1.55, power: 0.8, fairway: 0.35, missLeft: 0.5, gpsShare: 1,
    joined: '2026-10-01T06:00:00.000Z', tee: 'Yellow', recentOnly: true,
  },
  {
    // A brand new account with no rounds, for testing the empty states.
    id: '66f0a1c2e4b0a1b2c3d4e007', email: 'new.golfer@example.com', displayName: 'New Golfer', home: null,
    courses: [], prefs: { units: 'metric', theme: 'light', showOnLeaderboard: true },
    rounds: 0, nineHole: 0, joined: '2026-11-03T06:00:00.000Z',
  },
];

// ---------- round simulation ----------
function clubFor(distance, distances, allowDriver) {
  let best = null;
  for (const [code, avg] of Object.entries(distances)) {
    if (code === 'driver' && !allowDriver) continue;
    if (!best || Math.abs(avg - distance) < Math.abs(distances[best] - distance)) best = code;
  }
  return best;
}

function holeScore(par, overPar) {
  let d = Math.round(normal(overPar, 0.95));
  d = Math.max(-1, Math.min(d, 5));
  return Math.max(2, Math.min(par + d, 12));
}

function puttsFor(strokes) {
  const r = rand();
  let p = r < 0.2 ? 1 : r < 0.86 ? 2 : 3;
  if (strokes <= 2) p = 1;
  return Math.min(p, strokes - 1);
}

// Fewest full shots a golfer needs to reach the green on a hole this long.
function minFullShots(length, distances) {
  return Math.max(1, Math.ceil(length / (distances.driver * 1.04)));
}

function missResult(golfer, bunkerChance) {
  if (chance(bunkerChance)) return 'bunker';
  return chance(golfer.missLeft) ? 'rough-left' : 'rough-right';
}

// Lays out the full shots of one hole along its line. Extra strokes beyond
// the full swings needed become chips around the green (under 30 m, which the
// API leaves out of club averages) or a mishit with the planned club.
function simulateShots({ par, length, fullShots, golfer, distances, tee, bearing, hasPenalty, fairwayHit }) {
  const needed = Math.min(fullShots, minFullShots(length, distances));
  const extra = fullShots - needed;
  const chips = extra - Math.floor(extra * 0.2);
  const duffs = extra - chips;

  // Full-swing distances that add up to the hole length (less a little for chips).
  const approachLeft = chips > 0 ? between(8, 22) : 0;
  let toCover = length - approachLeft;
  const plan = [];
  for (let k = 0; k < needed; k++) {
    const left = needed - k;
    let d;
    if (left === 1) d = toCover * between(0.97, 1.0);
    else if (k === 0 && par >= 4) d = Math.min(distances.driver * normal(1, 0.07), toCover - 60 * (left - 1));
    else d = Math.min(distances['3w'] * normal(1, 0.06), toCover / left * between(1.0, 1.15));
    d = Math.max(30, Math.round(d));
    plan.push({ kind: 'full', d });
    toCover -= d;
  }
  // Mishits go in after the first shot; chips at the end.
  for (let i = 0; i < duffs; i++) plan.splice(Math.min(1, plan.length), 0, { kind: 'duff' });
  for (let i = 0; i < chips; i++) plan.push({ kind: 'chip' });

  const shots = [];
  let pos = tee;
  plan.forEach((step, idx) => {
    const k = idx + 1;
    const isLast = k === plan.length;
    let d;
    let club;
    if (step.kind === 'full') {
      d = step.d;
      club = k === 1 && par >= 4 && d > distances['3w'] * 0.96 ? 'driver' : clubFor(d, distances, false);
    } else if (step.kind === 'duff') {
      club = clubFor(between(110, 170), distances, false);
      d = Math.round(distances[club] * between(0.6, 0.82));
    } else {
      club = pick(['lw', 'sw', 'pw'].filter((c) => distances[c]));
      d = Math.round(isLast ? approachLeft / Math.max(chips, 1) : between(5, 20));
    }

    let result;
    if (isLast) result = 'green';
    else if (hasPenalty && k === 1) result = 'penalty';
    else if (k === 1 && par >= 4) result = fairwayHit ? 'fairway' : missResult(golfer, 0.12);
    else if (k === 1) result = missResult(golfer, 0.25);
    else if (step.kind === 'chip') result = chance(0.6) ? 'green' : missResult(golfer, 0.3);
    else result = chance(0.6) ? 'fairway' : missResult(golfer, 0.2);

    const lateral = result === 'rough-left' ? -9 : result === 'rough-right' ? 9 : result === 'bunker' ? pick([-5, 5]) : between(-2, 2);
    const end = offset(pos, Math.max(d, 2), bearing + lateral);
    shots.push({
      seq: k,
      club,
      start: { lat: +pos.lat.toFixed(6), lng: +pos.lng.toFixed(6) },
      end: { lat: +end.lat.toFixed(6), lng: +end.lng.toFixed(6) },
      result,
    });
    pos = end;
  });
  return shots;
}

function simulateRound({ golfer, layoutKey, nine, playedAt, overPar, withShots, target, floor }) {
  const L = LAYOUTS[layoutKey];
  const bag = new Set(golfer.bag || DEFAULT_BAG);
  const distances = Object.fromEntries(
    Object.entries(BASE_DISTANCES)
      .filter(([c]) => bag.has(c))
      .map(([c, m]) => [c, m * golfer.power]),
  );
  const tee = golfer.tee && L.tees.some((t) => t.name === golfer.tee) ? golfer.tee : L.tees[0].name;
  const count = nine || L.par.length === 9 ? 9 : 18;
  const startAt = nine && L.par.length === 18 && chance(0.5) ? 9 : 0;

  const holes = [];
  for (let i = startAt; i < startAt + count; i++) {
    const par = L.par[i];
    const length = holeLength(L, i, tee);
    const minFull = minFullShots(length, distances);
    let strokes = holeScore(par, overPar);
    let putts = puttsFor(strokes);
    // A 2-putt birdie on a 450 m par 5 is not possible for most golfers.
    while (strokes - putts < minFull) {
      if (putts > 1 && chance(0.7)) putts -= 1;
      else strokes += 1;
    }
    holes.push({ index: i, number: i + 1, par, length, minFull, strokes, putts, penalties: 0 });
  }

  const total = (key) => holes.reduce((s, h) => s + h[key], 0);

  // Hit the exact totals of the design's example rounds.
  if (target) {
    let guard = 0;
    while (total('strokes') !== target.strokes && guard++ < 5000) {
      const h = pick(holes);
      const next = h.strokes + (total('strokes') < target.strokes ? 1 : -1);
      if (next >= h.par - 1 && next <= h.par + 4 && next - h.putts >= h.minFull) h.strokes = next;
    }
    guard = 0;
    while (total('putts') !== target.putts && guard++ < 5000) {
      const h = pick(holes);
      const next = h.putts + (total('putts') < target.putts ? 1 : -1);
      if (next >= 1 && next <= 3 && h.strokes - next >= h.minFull) h.putts = next;
    }
  }

  // Keep the design's example round as the golfer's personal best.
  if (floor && count === 18) {
    let guard = 0;
    while (total('strokes') < floor && guard++ < 500) {
      const h = pick(holes);
      if (h.strokes < h.par + 4) h.strokes += 1;
    }
  }

  return {
    tee,
    playedAt,
    holes: holes.map((h) => {
      if (h.strokes - h.putts - h.minFull >= 1 && chance(0.06)) h.penalties = 1;
      const hole = {
        number: h.number,
        par: h.par,
        distanceMetres: h.length,
        strokes: h.strokes,
        putts: h.putts,
        penalties: h.penalties,
      };
      const fullShots = h.strokes - h.putts - h.penalties;
      const fairwayHit = h.par >= 4 ? chance(golfer.fairway) && h.penalties === 0 : undefined;
      if (h.par >= 4) hole.fairwayHit = fairwayHit;

      if (withShots && fullShots >= 1) {
        const bearing = (h.number * 47) % 360;
        const teePos = offset(L.base, 120 + (h.number % 6) * 90, (h.number * 61) % 360);
        hole.shots = simulateShots({
          par: h.par, length: h.length, fullShots, golfer, distances, tee: teePos, bearing,
          hasPenalty: h.penalties > 0, fairwayHit,
        });
        hole.teeClub = hole.shots[0].club;
      } else {
        hole.teeClub = h.par >= 4 ? (chance(0.85) ? 'driver' : '3w') : clubFor(h.length, distances, false);
      }
      return hole;
    }),
  };
}

// ---------- dates ----------
// Rounds spread across the year, with each regular golfer's last four in the
// final four weeks, so the "month" leaderboard has golfers on it.
function roundDates(golfer, total) {
  const end = new Date('2026-11-03T21:00:00.000Z').getTime();
  const recentStart = new Date('2026-10-08T00:00:00.000Z').getTime();
  const start = golfer.recentOnly
    ? recentStart
    : Math.max(new Date(golfer.joined).getTime() + 2 * 864e5, new Date('2025-11-01T00:00:00.000Z').getTime());
  const recent = golfer.recentOnly ? total : Math.min(golfer.recent || 3, total);
  const older = total - recent;
  const times = [];
  for (let i = 0; i < older; i++) {
    times.push(start + ((recentStart - 3 * 864e5 - start) * (i + 0.5)) / older + between(-2, 2) * 864e5);
  }
  for (let i = 0; i < recent; i++) {
    times.push(recentStart + ((end - recentStart) * (i + 0.5)) / recent + between(-1.5, 1.5) * 864e5);
  }
  return times
    .map((t) => {
      const d = new Date(Math.min(t, end));
      // NZ morning tee times (UTC evening or early morning).
      d.setUTCHours(pick([19, 20, 21, 22, 0, 1]), pick([0, 10, 20, 30, 40, 50]), 0, 0);
      return d;
    })
    .sort((a, b) => a - b);
}

// ---------- build ----------
async function main() {
  const users = [];
  const courses = [];
  const rounds = [];
  const clubs = [];

  for (const g of GOLFERS) {
    const userId = oid(g.id);
    const joined = new Date(g.joined);
    const myCourses = new Map();
    for (const key of g.courses) {
      let doc;
      if (g.id === '66f0a1c2e4b0a1b2c3d4e5f6' && key === 'omanu') {
        doc = courseDoc(key, userId, joined);
        doc._id = oid('66e9b7d1a2c3d4e5f6a7b8c9');
      } else if (g.id === '66f0a1c2e4b0a1b2c3d4e5f6' && key === 'tauranga') {
        doc = courseDoc(key, userId, joined);
        doc._id = oid('66e9b7d1a2c3d4e5f6a7b8ca');
      } else {
        doc = courseDoc(key, userId, joined);
      }
      myCourses.set(key, doc);
      courses.push(doc);
    }

    const dates = roundDates(g, g.rounds);
    const myRounds = [];
    const nineIdx = new Set();
    while (nineIdx.size < g.nineHole) nineIdx.add(Math.floor(rand() * Math.max(1, g.rounds - (g.recent || 3))));

    dates.forEach((playedAt, i) => {
      const progress = g.rounds > 1 ? i / (g.rounds - 1) : 1;
      const overPar = g.overParStart + (g.overParEnd - g.overParStart) * progress;
      // 18-hole rounds: mostly the home course. 9-hole rounds: the muni if
      // the golfer has it, otherwise the front or back nine of a full course.
      const fullCourses = g.courses.filter((k) => LAYOUTS[k].par.length === 18);
      let nine = nineIdx.has(i);
      let layoutKey;
      if (nine && g.courses.includes('muni')) layoutKey = 'muni';
      else if (fullCourses.includes(g.home) && chance(0.6)) layoutKey = g.home;
      else layoutKey = pick(fullCourses);

      let id = nextRoundId();
      let clientRoundId = uuid();
      let target = null;
      let notes;
      // The two example rounds from the A2 design documents.
      if (g.id === '66f0a1c2e4b0a1b2c3d4e5f6' && i === g.rounds - 8) {
        playedAt = new Date('2026-09-06T01:40:00.000Z');
        layoutKey = 'tauranga';
        nine = false;
        id = oid('66ea41b7b1a2c3d4e5f60611');
        target = { strokes: 89, putts: 34 };
      }
      if (g.id === '66f0a1c2e4b0a1b2c3d4e5f6' && i === g.rounds - 7) {
        playedAt = new Date('2026-09-12T02:10:00.000Z');
        layoutKey = 'omanu';
        nine = false;
        id = oid('66f2c9e0b1a2c3d4e5f60718');
        clientRoundId = 'a3f1c9e2-5b7d-4e8a-9c1f-2d6b8e4a7c10';
        target = { strokes: 84, putts: 31 };
        notes = 'Windy back nine';
      }
      const manual = !target && chance(0.1); // typed in on the website, no GPS
      const sim = simulateRound({
        golfer: g,
        layoutKey,
        nine,
        playedAt,
        overPar,
        withShots: !manual && (target ? true : chance(g.gpsShare)),
        target,
        floor: g.id === '66f0a1c2e4b0a1b2c3d4e5f6' && !target ? 85 : null,
      });
      const stored = sim.holes.map(toStoredHole).sort((a, b) => a.number - b.number);
      const course = myCourses.get(layoutKey);
      const syncedAt = new Date(playedAt.getTime() + between(3.5, 30) * 3600 * 1000);
      const round = {
        _id: id,
        userId,
        source: manual ? 'web' : 'mobile-app',
        course: { courseId: course._id, name: course.name, par: roundPar(stored) },
        tee: sim.tee,
        playedAt,
        holesPlayed: stored.length,
        totals: roundTotals(stored),
        holes: stored,
        createdAt: syncedAt,
        updatedAt: syncedAt,
      };
      if (!manual) round.clientRoundId = clientRoundId;
      if (notes) round.notes = notes;
      else if (chance(0.12)) round.notes = pick(['Strong nor-easterly all day', 'Greens were quick after the rain', 'Played with the Saturday group', 'Putting felt good', 'Lost two balls on the back nine', 'New driver shaft']);
      myRounds.push(round);
    });

    myRounds.sort((a, b) => b.playedAt - a.playedAt);
    rounds.push(...myRounds);

    const lastSync = myRounds.filter((r) => r.source === 'mobile-app').map((r) => r.createdAt).sort((a, b) => b - a)[0];
    const snapshot = buildSnapshot(myRounds, ratingLookup([...myCourses.values()]));
    users.push({
      _id: userId,
      email: g.email,
      passwordHash: await bcrypt.hash(PASSWORD, 12),
      displayName: g.displayName,
      role: 'golfer',
      homeCourseId: g.home ? myCourses.get(g.home)._id : null,
      preferences: g.prefs,
      statsSnapshot: snapshot,
      devices: g.device && lastSync ? [{ ...g.device, lastSyncAt: lastSync }] : [],
      createdAt: joined,
      updatedAt: myRounds[0] ? myRounds[0].createdAt : joined,
    });

    if (g.rounds > 0 || g.bag) {
      const bagCodes = g.bag || DEFAULT_BAG;
      const bag = mergeBag(
        bagCodes.map((code) => ({ code, label: labelFor(code), inBag: true })),
        computeClubStats(myRounds),
      );
      clubs.push({
        _id: g.clubsId ? oid(g.clubsId) : new ObjectId(`66f0a1c2e4b0a1b2c3d4e6${(clubs.length + 1).toString(16).padStart(2, '0')}`),
        userId,
        clubs: bag,
        recalculatedAt: myRounds[0] ? myRounds[0].createdAt : joined,
        createdAt: joined,
        updatedAt: myRounds[0] ? myRounds[0].createdAt : joined,
      });
    }
  }

  fs.mkdirSync(OUT, { recursive: true });
  const write = (name, docs) => {
    fs.writeFileSync(path.join(OUT, `${name}.json`), `${EJSON.stringify(docs, null, 2, { relaxed: true })}\n`);
    console.log(`${name}.json  ${docs.length} documents`);
  };
  write('users', users);
  write('courses', courses);
  write('rounds', rounds);
  write('clubs', clubs);
  console.log(`Generated for ${GENERATED_AT.toISOString().slice(0, 10)}. Test password for every account: ${PASSWORD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
