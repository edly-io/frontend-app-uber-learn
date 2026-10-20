/**
 * Unit tests for useBadgeCelebration utilities.
 *
 * AC coverage (selectBadgeCelebration):
 *   SBC-NULL-DATA:      returns null when data is undefined
 *   SBC-NO-PENDING:     returns null when no badges are awarded+unseen
 *   SBC-CURRICULUM:     returns curriculum badge when one is pending
 *   SBC-SLOT-FILTER:    prefers curriculum badge matching the slot filter
 *   SBC-COURSE-FALLBACK: falls back to course badge when no curriculum badge found
 *   SBC-ALSO-EARNED:    alsoEarned lists additional pending badges
 *   SBC-DEDUP:          already-celebrated awardId is skipped (session guard)
 *
 * AC coverage (goToBadgeCelebration):
 *   GBC-MARKS:          marks awardId + alsoEarned in the session guard
 *   GBC-NAVIGATES:      navigates to '/'
 */
import {
  selectBadgeCelebration,
  goToBadgeCelebration,
  resetCelebratedBadges,
} from '../hooks/useBadgeCelebration';
import type { BadgesResponse } from '../api/curriculum';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBadge(
  id: string,
  opts: {
    type?: 'curriculum' | 'course';
    slot?: string;
    awarded?: boolean;
    seen?: boolean;
    courseId?: string;
  } = {},
) {
  const {
    type = 'curriculum',
    slot = 'complete',
    awarded = true,
    seen = false,
    courseId = 'course-v1:T',
  } = opts;

  const source = type === 'curriculum'
    ? { type: 'curriculum' as const, slot }
    : { type: 'course' as const, courseId };

  return {
    id,
    awarded,
    seen,
    badge: { title: `Badge ${id}`, image_url: `https://img/${id}.png`, description: '' },
    source,
    awarded_at: '2026-10-01',
  };
}

function makeData(curriculum: ReturnType<typeof makeBadge>[], course: ReturnType<typeof makeBadge>[]): BadgesResponse {
  return {
    curriculum_badges: curriculum as BadgesResponse['curriculum_badges'],
    course_badges: course as BadgesResponse['course_badges'],
  };
}

beforeEach(() => {
  resetCelebratedBadges();
});

// ── selectBadgeCelebration ────────────────────────────────────────────────────

describe('selectBadgeCelebration', () => {
  it('SBC-NULL-DATA: returns null when data is undefined', () => {
    expect(selectBadgeCelebration(undefined)).toBeNull();
  });

  it('SBC-NO-PENDING: returns null when no awarded+unseen badges', () => {
    const data = makeData(
      [makeBadge('b1', { awarded: false })],
      [makeBadge('b2', { type: 'course', seen: true })],
    );
    expect(selectBadgeCelebration(data)).toBeNull();
  });

  it('SBC-CURRICULUM: returns curriculum badge celebration when one is pending', () => {
    const data = makeData([makeBadge('curr-1', { slot: 'complete' })], []);
    const result = selectBadgeCelebration(data);
    expect(result).not.toBeNull();
    expect(result?.awardId).toBe('curr-1');
    expect(result?.slot).toBe('complete');
    expect(result?.alsoEarned).toHaveLength(0);
  });

  it('SBC-SLOT-FILTER: skips curriculum badge not matching slot filter', () => {
    const data = makeData(
      [makeBadge('curr-safe', { slot: 'safety' })],
      [makeBadge('crs-1', { type: 'course' })],
    );
    // filter for slot 'complete' — the curriculum badge slot 'safety' does not match
    const result = selectBadgeCelebration(data, ['complete']);
    // should fall back to the course badge
    expect(result?.awardId).toBe('crs-1');
    expect(result?.slot).toBe('complete');
  });

  it('SBC-COURSE-FALLBACK: falls back to course badge when no curriculum badge', () => {
    const data = makeData([], [makeBadge('crs-1', { type: 'course' })]);
    const result = selectBadgeCelebration(data);
    expect(result).not.toBeNull();
    expect(result?.awardId).toBe('crs-1');
    expect(result?.slot).toBe('complete');
  });

  it('SBC-ALSO-EARNED: alsoEarned contains other pending badges', () => {
    const data = makeData(
      [makeBadge('curr-1', { slot: 'complete' })],
      [makeBadge('crs-1', { type: 'course' })],
    );
    const result = selectBadgeCelebration(data);
    expect(result?.awardId).toBe('curr-1');
    expect(result?.alsoEarned).toHaveLength(1);
    expect(result?.alsoEarned[0].id).toBe('crs-1');
  });

  it('SBC-DEDUP: already-celebrated awardId is excluded by session guard', () => {
    const data = makeData([makeBadge('curr-1', { slot: 'complete' })], []);
    // Celebrate once → adds to session guard
    const mockNav = jest.fn();
    const first = selectBadgeCelebration(data)!;
    goToBadgeCelebration(mockNav, first);

    // Second call should return null (badge now in celebratedAwardIds)
    const second = selectBadgeCelebration(data);
    expect(second).toBeNull();
  });
});

// ── goToBadgeCelebration ──────────────────────────────────────────────────────

describe('goToBadgeCelebration', () => {
  it('GBC-NAVIGATES: navigates to "/"', () => {
    const navigate = jest.fn();
    const celebration = { slot: 'complete' as const, awardId: 'a1', alsoEarned: [] };
    goToBadgeCelebration(navigate, celebration);
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('GBC-MARKS: marks primary and alsoEarned ids in session guard', () => {
    const navigate = jest.fn();
    const celebration = {
      slot: 'complete' as const,
      awardId: 'a1',
      alsoEarned: [
        { id: 'a2', title: 'Other', imageUrl: null },
      ],
    };
    goToBadgeCelebration(navigate, celebration);

    // After marking, neither badge should appear in a new selectBadgeCelebration call
    const data = makeData(
      [makeBadge('a1', { slot: 'complete' }), makeBadge('a2', { slot: 'safety' })],
      [],
    );
    expect(selectBadgeCelebration(data)).toBeNull();
  });
});
