// Courses are self-named: each golfer has their own list, built from the
// names they type in the app. A course learns its holes (par and length per
// tee) from the rounds played on it.
const { Course } = require('../models');
const AppError = require('../utils/AppError');
const { slugify, cleanName } = require('../utils/slug');

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function list(userId, { search, region, page, limit }) {
  const filter = { createdBy: userId };
  if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' };
  if (region) filter.region = { $regex: `^${escapeRegex(region)}$`, $options: 'i' };

  const [items, total] = await Promise.all([
    Course.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Course.countDocuments(filter),
  ]);
  return { items, total };
}

// 404 when the course does not exist or belongs to another golfer.
async function getOwned(userId, courseId) {
  const course = await Course.findOne({ _id: courseId, createdBy: userId });
  if (!course) throw AppError.notFound('Course not found.');
  return course;
}

async function findOrCreate(userId, rawName) {
  const name = cleanName(rawName);
  const slug = slugify(name);
  if (!slug) throw AppError.validation([{ field: 'course.name', issue: 'must contain letters or numbers' }]);

  const existing = await Course.findOne({ createdBy: userId, slug });
  if (existing) return existing;
  try {
    return await Course.create({ name, slug, createdBy: userId });
  } catch (err) {
    // The same new course arrived twice at once; use the one that won.
    if (err.code === 11000) return Course.findOne({ createdBy: userId, slug });
    throw err;
  }
}

// Adds any holes (par and tee length) the course did not know yet.
async function learnHoles(course, holes, tee) {
  const known = new Map(course.holes.map((h) => [h.number, h]));
  let changed = false;
  for (const h of holes) {
    let entry = known.get(h.number);
    if (!entry) {
      course.holes.push({ number: h.number, par: h.par });
      entry = course.holes[course.holes.length - 1];
      known.set(h.number, entry);
      changed = true;
    }
    if (tee && typeof h.distanceMetres === 'number') {
      if (!entry.metres) entry.metres = new Map();
      if (!entry.metres.has(tee)) {
        entry.metres.set(tee, h.distanceMetres);
        changed = true;
      }
    }
  }
  if (tee && !course.tees.some((t) => t.name.toLowerCase() === tee.toLowerCase())) {
    course.tees.push({ name: tee });
    changed = true;
  }
  if (changed) {
    course.holes.sort((a, b) => a.number - b.number);
    if (course.holes.length === 18) {
      const t = course.tees.find((x) => x.name === tee);
      if (t && !t.par) t.par = course.holes.reduce((s, x) => s + x.par, 0);
    }
    await course.save();
  }
  return course;
}

// { courseRating, slopeRating } for a round's tee, when the course has them.
function ratingLookup(courses) {
  const byId = new Map(courses.map((c) => [String(c._id), c]));
  return (round) => {
    const course = byId.get(String(round.course.courseId));
    const tee = course?.tees?.find((t) => t.name === round.tee);
    if (!tee || !tee.courseRating || !tee.slopeRating) return null;
    return { courseRating: tee.courseRating, slopeRating: tee.slopeRating };
  };
}

module.exports = { list, getOwned, findOrCreate, learnHoles, ratingLookup };
