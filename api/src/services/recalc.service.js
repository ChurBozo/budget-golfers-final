// After a round is created, changed or deleted, the golfer's stats snapshot
// and club averages are recalculated (A2 Table 7: POST, PATCH, DELETE rounds).
const { User, Round, Course } = require('../models');
const { buildSnapshot } = require('./calc/snapshot');
const { ratingLookup } = require('./courses.service');
const clubsService = require('./clubs.service');

async function snapshotFor(userId) {
  const [rounds, courses] = await Promise.all([
    Round.find({ userId }, { holes: 1, holesPlayed: 1, totals: 1, playedAt: 1, course: 1, tee: 1 })
      .sort({ playedAt: -1 })
      .lean(),
    Course.find({ createdBy: userId }, { tees: 1 }).lean(),
  ]);
  return buildSnapshot(rounds, ratingLookup(courses));
}

async function afterRoundChange(userId) {
  const snapshot = await snapshotFor(userId);
  await Promise.all([
    User.updateOne({ _id: userId }, { $set: { statsSnapshot: snapshot } }),
    clubsService.recalculate(userId),
  ]);
  return snapshot;
}

module.exports = { afterRoundChange, snapshotFor };
