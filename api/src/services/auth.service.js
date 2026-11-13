// Accounts and tokens. Passwords are hashed with bcrypt (cost 12) and tokens
// are signed JWTs holding only the user id (A2 section 6.5).
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const env = require('../config/env');
const { User } = require('../models');
const AppError = require('../utils/AppError');
const coursesService = require('./courses.service');

// A real hash to compare against when the email is unknown, so a wrong email
// takes as long as a wrong password and does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 4);

function hashPassword(password) {
  return bcrypt.hash(password, env.bcryptCost);
}

function signToken(userId, client = 'web') {
  const expiresIn = client === 'mobile-app' ? env.jwtAppExpiresIn : env.jwtExpiresIn;
  const token = jwt.sign({}, env.jwtSecret, { subject: String(userId), expiresIn, algorithm: 'HS256' });
  return { token, expiresIn };
}

// Returns the user id from a valid token, or throws.
function verifyToken(token) {
  const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
  if (!payload.sub) throw new Error('token has no subject');
  return payload.sub;
}

function deviceEntry(device) {
  return device ? { deviceId: device.deviceId, platform: device.platform, lastSyncAt: null } : null;
}

async function register({ email, password, displayName, homeCourseName, client, device }) {
  if (await User.exists({ email })) throw AppError.emailTaken();

  const user = new User({
    email,
    passwordHash: await hashPassword(password),
    displayName,
    devices: device ? [deviceEntry(device)] : [],
  });
  try {
    await user.save();
  } catch (err) {
    if (err.code === 11000) throw AppError.emailTaken(); // two sign-ups at once
    throw err;
  }

  if (homeCourseName) {
    const course = await coursesService.findOrCreate(user._id, homeCourseName);
    user.homeCourseId = course._id;
    await user.save();
  }

  return { user, ...signToken(user._id, client) };
}

async function login({ email, password, client, device }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) throw AppError.unauthenticated('Email or password is incorrect.');

  if (device) await rememberDevice(user._id, device);
  return { user, ...signToken(user._id, client) };
}

// Keeps a short list of the golfer's devices (A2 users.devices).
async function rememberDevice(userId, device, syncedAt) {
  const update = { 'devices.$.platform': device.platform };
  if (syncedAt) update['devices.$.lastSyncAt'] = syncedAt;
  const res = await User.updateOne({ _id: userId, 'devices.deviceId': device.deviceId }, { $set: update });
  if (res.matchedCount === 0) {
    await User.updateOne(
      { _id: userId },
      { $push: { devices: { $each: [{ ...deviceEntry(device), lastSyncAt: syncedAt || null }], $slice: -5 } } },
    );
  }
}

module.exports = { register, login, signToken, verifyToken, hashPassword, rememberDevice };
