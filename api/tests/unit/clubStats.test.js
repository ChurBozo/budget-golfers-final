// The proposal names per-club averages as the second calculation that must be
// unit tested.
const { computeClubStats, mergeBag, MINIMUM_SHOTS } = require('../../src/services/calc/clubStats');

function roundWith(shots) {
  return { holes: [{ number: 1, par: 4, strokes: 5, putts: 2, shots }] };
}

describe('club averages', () => {
  test('average, longest and spread from measured shots', () => {
    const shots = [200, 210, 220, 230, 240].map((d, i) => ({ seq: i + 1, club: 'driver', distanceMetres: d }));
    const stats = computeClubStats([roundWith(shots)]).get('driver');
    expect(stats).toEqual({ shotCount: 5, averageMetres: 220, longestMetres: 240, spreadMetres: 14 });
  });

  test(`a club needs ${MINIMUM_SHOTS} measured shots before it gets an average`, () => {
    const shots = [140, 142, 138].map((d, i) => ({ seq: i + 1, club: '4i', distanceMetres: d }));
    expect(computeClubStats([roundWith(shots)]).get('4i')).toEqual({
      shotCount: 3,
      averageMetres: null,
      longestMetres: null,
      spreadMetres: null,
    });
  });

  test('putts, chips under 30 m and unmeasured shots are left out', () => {
    const shots = [
      { seq: 1, club: 'putter', distanceMetres: 6 },
      { seq: 2, club: 'sw', distanceMetres: 12 },
      { seq: 3, club: 'sw' },
      { seq: 4, club: 'sw', distanceMetres: 70 },
    ];
    const stats = computeClubStats([roundWith(shots)]);
    expect(stats.has('putter')).toBe(false);
    expect(stats.get('sw').shotCount).toBe(1);
  });

  test('shots across several rounds are combined', () => {
    const r1 = roundWith([{ seq: 1, club: '7i', distanceMetres: 130 }]);
    const r2 = roundWith([{ seq: 1, club: '7i', distanceMetres: 150 }]);
    expect(computeClubStats([r1, r2]).get('7i').shotCount).toBe(2);
  });
});

describe('merging stats into the bag', () => {
  test('keeps the bag order, labels and inBag flags', () => {
    const bag = [
      { code: '7i', label: '7 iron', inBag: true },
      { code: 'driver', label: 'Driver', inBag: true },
      { code: '4i', label: '4 iron', inBag: false },
    ];
    const merged = mergeBag(bag, new Map([['7i', { shotCount: 9, averageMetres: 140, longestMetres: 155, spreadMetres: 11 }]]));
    expect(merged.map((c) => c.code)).toEqual(['driver', '4i', '7i']); // longest club first
    expect(merged.find((c) => c.code === '7i').stats.averageMetres).toBe(140);
    expect(merged.find((c) => c.code === '4i').inBag).toBe(false);
  });

  test('a club with shots that is not in the list is added, not lost', () => {
    const merged = mergeBag([{ code: 'driver', label: 'Driver', inBag: true }], new Map([['gw', { shotCount: 2 }]]));
    expect(merged.find((c) => c.code === 'gw')).toMatchObject({ label: 'Gap wedge', inBag: false });
  });
});
