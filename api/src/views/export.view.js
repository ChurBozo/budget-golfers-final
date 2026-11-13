// "Download my data" (GET /api/users/:userId/export?format=csv|json).
const userView = require('./user.view');
const roundView = require('./round.view');
const courseView = require('./course.view');
const clubView = require('./club.view');

function json({ user, homeCourse, rounds, courses, bag }) {
  const profile = userView.me(user, homeCourse);
  delete profile.links;
  return {
    exportedAt: new Date().toISOString(),
    user: profile,
    courses: courses.map(courseView.detail).map(({ links, ...c }) => c),
    rounds: rounds.map(roundView.detail).map(({ links, ...r }) => r),
    clubs: clubView.bag(bag, user.preferences?.units || 'metric').clubs,
  };
}

// Quotes a CSV cell, and stops spreadsheet formula injection by prefixing
// cells that start with = + - @ (OWASP, n.d.).
function cell(value) {
  if (value === null || value === undefined) return '';
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s) && typeof value === 'string') s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function line(values) {
  return values.map(cell).join(',');
}

// One row per hole, then a second table with the club averages.
function csv({ user, rounds, bag }) {
  const out = [];
  out.push(
    line([
      'roundId', 'playedAt', 'course', 'tee', 'holesPlayed', 'roundStrokes', 'roundToPar', 'roundPutts', 'notes',
      'hole', 'par', 'distanceMetres', 'strokes', 'putts', 'penalties', 'teeClub', 'fairwayHit', 'greenInRegulation', 'shots',
    ]),
  );
  for (const r of rounds) {
    for (const h of [...r.holes].sort((a, b) => a.number - b.number)) {
      out.push(
        line([
          r._id, r.playedAt, r.course.name, r.tee, r.holesPlayed, r.totals.strokes, r.totals.toPar, r.totals.putts, r.notes,
          h.number, h.par, h.distanceMetres, h.strokes, h.putts, h.penalties ?? 0, h.teeClub, h.fairwayHit, h.greenInRegulation,
          (h.shots || []).length,
        ]),
      );
    }
  }
  out.push('');
  out.push(line(['club', 'label', 'inBag', 'shotCount', 'averageMetres', 'longestMetres', 'spreadMetres']));
  for (const c of clubView.bag(bag, user.preferences?.units || 'metric').clubs) {
    out.push(line([c.code, c.label, c.inBag, c.shotCount, c.averageMetres, c.longestMetres, c.spreadMetres]));
  }
  // A byte order mark so Excel opens names like "Ōmanu" correctly.
  return `﻿${out.join('\r\n')}\r\n`;
}

module.exports = { json, csv, cell };
