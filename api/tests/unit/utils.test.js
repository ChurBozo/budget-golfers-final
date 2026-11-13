const { slugify, cleanName } = require('../../src/utils/slug');
const { cell } = require('../../src/views/export.view');
const { formatPath } = require('../../src/middleware/validate');
const { pageLinks } = require('../../src/views/pagination');
const roundView = require('../../src/views/round.view');

describe('self-named courses', () => {
  test('different spellings of the same name match', () => {
    expect(slugify('Omanu Golf Club')).toBe('omanu-golf-club');
    expect(slugify('  omanu   GOLF club ')).toBe('omanu-golf-club');
    expect(slugify('Ōmanu Golf Club')).toBe('omanu-golf-club');
    expect(slugify('Pāpāmoa Muni 9')).toBe('papamoa-muni-9');
    expect(slugify('Fairway & Greens')).toBe('fairway-and-greens');
  });
  test('the typed name is tidied but keeps its capitals', () => {
    expect(cleanName('  omanu   GC ')).toBe('omanu GC');
  });
});

describe('CSV export cells', () => {
  test('quotes commas and quotes', () => {
    expect(cell('Windy, wet')).toBe('"Windy, wet"');
    expect(cell('He said "fore"')).toBe('"He said ""fore"""');
  });
  test('blocks spreadsheet formulas in text', () => {
    expect(cell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(cell(-3)).toBe('-3'); // numbers are left alone
  });
});

describe('error field paths', () => {
  test('match the A2 error example', () => {
    expect(formatPath(['holes', 3, 'strokes'])).toBe('holes[3].strokes');
    expect(formatPath(['preferences', 'units'])).toBe('preferences.units');
  });
});

describe('pagination links', () => {
  test('next and prev keep the filters', () => {
    const links = pageLinks('/api/rounds', { holes: 18, page: 2, limit: 10 }, 2, 4);
    expect(links).toEqual({
      self: '/api/rounds?holes=18&page=2&limit=10',
      next: '/api/rounds?holes=18&page=3&limit=10',
      prev: '/api/rounds?holes=18&page=1&limit=10',
    });
  });
});

describe('round JSON view', () => {
  test('GeoJSON points go back to { lat, lng }', () => {
    const shot = roundView.shot({ seq: 1, club: 'driver', start: { type: 'Point', coordinates: [176.22401, -37.67412] } });
    expect(shot).toEqual({ seq: 1, club: 'driver', start: { lat: -37.67412, lng: 176.22401 } });
  });
});
