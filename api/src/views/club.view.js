// JSON shape for GET and PUT /api/clubs/:userId (A2 section 6.3.5).
const { MINIMUM_SHOTS } = require('../services/calc/clubStats');

function bag(doc, units) {
  return {
    userId: String(doc.userId),
    units,
    minimumShots: MINIMUM_SHOTS,
    clubs: doc.clubs.map((c) => {
      const s = c.stats || {};
      return {
        code: c.code,
        label: c.label,
        inBag: c.inBag,
        shotCount: s.shotCount ?? 0,
        averageMetres: s.averageMetres ?? null,
        longestMetres: s.longestMetres ?? null,
        spreadMetres: s.spreadMetres ?? null,
        enoughData: (s.shotCount ?? 0) >= MINIMUM_SHOTS,
      };
    }),
    updatedAt: doc.recalculatedAt || doc.updatedAt || null,
  };
}

module.exports = { bag };
