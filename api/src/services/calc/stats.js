// Builds the body of GET /api/stats/:userId from a golfer's rounds.
// Rounds are plain objects, newest first, with holes and shots.
//
// 9-hole rounds count towards rounds played, the percentages and the score
// distribution. Per-round averages (score, putts, the trend) only use 18-hole
// rounds, because a 9-hole score cannot be compared with an 18-hole one.
const { statsWindow } = require('./periods');
const { mean, round1, pct, diff1 } = require('./math');

const ROLLING = 5; // rounds in the trend's rolling average

function full(rounds) {
  return rounds.filter((r) => r.holesPlayed === 18);
}

function allHoles(rounds) {
  return rounds.flatMap((r) => r.holes || []);
}

function threePutts(round) {
  return (round.holes || []).filter((h) => h.putts >= 3).length;
}

function scoring(current, previous) {
  const cur = full(current);
  const prev = full(previous);
  const avg = mean(cur.map((r) => r.totals.strokes));
  const prevAvg = mean(prev.map((r) => r.totals.strokes));
  let best = null;
  for (const r of cur) {
    if (!best || r.totals.strokes < best.totals.strokes) best = r;
  }
  return {
    averageScore: round1(avg),
    averageToPar: round1(mean(cur.map((r) => r.totals.toPar))),
    bestScore: best ? best.totals.strokes : null,
    bestRoundId: best ? String(best._id) : null,
    changeVsPreviousPeriod: diff1(round1(avg), round1(prevAvg)),
  };
}

function putting(current, previous) {
  const cur = full(current);
  const prev = full(previous);
  const avg = mean(cur.map((r) => r.totals.putts));
  const prevAvg = mean(prev.map((r) => r.totals.putts));
  return {
    puttsPerRound: round1(avg),
    threePuttsPerRound: round1(mean(cur.map(threePutts))),
    changeVsPreviousPeriod: diff1(round1(avg), round1(prevAvg)),
  };
}

// The tee shot is the first shot on a par 4 or 5; it is "on target" when it
// finished on the fairway (or the green, for a drivable par 4).
function accuracy(current) {
  const holes = allHoles(current);
  const fairwaysPossible = current.reduce((s, r) => s + r.totals.fairwaysPossible, 0);
  const fairwaysHit = current.reduce((s, r) => s + r.totals.fairwaysHit, 0);
  const greens = current.reduce((s, r) => s + r.totals.greensInRegulation, 0);

  let teeShots = 0;
  let onTarget = 0;
  const misses = { left: new Map(), right: new Map() };
  for (const h of holes) {
    const shots = h.shots || [];
    const tee = shots.find((s) => s.seq === 1);
    if (h.par >= 4 && tee && tee.result) {
      teeShots += 1;
      if (tee.result === 'fairway' || tee.result === 'green') onTarget += 1;
    }
    for (const s of shots) {
      const side = s.result === 'rough-left' ? 'left' : s.result === 'rough-right' ? 'right' : null;
      if (!side) continue;
      const club = s.club || 'unknown';
      misses[side].set(club, (misses[side].get(club) || 0) + 1);
    }
  }

  return {
    fairwaysHitPct: pct(fairwaysHit, fairwaysPossible),
    greensInRegulationPct: pct(greens, holes.length),
    teeShotsOnTargetPct: pct(onTarget, teeShots),
    commonMiss: commonMiss(misses),
  };
}

function commonMiss(misses) {
  const total = (m) => [...m.values()].reduce((s, v) => s + v, 0);
  const left = total(misses.left);
  const right = total(misses.right);
  if (left === 0 && right === 0) return null;
  const direction = left >= right ? 'left' : 'right';
  let club = null;
  let most = 0;
  for (const [code, count] of misses[direction]) {
    if (count > most) {
      club = code;
      most = count;
    }
  }
  return { direction, club: club === 'unknown' ? null : club };
}

function scoreDistribution(current) {
  const out = { birdieOrBetter: 0, par: 0, bogey: 0, doubleOrWorse: 0 };
  for (const h of allHoles(current)) {
    const d = h.strokes - h.par;
    if (d <= -1) out.birdieOrBetter += 1;
    else if (d === 0) out.par += 1;
    else if (d === 1) out.bogey += 1;
    else out.doubleOrWorse += 1;
  }
  return out;
}

// Newest first, like the A2 example. rollingAverage is the average of this
// round and the 4 before it.
function trend(current) {
  const cur = full(current);
  return cur.map((r, i) => ({
    roundId: String(r._id),
    playedAt: new Date(r.playedAt).toISOString().slice(0, 10),
    score: r.totals.strokes,
    rollingAverage: round1(mean(cur.slice(i, i + ROLLING).map((x) => x.totals.strokes))),
  }));
}

function buildStats({ rounds, period, handicapEstimate = null, now = new Date() }) {
  const { current, previous } = statsWindow(rounds, period, now);
  return {
    period,
    roundsInPeriod: current.length,
    roundsAllTime: rounds.length,
    scoring: scoring(current, previous),
    putting: putting(current, previous),
    accuracy: accuracy(current),
    scoreDistribution: scoreDistribution(current),
    trend: trend(current),
    handicapEstimate,
    calculatedAt: now.toISOString(),
  };
}

module.exports = { buildStats, scoreDistribution, accuracy, trend, scoring, putting };
