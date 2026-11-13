// clubs collection (A2 section 7). One document per golfer holding their bag.
// The stats are calculated by the server from every recorded shot and can
// never be sent by a client.
const { Schema, model } = require('mongoose');
const { MAX_IN_BAG } = require('../utils/clubCodes');

const clubStatsSchema = new Schema(
  {
    shotCount: { type: Number, default: 0, min: 0 },
    averageMetres: { type: Number, default: null },
    longestMetres: { type: Number, default: null },
    spreadMetres: { type: Number, default: null },
  },
  { _id: false },
);

const clubSchema = new Schema(
  {
    code: { type: String, required: true, maxlength: 12, match: /^[a-z0-9-]+$/ },
    label: { type: String, required: true, trim: true, maxlength: 30 },
    inBag: { type: Boolean, default: true },
    stats: { type: clubStatsSchema, default: () => ({}) },
  },
  { _id: false },
);

const bagSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    clubs: {
      type: [clubSchema],
      validate: [
        {
          validator: (clubs) => clubs.filter((c) => c.inBag).length <= MAX_IN_BAG,
          message: `can have at most ${MAX_IN_BAG} clubs in the bag`,
        },
        {
          validator: (clubs) => new Set(clubs.map((c) => c.code)).size === clubs.length,
          message: 'club codes cannot repeat',
        },
      ],
    },
    recalculatedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// A2 Table 11
bagSchema.index({ userId: 1 }, { unique: true });

module.exports = model('Club', bagSchema);
