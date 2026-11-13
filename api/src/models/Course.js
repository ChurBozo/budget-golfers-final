// courses collection (A2 section 7).
// Design change for Phase 2: courses are self-named. A golfer types the course
// name in the app, and the API finds or creates that golfer's course by its
// slug, so the unique index is { createdBy, slug } instead of { slug }.
// Many small and municipal courses have no map location, so location,
// tees and stroke indexes are optional.
const { Schema, model } = require('mongoose');
const pointSchema = require('./geoPoint');

const teeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 20 },
    par: { type: Number, min: 27, max: 80 },
    totalMetres: { type: Number, min: 0, max: 8000 },
    courseRating: { type: Number, min: 20, max: 90 },
    slopeRating: { type: Number, min: 55, max: 155 },
  },
  { _id: false },
);

const courseHoleSchema = new Schema(
  {
    number: { type: Number, required: true, min: 1, max: 18 },
    par: { type: Number, required: true, min: 3, max: 6 },
    strokeIndex: { type: Number, min: 1, max: 18 },
    // Length of the hole from each tee, e.g. { "Yellow": 352, "White": 371 }.
    metres: { type: Map, of: Number, default: undefined },
  },
  { _id: false },
);

const courseSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    slug: { type: String, required: true, maxlength: 80 },
    region: { type: String, trim: true, maxlength: 60 },
    location: { type: pointSchema, default: undefined },
    tees: { type: [teeSchema], default: [] },
    holes: { type: [courseHoleSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

// A2 Table 11 (slug index now per golfer, see the note above)
courseSchema.index({ createdBy: 1, slug: 1 }, { unique: true });
courseSchema.index({ name: 'text' });
courseSchema.index({ location: '2dsphere' });

// Course par from the holes it knows about (null until all holes are known).
courseSchema.virtual('par').get(function par() {
  if (!this.holes || this.holes.length !== 18) return null;
  return this.holes.reduce((sum, h) => sum + h.par, 0);
});

module.exports = model('Course', courseSchema);
