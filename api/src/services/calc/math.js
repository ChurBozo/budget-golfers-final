// Small number helpers shared by the calculation modules.
function sum(values) {
  return values.reduce((s, v) => s + v, 0);
}

function mean(values) {
  if (!values || values.length === 0) return null;
  return sum(values) / values.length;
}

// Population standard deviation (how spread out a club's distances are).
function stdev(values) {
  if (!values || values.length === 0) return null;
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

function round1(value) {
  return value === null || value === undefined || Number.isNaN(value) ? null : Math.round(value * 10) / 10;
}

function round0(value) {
  return value === null || value === undefined || Number.isNaN(value) ? null : Math.round(value);
}

function pct(part, whole) {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

function diff1(current, previous) {
  return current === null || previous === null ? null : round1(current - previous);
}

module.exports = { sum, mean, stdev, round1, round0, pct, diff1 };
