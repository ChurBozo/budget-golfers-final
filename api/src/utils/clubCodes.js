// Club codes shared with the Flutter app (app/lib/models/clubs.dart).
const STANDARD_CLUBS = [
  ['driver', 'Driver'],
  ['3w', '3 wood'],
  ['5w', '5 wood'],
  ['7w', '7 wood'],
  ['2h', '2 hybrid'],
  ['3h', '3 hybrid'],
  ['4h', '4 hybrid'],
  ['5h', '5 hybrid'],
  ['6h', '6 hybrid'],
  ['2i', '2 iron'],
  ['3i', '3 iron'],
  ['4i', '4 iron'],
  ['5i', '5 iron'],
  ['6i', '6 iron'],
  ['7i', '7 iron'],
  ['8i', '8 iron'],
  ['9i', '9 iron'],
  ['pw', 'Pitching wedge'],
  ['gw', 'Gap wedge'],
  ['sw', 'Sand wedge'],
  ['lw', 'Lob wedge'],
  ['putter', 'Putter'],
];

const LABELS = new Map(STANDARD_CLUBS);

// The bag a new golfer starts with (same as the app's default bag).
const DEFAULT_BAG = ['driver', '3w', '5w', '4h', '5i', '6i', '7i', '8i', '9i', 'pw', 'gw', 'sw', 'lw', 'putter'];

// The rules of golf allow at most 14 clubs in the bag.
const MAX_IN_BAG = 14;

const CODE_PATTERN = /^[a-z0-9-]{1,12}$/;

function isStandard(code) {
  return LABELS.has(code);
}

function labelFor(code) {
  return LABELS.get(code) || code;
}

function order(code) {
  const i = STANDARD_CLUBS.findIndex(([c]) => c === code);
  return i === -1 ? STANDARD_CLUBS.length : i;
}

module.exports = { STANDARD_CLUBS, DEFAULT_BAG, MAX_IN_BAG, CODE_PATTERN, isStandard, labelFor, order };
