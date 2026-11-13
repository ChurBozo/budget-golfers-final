const { roundTotals, normaliseHole, greenInRegulation, roundPar } = require('../../src/services/calc/totals');
const { distanceMetres } = require('../../src/services/calc/geo');

describe('round totals (A2 Table 10: totals are calculated, never sent)', () => {
  const holes = [
    { number: 1, par: 4, strokes: 4, putts: 2, penalties: 0, fairwayHit: true },
    { number: 2, par: 3, strokes: 4, putts: 2, penalties: 0 },
    { number: 3, par: 5, strokes: 7, putts: 3, penalties: 1, fairwayHit: false },
  ];

  test('adds strokes, putts and penalties and works out score to par', () => {
    expect(roundTotals(holes)).toEqual({
      strokes: 15,
      toPar: 3,
      putts: 7,
      penalties: 1,
      fairwaysHit: 1,
      fairwaysPossible: 2, // only the par 4 and par 5
      greensInRegulation: 1, // hole 1: on in 2 on a par 4
    });
    expect(roundPar(holes)).toBe(12);
  });

  test('green in regulation means on the green in par minus 2', () => {
    expect(greenInRegulation({ par: 4, strokes: 4, putts: 2 })).toBe(true);
    expect(greenInRegulation({ par: 4, strokes: 5, putts: 2 })).toBe(false);
    expect(greenInRegulation({ par: 3, strokes: 3, putts: 2 })).toBe(true);
  });

  test('normaliseHole removes fairwayHit on a par 3 and fills in GIR', () => {
    const h = normaliseHole({ number: 2, par: 3, strokes: 3, putts: 2, fairwayHit: true, teeClub: null });
    expect(h.fairwayHit).toBeUndefined();
    expect(h.greenInRegulation).toBe(true);
    expect('teeClub' in h).toBe(false);
  });

  test('normaliseHole measures shots from their GPS points', () => {
    const start = { lat: -37.67412, lng: 176.22401 };
    const end = { lat: -37.67595, lng: 176.22498 };
    const h = normaliseHole({
      number: 7, par: 4, strokes: 5, putts: 2,
      shots: [{ seq: 2, club: '7i' }, { seq: 1, club: 'driver', start, end, distanceMetres: 999 }],
    });
    expect(h.shots.map((s) => s.seq)).toEqual([1, 2]); // sorted
    expect(h.shots[0].distanceMetres).toBe(Math.round(distanceMetres(start, end))); // client value replaced
  });
});

describe('GPS distance', () => {
  test('one degree of latitude is about 111 km', () => {
    expect(distanceMetres({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111195, -2);
  });
  test('the A2 example drive is about 220 m', () => {
    const d = distanceMetres({ lat: -37.67412, lng: 176.22401 }, { lat: -37.67595, lng: 176.22498 });
    expect(d).toBeGreaterThan(210);
    expect(d).toBeLessThan(230);
  });
  test('missing points give null', () => {
    expect(distanceMetres(null, { lat: 1, lng: 1 })).toBeNull();
  });
});
