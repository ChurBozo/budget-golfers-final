import { describe, expect, test } from 'vitest';
import {
  convertDistance,
  dateTile,
  formatChange,
  formatDistance,
  formatToPar,
  initials,
  scoreClass,
} from '../src/utils/format';
import { clubCompact, clubLabel, resultLabel } from '../src/utils/clubs';

describe('format helpers', () => {
  test('score to par uses E and a real minus sign', () => {
    expect(formatToPar(12)).toBe('+12');
    expect(formatToPar(0)).toBe('E');
    expect(formatToPar(-3)).toBe('−3');
  });

  test('changes keep one decimal and a sign', () => {
    expect(formatChange(-1.4)).toBe('−1.4');
    expect(formatChange(0.9)).toBe('+0.9');
    expect(formatChange(null)).toBe('–');
  });

  test('metres convert to yards only for display', () => {
    expect(convertDistance(212, 'metric')).toBe(212);
    expect(convertDistance(212, 'imperial')).toBe(232);
    expect(formatDistance(140, 'imperial')).toBe('153 yd');
    expect(convertDistance(null, 'imperial')).toBeNull();
  });

  test('scorecard marks match the template classes', () => {
    expect(scoreClass(3, 4)).toBe('birdie');
    expect(scoreClass(2, 4)).toBe('birdie');
    expect(scoreClass(4, 4)).toBe('par');
    expect(scoreClass(5, 4)).toBe('bogey');
    expect(scoreClass(7, 4)).toBe('double');
  });

  test('avatar initials and date tiles', () => {
    expect(initials('Aroha M.')).toBe('AM');
    expect(initials('Tane')).toBe('T');
    expect(dateTile(new Date(2026, 8, 6))).toEqual({ day: '06', month: 'Sep' });
  });

  test('club names', () => {
    expect(clubLabel('7i')).toBe('7 iron');
    expect(clubCompact('pw')).toBe('PW');
    expect(clubCompact('driver')).toBe('Driver');
    expect(resultLabel('rough-left')).toBe('Rough, left');
  });
});
