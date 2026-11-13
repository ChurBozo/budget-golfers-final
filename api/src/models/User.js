// users collection (A2 section 7). One document per golfer. statsSnapshot is
// kept up to date by the server after every round change, so the dashboard
// and leaderboard can read it without re-adding every round.
const { Schema, model } = require('mongoose');

const deviceSchema = new Schema(
  {
    deviceId: { type: String, required: true, maxlength: 64 },
    platform: { type: String, enum: ['android', 'ios', 'web', 'other'], default: 'other' },
    lastSyncAt: { type: Date },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'must be a valid email address'],
    },
    // Never sent to a client: views/user.view.js only picks safe fields.
    passwordHash: { type: String, required: true, select: false },
    displayName: { type: String, required: true, trim: true, minlength: 2, maxlength: 30 },
    role: { type: String, enum: ['golfer', 'admin'], default: 'golfer' },
    homeCourseId: { type: Schema.Types.ObjectId, ref: 'Course', default: null },
    preferences: {
      units: { type: String, enum: ['metric', 'imperial'], default: 'metric' },
      theme: { type: String, enum: ['light', 'dark'], default: 'light' },
      showOnLeaderboard: { type: Boolean, default: true },
    },
    statsSnapshot: {
      roundsPlayed: { type: Number, default: 0, min: 0 },
      averageScoreLast20: { type: Number, default: null },
      averageScorePrev20: { type: Number, default: null },
      bestScore: { type: Number, default: null },
      handicapEstimate: { type: Number, default: null },
      lastRoundAt: { type: Date, default: null },
    },
    devices: { type: [deviceSchema], default: [] },
  },
  { timestamps: true },
);

// A2 Table 11
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ 'preferences.showOnLeaderboard': 1, 'statsSnapshot.averageScoreLast20': 1 });

module.exports = model('User', userSchema);
