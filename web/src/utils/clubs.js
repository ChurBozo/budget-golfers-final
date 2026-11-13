// Club codes shared with the app and the API (api/src/utils/clubCodes.js).
const CLUBS = [
  ['driver', 'Driver', 'Dr'],
  ['3w', '3 wood', '3w'],
  ['5w', '5 wood', '5w'],
  ['7w', '7 wood', '7w'],
  ['2h', '2 hybrid', '2h'],
  ['3h', '3 hybrid', '3h'],
  ['4h', '4 hybrid', '4h'],
  ['5h', '5 hybrid', '5h'],
  ['6h', '6 hybrid', '6h'],
  ['2i', '2 iron', '2i'],
  ['3i', '3 iron', '3i'],
  ['4i', '4 iron', '4i'],
  ['5i', '5 iron', '5i'],
  ['6i', '6 iron', '6i'],
  ['7i', '7 iron', '7i'],
  ['8i', '8 iron', '8i'],
  ['9i', '9 iron', '9i'],
  ['pw', 'Pitching wedge', 'PW'],
  ['gw', 'Gap wedge', 'GW'],
  ['sw', 'Sand wedge', 'SW'],
  ['lw', 'Lob wedge', 'LW'],
  ['putter', 'Putter', 'Pt'],
];

const BY_CODE = new Map(CLUBS.map(([code, label, short]) => [code, { label, short }]));

export function clubLabel(code) {
  if (!code) return 'Club not recorded';
  return BY_CODE.get(code)?.label ?? code;
}

/** Short enough for the club bars and table: wedges as PW, GW, SW, LW (as in the template). */
export function clubCompact(code) {
  const short = BY_CODE.get(code)?.short;
  if (short && /^[PGSL]W$/.test(short)) return short;
  return clubLabel(code);
}

export function clubShort(code) {
  if (!code) return '';
  return BY_CODE.get(code)?.short ?? code;
}

const RESULTS = {
  fairway: 'Fairway',
  'rough-left': 'Rough, left',
  'rough-right': 'Rough, right',
  bunker: 'Bunker',
  green: 'Green',
  penalty: 'Penalty',
};

export function resultLabel(result) {
  return RESULTS[result] ?? 'Not tagged';
}
