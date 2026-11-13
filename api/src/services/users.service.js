// The signed-in golfer's account: profile, preferences, export and deletion.
const { User, Round, Course, Club } = require('../models');
const AppError = require('../utils/AppError');
const clubsService = require('./clubs.service');

async function getUser(userId) {
  const user = await User.findById(userId);
  // A valid token for an account that has since been deleted.
  if (!user) throw AppError.unauthenticated('This account no longer exists. Please sign in again.');
  return user;
}

async function homeCourseOf(user) {
  if (!user.homeCourseId) return null;
  return Course.findOne({ _id: user.homeCourseId, createdBy: user._id }, { name: 1 }).lean();
}

async function getMe(userId) {
  const user = await getUser(userId);
  return { user, homeCourse: await homeCourseOf(user) };
}

async function update(userId, patch) {
  const user = await getUser(userId);

  if (patch.displayName !== undefined) user.displayName = patch.displayName;
  if (patch.homeCourseId !== undefined) {
    if (patch.homeCourseId === null) {
      user.homeCourseId = null;
    } else {
      const owned = await Course.exists({ _id: patch.homeCourseId, createdBy: userId });
      if (!owned) throw AppError.validation([{ field: 'homeCourseId', issue: 'is not one of your courses' }]);
      user.homeCourseId = patch.homeCourseId;
    }
  }
  if (patch.preferences) {
    for (const [key, value] of Object.entries(patch.preferences)) {
      if (value !== undefined) user.preferences[key] = value;
    }
  }
  await user.save();
  return { user, homeCourse: await homeCourseOf(user) };
}

// Deletes the account and everything stored for it.
async function remove(userId) {
  await getUser(userId);
  await Round.deleteMany({ userId });
  await Club.deleteMany({ userId });
  await Course.deleteMany({ createdBy: userId });
  await User.deleteOne({ _id: userId });
}

// Everything stored for the golfer: account, courses, rounds and club stats.
async function exportData(userId) {
  const user = await getUser(userId);
  const [rounds, courses, bag] = await Promise.all([
    Round.find({ userId }).sort({ playedAt: -1 }).lean(),
    Course.find({ createdBy: userId }).sort({ name: 1 }).lean(),
    clubsService.getOrCreate(userId),
  ]);
  return { user, homeCourse: await homeCourseOf(user), rounds, courses, bag };
}

module.exports = { getMe, update, remove, exportData };
