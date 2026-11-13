// Rounds: listing, reading, creating (including app sync), correcting and
// deleting. Every query includes the caller's userId, so a golfer can never
// read or change someone else's round (OWASP API1, broken object level auth).
const mongoose = require('mongoose');
const { Round } = require('../models');
const AppError = require('../utils/AppError');
const { normaliseHole, roundTotals, roundPar, greenInRegulation, fairwayPossible } = require('./calc/totals');
const { toPoint } = require('./calc/geo');
const coursesService = require('./courses.service');
const clubsService = require('./clubs.service');
const recalc = require('./recalc.service');
const authService = require('./auth.service');

const SORTS = {
  playedAt: { playedAt: 1 },
  '-playedAt': { playedAt: -1 },
  strokes: { 'totals.strokes': 1, playedAt: -1 },
  '-strokes': { 'totals.strokes': -1, playedAt: -1 },
};

function endOfDay(value) {
  // "2026-09-17" means up to the end of that day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T23:59:59.999Z`);
  return new Date(value);
}

async function personalBestIds(userId) {
  const best = await Round.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(String(userId)) } },
    { $sort: { 'totals.strokes': 1, playedAt: 1 } },
    { $group: { _id: '$holesPlayed', roundId: { $first: '$_id' } } },
  ]);
  return new Set(best.map((b) => String(b.roundId)));
}

async function list(userId, { from, to, courseId, holes, sort, page, limit }) {
  const filter = { userId };
  if (from || to) {
    filter.playedAt = {};
    if (from) filter.playedAt.$gte = new Date(from);
    if (to) filter.playedAt.$lte = endOfDay(to);
  }
  if (courseId) filter['course.courseId'] = courseId;
  if (holes) filter.holesPlayed = holes;

  const [items, total, bests] = await Promise.all([
    Round.find(filter, { holes: 0 })
      .sort(SORTS[sort])
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Round.countDocuments(filter),
    personalBestIds(userId),
  ]);
  return { items, total, bests };
}

// 404 when the round does not exist or is someone else's, so its existence
// is not revealed (A2 Table 8).
async function getOwned(userId, roundId) {
  const round = await Round.findOne({ _id: roundId, userId });
  if (!round) throw AppError.notFound('Round not found.');
  return round;
}

function clubIssues(holes, unknown) {
  if (unknown.length === 0) return [];
  const bad = new Set(unknown);
  const details = [];
  holes.forEach((h, i) => {
    if (h.teeClub && bad.has(h.teeClub)) details.push({ field: `holes[${i}].teeClub`, issue: 'is not in your bag' });
    (h.shots || []).forEach((s, j) => {
      if (s.club && bad.has(s.club)) details.push({ field: `holes[${i}].shots[${j}].club`, issue: 'is not in your bag' });
    });
  });
  return details;
}

function clubCodes(holes) {
  const codes = new Set();
  for (const h of holes) {
    if (h.teeClub) codes.add(h.teeClub);
    for (const s of h.shots || []) if (s.club) codes.add(s.club);
  }
  return [...codes];
}

// API hole ({ lat, lng } points) -> stored hole (GeoJSON points).
function toStoredHole(apiHole) {
  const h = normaliseHole(apiHole);
  if (h.shots) {
    h.shots = h.shots.map((s) => {
      const shot = { ...s };
      if (s.start) shot.start = toPoint(s.start);
      if (s.end) shot.end = toPoint(s.end);
      for (const key of Object.keys(shot)) if (shot[key] === null || shot[key] === undefined) delete shot[key];
      return shot;
    });
  }
  return h;
}

async function resolveCourse(userId, body) {
  if (body.courseId) {
    try {
      return await coursesService.getOwned(userId, body.courseId);
    } catch {
      throw AppError.validation([{ field: 'courseId', issue: 'is not one of your courses' }]);
    }
  }
  return coursesService.findOrCreate(userId, body.course.name);
}

