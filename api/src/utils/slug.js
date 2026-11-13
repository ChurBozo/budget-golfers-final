// "Ōmanu Golf Club " -> "omanu-golf-club". Used to match self-named courses,
// so "Omanu golf club" and "OMANU GOLF CLUB" are the same course.
function slugify(name) {
  return String(name)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// Tidies what the golfer typed, keeping their capitals: "  omanu   GC " -> "omanu GC".
function cleanName(name) {
  return String(name).replace(/\s+/g, ' ').trim();
}

module.exports = { slugify, cleanName };
