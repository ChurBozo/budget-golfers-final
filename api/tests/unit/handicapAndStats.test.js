const { handicapFromDifferentials, scoreDifferential, adjustedScore } = require('../../src/services/calc/handicap');
const { buildStats } = require('../../src/services/calc/stats');
const { statsWindow, leaderboardStart } = require('../../src/services/calc/periods');
const { buildSnapshot } = require('../../src/services/calc/snapshot');

function round({ id, strokesPerHole = 5, holes = 18, playedAt, putts = 2, shots }) {
  const hs = Array.from({ length: holes }, (_, i) => ({
    number: i + 1,
    par: 4,
    strokes: strokesPerHole,
    putts,
    ...(shots && i === 0 ? { shots } : {}),
  }));
  const strokes = strokesPerHole * holes;
  return {
    _id: id,
    holesPlayed: holes,
    playedAt: new Date(playedAt),
    course: { par: holes * 4 },
    holes: hs,
    totals: {
      strokes,
      toPar: strokes - holes * 4,
      putts: putts * holes,
      fairwaysHit: holes / 2,
      fairwaysPossible: holes,
      greensInRegulation: strokesPerHole - putts <= 2 ? holes : 0,
    },
  };
}

describe('handicap estimate (World Handicap System, simplified)', () => {
  test('needs at least 3 rounds', () => {
    expect(handicapFromDifferentials([10, 12])).toBeNull();
  });
  test('3 rounds: lowest differential minus 2', () => {
    expect(handicapFromDifferentials([10, 12, 14])).toBe(8);
  });
  test('20 rounds: average of the best 8', () => {
    const diffs = Array.from({ length: 20 }, (_, i) => i + 1); // 1..20
    expect(handicapFromDifferentials(diffs)).toBe(4.5); // mean of 1..8
  });
  test('only the newest 20 rounds count', () => {
    const diffs = [...Array.from({ length: 20 }, () => 20), 0, 0, 0];
    expect(handicapFromDifferentials(diffs)).toBe(20);
  });
  test('holes are capped at double bogey', () => {
    expect(adjustedScore([{ par: 4, strokes: 9 }, { par: 3, strokes: 3 }])).toBe(9);
  });
  test('uses course rating and slope when the tee has them', () => {
    const r = round({ id: 'x', strokesPerHole: 5, playedAt: '2026-09-01' }); // 90, par 72
    expect(scoreDifferential(r, null)).toBe(18);
    expect(scoreDifferential(r, { courseRating: 70, slopeRating: 113 })).toBe(20);
  });
});

describe('periods', () => {
  const rounds = Array.from({ length: 25 }, (_, i) => ({ playedAt: new Date(Date.UTC(2026, 9, 25 - i)) }));
  test('last5 compares with the 5 rounds before', () => {
    const w = statsWindow(rounds, 'last5');
    expect(w.current).toHaveLength(5);
    expect(w.previous).toHaveLength(5);
  });
  test('year uses the calendar year', () => {
    const w = statsWindow(rounds, 'year', new Date('2026-11-05T00:00:00Z'));
    expect(w.current).toHaveLength(25);
    expect(w.previous).toHaveLength(0);
  });
  test('leaderboard season starts on 1 January, month is the last 30 days', () => {
    const now = new Date('2026-11-05T00:00:00Z');
    expect(leaderboardStart('season', now).toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(leaderboardStart('month', now).toISOString()).toBe('2026-10-06T00:00:00.000Z');
    expect(leaderboardStart('all', now)).toBeNull();
  });
});

describe('statistics for the dashboard', () => {
  // newest first
  const rounds = [
    round({ id: 'r3', strokesPerHole: 5, playedAt: '2026-10-20', shots: [{ seq: 1, club: '7i', result: 'rough-left' }] }),
    round({ id: 'r2', strokesPerHole: 5, playedAt: '2026-10-10', putts: 3 }),
    round({ id: 'nine', strokesPerHole: 5, holes: 9, playedAt: '2026-10-05' }),
    round({ id: 'r1', strokesPerHole: 6, playedAt: '2026-09-01' }),
  ];
  const stats = buildStats({ rounds, period: 'all', handicapEstimate: 18.4, now: new Date('2026-11-05T00:00:00Z') });

  test('9-hole rounds count as rounds but not in per-round averages', () => {
    expect(stats.roundsInPeriod).toBe(4);
    expect(stats.scoring.averageScore).toBe(96); // (90 + 90 + 108) / 3
    expect(stats.scoring.bestScore).toBe(90);
    expect(stats.scoring.bestRoundId).toBe('r3'); // the first 90 found, newest
  });

  test('putting, three-putts and the score distribution', () => {
    expect(stats.putting.threePuttsPerRound).toBe(6); // 18 three-putts over 3 rounds
    // every hole counts, including the 9-hole round: 18 + 18 + 9 bogeys, 18 doubles
    expect(stats.scoreDistribution).toEqual({ birdieOrBetter: 0, par: 0, bogey: 45, doubleOrWorse: 18 });
  });

  test('common miss and trend', () => {
    expect(stats.accuracy.commonMiss).toEqual({ direction: 'left', club: '7i' });
    expect(stats.trend.map((t) => t.score)).toEqual([90, 90, 108]);
    expect(stats.trend[2].rollingAverage).toBe(108);
    expect(stats.trend[0].rollingAverage).toBe(96);
    expect(stats.handicapEstimate).toBe(18.4);
  });

  test('the snapshot stored on the user', () => {
    const snap = buildSnapshot(rounds);
    expect(snap).toMatchObject({ roundsPlayed: 4, averageScoreLast20: 96, bestScore: 90, handicapEstimate: 16 });
    expect(snap.lastRoundAt.toISOString()).toBe('2026-10-20T00:00:00.000Z');
  });
});
