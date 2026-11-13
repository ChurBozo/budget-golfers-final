// Formatting helpers shared by hooks and components. Distances are stored in
// metres everywhere and converted only for display, as in the app.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YARDS_PER_METRE = 1.0936133;

function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

/** 12 Sep 2026 (in the golfer's own time zone) */
export function formatDate(value) {
  const d = toDate(value);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** { day: "12", month: "Sep" } for the date tiles */
export function dateTile(value) {
  const d = toDate(value);
  return { day: String(d.getDate()).padStart(2, '0'), month: MONTHS[d.getMonth()] };
}

/** 12 Sep, 4:41 pm */
export function formatDateTime(value) {
  const d = toDate(value);
  const h = d.getHours() % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${h}:${m} ${d.getHours() < 12 ? 'am' : 'pm'}`;
}

/** +12, E, −3 (a real minus sign) */
export function formatToPar(diff) {
  if (diff === null || diff === undefined) return '–';
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : `−${Math.abs(diff)}`;
}

/** A signed change with one decimal: −1.4, +0.9, 0.0 */
export function formatChange(value) {
  if (value === null || value === undefined) return '–';
  const fixed = Math.abs(value).toFixed(1);
  if (value < 0) return `−${fixed}`;
  if (value > 0) return `+${fixed}`;
  return fixed;
}

export function formatNumber(value, digits = 1) {
  if (value === null || value === undefined) return '–';
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

export function convertDistance(metres, units) {
  if (metres === null || metres === undefined) return null;
  return units === 'imperial' ? Math.round(metres * YARDS_PER_METRE) : Math.round(metres);
}

export function unitLabel(units) {
  return units === 'imperial' ? 'yd' : 'm';
}

/** "212 m" or "232 yd" */
export function formatDistance(metres, units) {
  const v = convertDistance(metres, units);
  return v === null ? '–' : `${v} ${unitLabel(units)}`;
}

export function initials(name = '') {
  const parts = name.replace(/\./g, '').trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || '?').toUpperCase() + (parts[1]?.[0] || '').toUpperCase();
}

export function firstName(name = '') {
  return name.trim().split(/\s+/)[0] || name;
}

/** birdie | par | bogey | double, for the scorecard marks */
export function scoreClass(strokes, par) {
  const d = strokes - par;
  if (d <= -1) return 'birdie';
  if (d === 0) return 'par';
  if (d === 1) return 'bogey';
  return 'double';
}

export const PERIODS = [
  { value: 'last5', label: 'Last 5', previous: 'previous 5', title: 'Last 5 rounds' },
  { value: 'last20', label: 'Last 20', previous: 'previous 20', title: 'Last 20 rounds' },
  { value: 'year', label: 'This year', previous: 'last year', title: 'This year' },
  { value: 'all', label: 'All time', previous: null, title: 'All rounds' },
];

export function periodInfo(value) {
  return PERIODS.find((p) => p.value === value) || PERIODS[1];
}
