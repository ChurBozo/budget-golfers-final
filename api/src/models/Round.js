// rounds collection (A2 section 7). One document per round, with its holes and
// shots embedded because they are always read together with the round.
// totals are always calculated by the server (services/calc/totals.js).
const { Schema, model } = require('mongoose');
const pointSchema = require('./geoPoint');

const SHOT_RESULTS = ['fairway', 'rough-left', 'rough-right', 'bunker', 'green', 'penalty'];

const shotSchema = new Schema(
  {
    seq: { type: Number, required: true, min: 1, max: 30 },
    club: { type: String, maxlength: 12 },
    start: { type: pointSchema, default: undefined },
    end: { type: pointSchema, default: undefined },
    distanceMetres: { type: Number, min: 0, max: 700 },
    result: { type: String, enum: SHOT_RESULTS },
  },
  { _id: false },
);

const holeSchema = new Schema(
  {
    number: { type: Number, required: true, min: 1, max: 18 },
    par: { type: Number, required: true, min: 3, max: 6 },
    distanceMetres: { type: Number, min: 0, max: 1000 },
    strokes: { type: Number, required: true, min: 1, max: 20 },
    putts: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator(v) {
          return v <= this.strokes;
        },
        message: 'must be between 0 and the strokes for the hole',
      },
    },
    penalties: { type: Number, default: 0, min: 0, max: 10 },
    teeClub: { type: String, maxlength: 12 },
    fairwayHit: { type: Boolean },
    greenInRegulation: { type: Boolean },
    shots: { type: [shotSchema], default: undefined },
  },
  { _id: false },
);

const roundSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // UUID made by the app when the round starts; used to ignore repeat uploads.
    clientRoundId: { type: String, maxlength: 64 },
    source: { type: String, enum: ['mobile-app', 'web'], default: 'web' },
    course: {
      courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
      name: { type: String, required: true, maxlength: 80 },
      par: { type: Number, required: true, min: 27, max: 108 },
    },
    tee: { type: String, maxlength: 20 },
    playedAt: {
      type: Date,
      required: true,
      validate: {
        // Allow a few minutes for a phone clock that runs fast.
        validator: (d) => d.getTime() <= Date.now() + 5 * 60 * 1000,
        message: 'cannot be in the future',
      },
    },
    holesPlayed: {
      type: Number,
      required: true,
      enum: [9, 18],
      validate: {
        validator(v) {
          return Array.isArray(this.holes) ? this.holes.length === v : true;
        },
        message: 'must equal the number of holes sent',
      },
    },
    totals: {
      strokes: { type: Number, required: true },
      toPar: { type: Number, required: true },
      putts: { type: Number, required: true },
      penalties: { type: Number, required: true },
      fairwaysHit: { type: Number, required: true },
      fairwaysPossible: { type: Number, required: true },
      greensInRegulation: { type: Number, required: true },
    },
    holes: {
      type: [holeSchema],
      validate: {
        validator(holes) {
          const numbers = holes.map((h) => h.number);
          return new Set(numbers).size === numbers.length;
        },
        message: 'hole numbers cannot repeat',
      },
    },
    notes: { type: String, maxlength: 500 },
  },
  { timestamps: true },
);

// A2 Table 11
roundSchema.index({ userId: 1, playedAt: -1 });
roundSchema.index({ userId: 1, 'course.courseId': 1, playedAt: -1 });
roundSchema.index(
  { userId: 1, clientRoundId: 1 },
  { unique: true, partialFilterExpression: { clientRoundId: { $type: 'string' } } },
);
// Leaderboard aggregation: 18-hole rounds in a period.
roundSchema.index({ holesPlayed: 1, playedAt: -1 });

module.exports = model('Round', roundSchema);
module.exports.SHOT_RESULTS = SHOT_RESULTS;
