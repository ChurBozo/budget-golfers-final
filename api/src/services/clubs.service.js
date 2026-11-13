// The golfer's bag and the distance stats for each club.
const { Club, Round, User } = require('../models');
const { DEFAULT_BAG, labelFor, isStandard } = require('../utils/clubCodes');
const { computeClubStats, mergeBag } = require('./calc/clubStats');

function defaultClubs() {
  return DEFAULT_BAG.map((code) => ({ code, label: labelFor(code), inBag: true }));
}

// Every golfer gets the default 14-club bag until they send their own.
async function getOrCreate(userId) {
  let doc = await Club.findOne({ userId });
  if (!doc) {
    try {
      doc = await Club.create({ userId, clubs: defaultClubs() });
    } catch (err) {
      if (err.code !== 11000) throw err;
      doc = await Club.findOne({ userId });
    }
    await recalculate(userId, doc);
  }
  return doc;
}

// Recalculates every club's stats from all of the golfer's rounds.
async function recalculate(userId, existing) {
  const doc = existing || (await getOrCreate(userId));
  const rounds = await Round.find({ userId }, { 'holes.shots': 1 }).lean();
  doc.clubs = mergeBag(doc.clubs, computeClubStats(rounds));
  doc.recalculatedAt = new Date();
  await doc.save();
  return doc;
}

// PUT /api/clubs/:userId replaces the list. Stats are never taken from the
// client; they are recalculated straight after.
async function replace(userId, clubs) {
  const doc = await getOrCreate(userId);
  doc.clubs = clubs.map((c) => ({ code: c.code, label: c.label || labelFor(c.code), inBag: c.inBag }));
  return recalculate(userId, doc);
}

// "Shot club must be in the bag" (A2 Table 10): a club is accepted when it is a
// standard club code, or a custom club the golfer has added to their list.
async function unknownClubs(userId, codes) {
  const custom = codes.filter((c) => !isStandard(c));
  if (custom.length === 0) return [];
  const doc = await Club.findOne({ userId }, { 'clubs.code': 1 }).lean();
  const listed = new Set((doc?.clubs || []).map((c) => c.code));
  return custom.filter((c) => !listed.has(c));
}

// The golfer's distance units, returned with the bag so the client can convert.
async function unitsOf(userId) {
  const user = await User.findById(userId, { 'preferences.units': 1 }).lean();
  return user?.preferences?.units || 'metric';
}

module.exports = { getOrCreate, recalculate, replace, unknownClubs, defaultClubs, unitsOf };
