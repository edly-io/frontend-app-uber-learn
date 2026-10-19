/**
 * Unit tests for learning-progress formatting utilities.
 *
 * AC coverage:
 *   FMT-ORDINAL-SPECIAL:  1st, 2nd, 3rd
 *   FMT-ORDINAL-TH:       4th-20th (th suffix)
 *   FMT-ORDINAL-EDGE:     11th, 12th, 13th (teen exceptions)
 *   FMT-ORDINAL-21+:      21st, 22nd, 23rd, 24th+
 *   FMT-RESETS:           formats date string as "resets D Month"
 */
import { toOrdinal, getResetsText } from '../pages/learning-progress/format';

describe('toOrdinal', () => {
  it('FMT-ORDINAL-SPECIAL: 1 → 1st', () => {
    expect(toOrdinal(1)).toBe('1st');
  });

  it('FMT-ORDINAL-SPECIAL: 2 → 2nd', () => {
    expect(toOrdinal(2)).toBe('2nd');
  });

  it('FMT-ORDINAL-SPECIAL: 3 → 3rd', () => {
    expect(toOrdinal(3)).toBe('3rd');
  });

  it('FMT-ORDINAL-TH: 4-20 all get th', () => {
    for (let i = 4; i <= 20; i++) {
      expect(toOrdinal(i)).toBe(`${i}th`);
    }
  });

  it('FMT-ORDINAL-EDGE: 11, 12, 13 get th (teen exceptions)', () => {
    expect(toOrdinal(11)).toBe('11th');
    expect(toOrdinal(12)).toBe('12th');
    expect(toOrdinal(13)).toBe('13th');
  });

  it('FMT-ORDINAL-21+: 21 → 21st, 22 → 22nd, 23 → 23rd, 24 → 24th', () => {
    expect(toOrdinal(21)).toBe('21st');
    expect(toOrdinal(22)).toBe('22nd');
    expect(toOrdinal(23)).toBe('23rd');
    expect(toOrdinal(24)).toBe('24th');
  });

  it('FMT-ORDINAL-21+: 111, 112, 113 get th (teen exception at hundreds)', () => {
    expect(toOrdinal(111)).toBe('111th');
    expect(toOrdinal(112)).toBe('112th');
    expect(toOrdinal(113)).toBe('113th');
  });
});

describe('getResetsText', () => {
  it('FMT-RESETS: formats ISO date as "resets D Month"', () => {
    const result = getResetsText('2026-11-01T00:00:00Z');
    expect(result).toMatch(/^resets 1 November$/);
  });

  it('FMT-RESETS: handles different months', () => {
    const result = getResetsText('2026-03-15T00:00:00Z');
    expect(result).toMatch(/^resets 15 March$/);
  });
});
