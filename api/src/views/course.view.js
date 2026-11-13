// JSON shapes for courses (A2 section 6.3.3).
const { fromPoint } = require('../services/calc/geo');

function par(course) {
  if (!course.holes || course.holes.length !== 18) return null;
  return course.holes.reduce((s, h) => s + h.par, 0);
}

function listItem(c) {
  return {
    id: String(c._id),
    name: c.name,
    region: c.region ?? null,
    holes: c.holes?.length ?? 0,
    par: par(c),
  };
}

function metresObject(m) {
  if (!m) return undefined;
  return m instanceof Map ? Object.fromEntries(m) : m;
}

// One course "with its tees and holes" (A2 Table 7).
function detail(c) {
  return {
    id: String(c._id),
    name: c.name,
    region: c.region ?? null,
    par: par(c),
    location: c.location ? fromPoint(c.location) : null,
    tees: (c.tees || []).map((t) => ({
      name: t.name,
      par: t.par ?? null,
      totalMetres: t.totalMetres ?? null,
      courseRating: t.courseRating ?? null,
      slopeRating: t.slopeRating ?? null,
    })),
    holes: [...(c.holes || [])]
      .sort((a, b) => a.number - b.number)
      .map((h) => ({
        number: h.number,
        par: h.par,
        strokeIndex: h.strokeIndex ?? null,
        metres: metresObject(h.metres) ?? {},
      })),
    createdAt: c.createdAt,
    links: { self: `/api/courses/${c._id}`, rounds: `/api/rounds?courseId=${c._id}` },
  };
}

module.exports = { listItem, detail, par };
