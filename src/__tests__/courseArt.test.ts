/**
 * Unit tests for courseArt utility.
 *
 * AC coverage:
 *   CA-DETERMINISTIC:  same courseId always returns the same tint
 *   CA-STABLE:         two different courseIds can produce different tints
 *   CA-EMPTY:          empty string doesn't throw and returns a valid tint
 *   CA-SHORT:          single-char id doesn't throw and returns a valid tint
 *   CA-VALID-TINT:     returned tint is always one of the known CourseTint values
 *   CA-ART-SRC:        returned artSrc is a non-empty string
 */
import { getCourseArt, type CourseTint } from '../lib/courseArt';

const VALID_TINTS: CourseTint[] = ['blue', 'teal', 'lime', 'purple', 'magenta', 'teen-rides', 'orange'];

describe('getCourseArt', () => {
  it('CA-DETERMINISTIC: same courseId always returns the same tint', () => {
    const id = 'course-v1:Uber+101+2024';
    expect(getCourseArt(id).tint).toBe(getCourseArt(id).tint);
    expect(getCourseArt(id).artSrc).toBe(getCourseArt(id).artSrc);
  });

  it('CA-STABLE: repeated calls for different ids can return different tints', () => {
    const tints = new Set(
      Array.from({ length: 20 }, (_, i) => getCourseArt(`course-${i}`).tint),
    );
    // With 20 different ids across 7 buckets, at least 2 distinct tints should appear.
    expect(tints.size).toBeGreaterThan(1);
  });

  it('CA-EMPTY: empty string does not throw and returns a valid tint', () => {
    expect(() => getCourseArt('')).not.toThrow();
    expect(VALID_TINTS).toContain(getCourseArt('').tint);
  });

  it('CA-SHORT: single-char id does not throw and returns a valid tint', () => {
    expect(() => getCourseArt('x')).not.toThrow();
    expect(VALID_TINTS).toContain(getCourseArt('x').tint);
  });

  it('CA-VALID-TINT: tint is always a known CourseTint value', () => {
    const ids = ['', 'a', 'course-v1:X+Y+Z', 'course-v1:Uber+Safety+SP2024_T1'];
    ids.forEach((id) => {
      expect(VALID_TINTS).toContain(getCourseArt(id).tint);
    });
  });

  it('CA-ART-SRC: artSrc is a non-empty string', () => {
    const ids = ['course-v1:Uber+Safety+2024', 'abc', ''];
    ids.forEach((id) => {
      expect(typeof getCourseArt(id).artSrc).toBe('string');
      expect(getCourseArt(id).artSrc.length).toBeGreaterThan(0);
    });
  });
});
