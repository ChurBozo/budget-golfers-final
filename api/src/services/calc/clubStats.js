// Club distances from every measured shot (A2: GET /api/clubs/:userId).
// A shot is measured when it has a distance, which the server works out from
// its GPS start and end points. A club needs MINIMUM_SHOTS measured shots
// before its average is shown, so one lucky drive does not skew it.
// Chips and short pitches (under 30 m) are left out: they say nothing about
// how far the club goes with a full swing.
const { mean, stdev, round0 } = require('./math');
const { labelFor, order, isStandard } = require('../../utils/clubCodes');

const MINIMUM_SHOTS = 5;
const MIN_SHOT_METRES = 30;

// rounds -> Map(code -> { shotCount, averageMetres, longestMetres, spreadMetres })
function computeClubStats(rounds) {
  const distances = new Map();
  for (const r of rounds) {
    for (const h of r.holes || []) {
      for (const s of h.shots || []) {
        if (!s.club || s.club === 'putter') continue;
        if (typeof s.distanceMetres !== 'number' || s.distanceMetres < MIN_SHOT_METRES) continue;
        if (!distances.has(s.club)) distances.set(s.club, []);
        distances.get(s.club).push(s.distanceMetres);
      }
    }
  }
  const out = new Map();
  for (const [code, d] of distances) {
    const enough = d.length >= MINIMUM_SHOTS;
    out.set(code, {
      shotCount: d.length,
      averageMetres: enough ? round0(mean(d)) : null,
      longestMetres: enough ? round0(Math.max(...d)) : null,
      spreadMetres: enough ? round0(stdev(d)) : null,
    });
  }
  return out;
}

const EMPTY = { shotCount: 0, averageMetres: null, longestMetres: null, spreadMetres: null };

// Puts fresh stats on the golfer's bag. Clubs that have shots but are not in
// the list are added with inBag false, so no recorded distance is lost.
function mergeBag(bagClubs, statsByCode) {
  const merged = bagClubs.map((c) => ({
    code: c.code,
    label: c.label || labelFor(c.code),
    inBag: c.inBag !== false,
    stats: { ...EMPTY, ...(statsByCode.get(c.code) || {}) },
  }));
  const listed = new Set(merged.map((c) => c.code));
  for (const [code, stats] of statsByCode) {
    if (listed.has(code)) continue;
    merged.push({ code, label: labelFor(code), inBag: false, stats: { ...EMPTY, ...stats } });
  }
  return sortClubs(merged);
}

function sortClubs(clubs) {
  return [...clubs].sort((a, b) => {
    const diff = order(a.code) - order(b.code);
    if (diff !== 0) return diff;
    return a.label.localeCompare(b.label);
  });
}

module.exports = { MINIMUM_SHOTS, MIN_SHOT_METRES, computeClubStats, mergeBag, sortClubs, isStandard };
