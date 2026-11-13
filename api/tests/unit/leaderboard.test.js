// The proposal names the leaderboard ranking as one of the two calculations
// that must be unit tested.
const { summarise, rank, MINIMUM_ROUNDS } = require('../../src/services/calc/leaderboard');

describe('leaderboard summary', () => {
  test('average score and improvement (newer half minus older half)', () => {
    // oldest first: 90, 88 | 84, 82  -> 89 vs 83 -> improved by 6
    expect(summarise([90, 88, 84, 82])).toEqual({ averageScore: 86, improvement: -6, roundsPlayed: 4 });
  });

  test('with an odd number of rounds the newer half has the extra round', () => {
    // older: [100]; newer: [90, 92] -> 91 - 100 = -9
    expect(summarise([100, 90, 92]).improvement).toBe(-9);
  });

  test('a golfer getting worse has a positive improvement', () => {
    expect(summarise([80, 80, 86, 86]).improvement).toBe(6);
  });

  test('the minimum is 3 rounds, as in the design', () => {
    expect(MINIMUM_ROUNDS).toBe(3);
  });
});

describe('leaderboard ranking', () => {
  const rows = [
    { userId: 'a', displayName: 'Aroha', averageScore: 91.4, improvement: -2.1, roundsPlayed: 37 },
    { userId: 't', displayName: 'Tane', averageScore: 78.2, improvement: -1.4, roundsPlayed: 42 },
    { userId: 'm', displayName: 'Mei', averageScore: 81.6, improvement: -3.0, roundsPlayed: 29 },
    { userId: 's', displayName: 'Sam', averageScore: 81.6, improvement: 0.5, roundsPlayed: 5 },
  ];

  test('avgScore: lowest average first', () => {
    expect(rank(rows, 'avgScore').map((r) => [r.rank, r.userId])).toEqual([
      [1, 't'],
      [2, 'm'], // same average as Sam, more rounds listed first
      [2, 's'], // ties share a rank
      [4, 'a'],
    ]);
  });

  test('improved: biggest drop first', () => {
    expect(rank(rows, 'improved').map((r) => r.userId)).toEqual(['m', 'a', 't', 's']);
  });

  test('rounds: most rounds first', () => {
    expect(rank(rows, 'rounds').map((r) => r.userId)).toEqual(['t', 'a', 'm', 's']);
  });

  test('does not change the input array', () => {
    const copy = JSON.stringify(rows);
    rank(rows, 'rounds');
    expect(JSON.stringify(rows)).toBe(copy);
  });
});