// POST /api/rounds. Returns { round, duplicate }.
// If the app retries an upload, the clientRoundId matches the round already
// saved and that round is returned with duplicate: true (A2 section 6.6).
async function create(userId, body, device) {
  if (body.clientRoundId) {
    const existing = await Round.findOne({ userId, clientRoundId: body.clientRoundId });
    if (existing) return { round: existing, duplicate: true };
  }

  const course = await resolveCourse(userId, body);
  const problems = clubIssues(body.holes, await clubsService.unknownClubs(userId, clubCodes(body.holes)));
  if (problems.length) throw AppError.validation(problems);

  const holes = body.holes.map(toStoredHole).sort((a, b) => a.number - b.number);
  const doc = {
    userId,
    source: body.source,
    course: { courseId: course._id, name: course.name, par: roundPar(holes) },
    playedAt: body.playedAt,
    holesPlayed: holes.length,
    totals: roundTotals(holes),
    holes,
  };
  if (body.clientRoundId) doc.clientRoundId = body.clientRoundId;
  if (body.tee) doc.tee = body.tee;
  if (body.notes) doc.notes = body.notes;

  let round;
  try {
    round = await Round.create(doc);
  } catch (err) {
    if (err.code === 11000 && body.clientRoundId) {
      // Two copies of the same upload arrived at the same moment.
      const existing = await Round.findOne({ userId, clientRoundId: body.clientRoundId });
      if (existing) return { round: existing, duplicate: true };
    }
    throw err;
  }

  await coursesService.learnHoles(course, body.holes, body.tee);
  await recalc.afterRoundChange(userId);
  if (device) await authService.rememberDevice(userId, device, new Date());
  return { round, duplicate: false };
}

// PATCH /api/rounds/:roundId: correct scores, putts, tee or notes.
async function update(userId, roundId, patch) {
  const round = await getOwned(userId, roundId);

  if (patch.notes !== undefined) round.notes = patch.notes || undefined;
  if (patch.tee !== undefined) round.tee = patch.tee || undefined;
  if (patch.playedAt) round.playedAt = patch.playedAt;

  if (patch.holes) {
    const details = [];
    patch.holes.forEach((p, i) => {
      const hole = round.holes.find((h) => h.number === p.number);
      if (!hole) {
        details.push({ field: `holes[${i}].number`, issue: 'is not a hole in this round' });
        return;
      }
      const scoreChanged = ['par', 'strokes', 'putts'].some((k) => p[k] !== undefined);
      for (const key of ['par', 'strokes', 'putts', 'penalties']) {
        if (p[key] !== undefined) hole[key] = p[key];
      }
      if (p.teeClub !== undefined) hole.teeClub = p.teeClub || undefined;
      if (p.fairwayHit !== undefined) hole.fairwayHit = p.fairwayHit ?? undefined;
      if (!fairwayPossible(hole)) hole.fairwayHit = undefined;
      if (p.greenInRegulation !== undefined && p.greenInRegulation !== null) {
        hole.greenInRegulation = p.greenInRegulation;
      } else if (scoreChanged || p.greenInRegulation === null) {
        hole.greenInRegulation = greenInRegulation(hole);
      }
      if (hole.putts > hole.strokes) {
        details.push({ field: `holes[${i}].putts`, issue: 'must be between 0 and strokes' });
      }
    });
    const unknown = await clubsService.unknownClubs(
      userId,
      patch.holes.map((p) => p.teeClub).filter(Boolean),
    );
    patch.holes.forEach((p, i) => {
      if (p.teeClub && unknown.includes(p.teeClub)) details.push({ field: `holes[${i}].teeClub`, issue: 'is not in your bag' });
    });
    if (details.length) throw AppError.validation(details);
  }

  const plainHoles = round.holes.map((h) => h.toObject());
  round.totals = roundTotals(plainHoles);
  round.course.par = roundPar(plainHoles);
  await round.save();
  await recalc.afterRoundChange(userId);
  return round;
}

async function remove(userId, roundId) {
  const res = await Round.deleteOne({ _id: roundId, userId });
  if (res.deletedCount === 0) throw AppError.notFound('Round not found.');
  await recalc.afterRoundChange(userId);
}

module.exports = { list, getOwned, create, update, remove, toStoredHole, SORTS };
