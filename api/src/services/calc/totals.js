// Round totals. The client never sends totals (A2 Table 10); they are always
// worked out here from the holes, the same way the app does (RoundTotals.of).
const { distanceMetres } = require('./geo');

// A fairway can only be hit on a par 4 or par 5.
function fairwayPossible(hole) {
  return hole.par >= 4;
}

// On the green in (par - 2) strokes or fewer.
function greenInRegulation(hole) {
  return hole.strokes - hole.putts <= hole.par - 2;
}

// Fills in derived hole values and measures every shot that has both GPS points.
function normaliseHole(hole) {
  const out = { ...hole, penalties: hole.penalties ?? 0 };
  if (!fairwayPossible(out)) delete out.fairwayHit;
  if (out.greenInRegulation === undefined || out.greenInRegulation === null) {
    out.greenInRegulation = greenInRegulation(out);
  }
  if (Array.isArray(out.shots)) {
    out.shots = out.shots
      .map((s) => {
        const shot = { ...s };
        const measured = distanceMetres(shot.start, shot.end);
        if (measured !== null) shot.distanceMetres = Math.round(measured);
        return shot;
      })
      .sort((a, b) => a.seq - b.seq);
    if (out.shots.length === 0) delete out.shots;
  }
  for (const key of Object.keys(out)) {
    if (out[key] === null || out[key] === undefined) delete out[key];
  }
  return out;
}

function roundPar(holes) {
  return holes.reduce((s, h) => s + h.par, 0);
}

function roundTotals(holes) {
  let strokes = 0;
  let putts = 0;
  let penalties = 0;
  let fairwaysHit = 0;
  let fairwaysPossible = 0;
  let greens = 0;
  for (const h of holes) {
    strokes += h.strokes;
    putts += h.putts;
    penalties += h.penalties ?? 0;
    if (fairwayPossible(h)) {
      fairwaysPossible += 1;
      if (h.fairwayHit === true) fairwaysHit += 1;
    }
    if (h.greenInRegulation ?? greenInRegulation(h)) greens += 1;
  }
  return {
    strokes,
    toPar: strokes - roundPar(holes),
    putts,
    penalties,
    fairwaysHit,
    fairwaysPossible,
    greensInRegulation: greens,
  };
}

module.exports = { fairwayPossible, greenInRegulation, normaliseHole, roundPar, roundTotals };
