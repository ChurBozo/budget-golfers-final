// Database checks for the A3 evidence. Run with:
//   mongosh "mongodb://127.0.0.1:27017/budget_golfers" seed/check-database.mongosh.js
// (or paste the commands into mongosh / the MongoDB Compass shell one at a time)
const AROHA = ObjectId('66f0a1c2e4b0a1b2c3d4e5f6');
const step = (title, cmd) => { print(`\n> ${title}`); print(`  ${cmd}`); };

step('1. Collections', 'db.getCollectionNames()');
printjson(db.getCollectionNames().sort());

step('2. Documents in each collection', 'db.<collection>.countDocuments()');
printjson({ users: db.users.countDocuments(), courses: db.courses.countDocuments(), rounds: db.rounds.countDocuments(), clubs: db.clubs.countDocuments() });

step('3. Indexes (A2 Table 11)', 'db.<collection>.getIndexes()');
for (const c of ['users', 'rounds', 'courses', 'clubs']) {
  print(`  ${c}:`);
  db[c].getIndexes().forEach((i) => print(`    ${JSON.stringify(i.key)}${i.unique ? '  unique' : ''}${i.partialFilterExpression ? '  partial ' + JSON.stringify(i.partialFilterExpression) : ''}`));
}

step('4. One user (password hash hidden)', "db.users.findOne({ email: 'aroha.m@example.com' }, { passwordHash: 0 })");
printjson(db.users.findOne({ email: 'aroha.m@example.com' }, { passwordHash: 0 }));

step('5. Passwords are stored as bcrypt hashes', "db.users.find({}, { email: 1, passwordHash: 1 }).limit(3)");
db.users.find({}, { _id: 0, email: 1, passwordHash: 1 }).limit(3).forEach((u) => print(`  ${u.email.padEnd(22)} ${u.passwordHash.slice(0, 7)}... (${u.passwordHash.length} chars)`));

step('6. The A2 example round, first two holes', "db.rounds.findOne({ _id: ObjectId('66f2c9e0b1a2c3d4e5f60718') }, { holes: { $slice: 2 } })");
printjson(db.rounds.findOne({ _id: ObjectId('66f2c9e0b1a2c3d4e5f60718') }, { holes: { $slice: 2 } }));

step("7. Aroha's five most recent rounds (uses index userId_1_playedAt_-1)", "db.rounds.find({ userId: AROHA }, { playedAt: 1, 'course.name': 1, holesPlayed: 1, 'totals.strokes': 1 }).sort({ playedAt: -1 }).limit(5)");
db.rounds.find({ userId: AROHA }, { _id: 0, playedAt: 1, 'course.name': 1, holesPlayed: 1, 'totals.strokes': 1 }).sort({ playedAt: -1 }).limit(5)
  .forEach((r) => print(`  ${r.playedAt.toISOString().slice(0, 10)}  ${r.course.name.padEnd(20)} ${r.holesPlayed} holes  ${r.totals.strokes}`));
const plan = db.rounds.find({ userId: AROHA }).sort({ playedAt: -1 }).limit(5).explain('executionStats');
const ix = JSON.stringify(plan.queryPlanner.winningPlan).match(/"indexName":"([^"]+)"/);
print(`  index used: ${ix ? ix[1] : 'none'}; documents examined: ${plan.executionStats.totalDocsExamined}`);

step('8. Leaderboard aggregation (season, 18-hole rounds, at least 3)', 'db.rounds.aggregate([$match, $group, $match, $lookup, $sort])');
db.rounds.aggregate([
  { $match: { holesPlayed: 18, playedAt: { $gte: ISODate('2026-01-01') } } },
  { $group: { _id: '$userId', rounds: { $sum: 1 }, average: { $avg: '$totals.strokes' } } },
  { $match: { rounds: { $gte: 3 } } },
  { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
  { $unwind: '$u' },
  { $match: { 'u.preferences.showOnLeaderboard': true } },
  { $sort: { average: 1 } },
  { $project: { _id: 0, golfer: '$u.displayName', rounds: 1, average: { $round: ['$average', 1] } } },
]).forEach((r) => print(`  ${r.golfer.padEnd(10)} ${String(r.rounds).padStart(3)} rounds  average ${r.average}`));

step('9. Club distances for Aroha (clubs collection)', "db.clubs.findOne({ userId: AROHA }).clubs.slice(0, 5)");
db.clubs.findOne({ userId: AROHA }).clubs.slice(0, 5).forEach((c) => print(`  ${c.label.padEnd(8)} shots ${String(c.stats.shotCount).padStart(3)}  average ${c.stats.averageMetres} m  longest ${c.stats.longestMetres} m`));

step('10. Self-named course without a location', "db.courses.findOne({ name: 'Pāpāmoa Muni 9' }, { name: 1, slug: 1, location: 1, 'holes.par': 1 })");
printjson(db.courses.findOne({ name: 'Pāpāmoa Muni 9', createdBy: AROHA }, { _id: 0, name: 1, slug: 1, location: 1, 'holes.par': 1 }));

step('11. A repeat upload is blocked by the unique index', "db.rounds.insertOne({ userId: AROHA, clientRoundId: 'a3f1c9e2-5b7d-4e8a-9c1f-2d6b8e4a7c10' })");
try { db.rounds.insertOne({ userId: AROHA, clientRoundId: 'a3f1c9e2-5b7d-4e8a-9c1f-2d6b8e4a7c10' }); print('  inserted (unexpected)'); } catch (e) { print(`  refused: ${e.codeName || e.code} ${String(e.message).slice(0, 110)}`); }

step('12. A second account with the same email is blocked', "db.users.insertOne({ email: 'aroha.m@example.com' })");
try { db.users.insertOne({ email: 'aroha.m@example.com' }); print('  inserted (unexpected)'); } catch (e) { print(`  refused: ${e.codeName || e.code}`); }

step('13. Courses within 5 km of a point (2dsphere index, $geoNear)', "db.courses.aggregate([{ $geoNear: { near: [176.22, -37.67], maxDistance: 5000 } }, { $group: ... }])");
db.courses.aggregate([
  { $geoNear: { near: { type: 'Point', coordinates: [176.22, -37.67] }, distanceField: 'metres', maxDistance: 5000, spherical: true } },
  { $group: { _id: '$name', golfers: { $sum: 1 }, metres: { $min: '$metres' } } },
]).forEach((c) => print(`  ${c._id}: ${Math.round(c.metres)} m away, saved by ${c.golfers} golfers`));
print(`  courses with no location (self-named): ${db.courses.countDocuments({ location: { $exists: false } })}`);
