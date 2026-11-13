// JSON shapes for rounds (A2 section 6.3.2). GPS points are stored as GeoJSON
// [lng, lat] and returned to clients as { lat, lng }.
const { fromPoint } = require('../services/calc/geo');

function totals(t, { full = true } = {}) {
  const out = { strokes: t.strokes, toPar: t.toPar, putts: t.putts };
  if (full) {
    out.fairwaysHit = t.fairwaysHit;
    out.fairwaysPossible = t.fairwaysPossible;
    out.greensInRegulation = t.greensInRegulation;
  }
  return out;
}

function shot(s) {
  const out = { seq: s.seq };
  if (s.club) out.club = s.club;
  if (s.start) out.start = fromPoint(s.start);
  if (s.end) out.end = fromPoint(s.end);
  if (typeof s.distanceMetres === 'number') out.distanceMetres = s.distanceMetres;
  if (s.result) out.result = s.result;
  return out;
}

function hole(h) {
  const out = {
    number: h.number,
    par: h.par,
    ...(typeof h.distanceMetres === 'number' ? { distanceMetres: h.distanceMetres } : {}),
    strokes: h.strokes,
    putts: h.putts,
    penalties: h.penalties ?? 0,
  };
  if (h.teeClub) out.teeClub = h.teeClub;
  if (typeof h.fairwayHit === 'boolean') out.fairwayHit = h.fairwayHit;
  if (typeof h.greenInRegulation === 'boolean') out.greenInRegulation = h.greenInRegulation;
  if (h.shots && h.shots.length) out.shots = h.shots.map(shot);
  return out;
}

// GET /api/rounds list item (no hole data).
function summary(r, { isPersonalBest = false } = {}) {
  const id = String(r._id);
  return {
    id,
    playedAt: r.playedAt,
    course: { id: String(r.course.courseId), name: r.course.name },
    tee: r.tee ?? null,
    holesPlayed: r.holesPlayed,
    totals: totals(r.totals),
    isPersonalBest,
    links: { self: `/api/rounds/${id}` },
  };
}

// GET /api/rounds/:roundId (and PATCH response).
function detail(r) {
  const id = String(r._id);
  const courseId = String(r.course.courseId);
  return {
    id,
    clientRoundId: r.clientRoundId ?? null,
    source: r.source,
    playedAt: r.playedAt,
    syncedAt: r.createdAt,
    course: { id: courseId, name: r.course.name, par: r.course.par },
    tee: r.tee ?? null,
    holesPlayed: r.holesPlayed,
    totals: totals(r.totals),
    holes: [...r.holes].sort((a, b) => a.number - b.number).map(hole),
    notes: r.notes ?? null,
    links: { self: `/api/rounds/${id}`, course: `/api/courses/${courseId}` },
  };
}

// POST /api/rounds response.
function created(r, duplicate) {
  const id = String(r._id);
  return {
    id,
    clientRoundId: r.clientRoundId ?? null,
    totals: totals(r.totals, { full: false }),
    duplicate,
    links: { self: `/api/rounds/${id}` },
  };
}

module.exports = { summary, detail, created, hole, shot };
