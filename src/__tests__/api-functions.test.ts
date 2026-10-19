/**
 * Unit tests for previously-untested API functions.
 *
 * AC coverage (catalog.ts):
 *   CAT-PROGRESS-FRACTION: getCourseProgressSummary computes fraction correctly
 *   CAT-PROGRESS-EMPTY:    getCourseProgressSummary handles missing completion_summary
 *   CAT-PROGRESS-ZERO:     getCourseProgressSummary returns fraction=0 when total=0
 *
 * AC coverage (gamification.ts):
 *   GAM-SUMMARY:           getGamificationSummary returns API data
 *   GAM-LEADERBOARD:       getLeaderboard sends above/below params
 *   GAM-COURSE-MAX:        getCourseMaxPoints encodes courseId and returns data
 *
 * AC coverage (progress.ts):
 *   PROG-SAVE-POS:         saveSequencePosition posts 1-based position to handler URL
 *   PROG-GET-COMPLETE:     getBlockCompletion returns true when response.complete is true
 *   PROG-GET-INCOMPLETE:   getBlockCompletion returns false when response.complete is false
 *
 * AC coverage (curriculum.ts):
 *   CUR-CURRICULUMS:       getLearnerCurriculums returns API data
 *   CUR-BADGES-ALL:        getLearnerBadges without unseen flag uses default URL
 *   CUR-BADGES-UNSEEN:     getLearnerBadges with unseen=true appends query param
 *   CUR-BADGES-SEEN:       markBadgesSeen posts award_ids
 *   CUR-LAST-ACTIVITY:     getLastActivity returns API data
 *   CUR-SEARCH-OK:         searchLearnerContent returns valid response
 *   CUR-SEARCH-INVALID:    searchLearnerContent throws on malformed response
 */
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { getCourseProgressSummary } from '../api/catalog';
import {
  getGamificationSummary, getLeaderboard, getCourseMaxPoints,
} from '../api/gamification';
import { saveSequencePosition, getBlockCompletion } from '../api/progress';
import {
  getLearnerCurriculums, getLearnerBadges, markBadgesSeen, getLastActivity, searchLearnerContent,
} from '../api/curriculum';

jest.mock('@edx/frontend-platform', () => ({
  getConfig: jest.fn(() => ({ LMS_BASE_URL: 'http://localhost:18000' })),
  camelCaseObject: (x: unknown) => x,
}));

jest.mock('@edx/frontend-platform/auth', () => ({
  getAuthenticatedHttpClient: jest.fn(),
}));

const LMS = 'http://localhost:18000';

function mockHttp(overrides: { get?: jest.Mock; post?: jest.Mock } = {}) {
  const get = overrides.get ?? jest.fn().mockResolvedValue({ data: {} });
  const post = overrides.post ?? jest.fn().mockResolvedValue({ data: {} });
  (getAuthenticatedHttpClient as jest.Mock).mockReturnValue({ get, post });
  return { get, post };
}

// ── catalog.ts ────────────────────────────────────────────────────────────────

describe('getCourseProgressSummary', () => {
  it('CAT-PROGRESS-FRACTION: computes fraction from complete/incomplete/locked counts', async () => {
    const { get } = mockHttp({
      get: jest.fn().mockResolvedValue({
        data: { completion_summary: { complete_count: 2, incomplete_count: 6, locked_count: 2 } },
      }),
    });
    const result = await getCourseProgressSummary('course-v1:Test');
    expect(result.completedUnits).toBe(2);
    expect(result.totalUnits).toBe(10);
    expect(result.fraction).toBeCloseTo(0.2);
    expect(get).toHaveBeenCalledWith(`${LMS}/api/course_home/v1/progress/course-v1:Test`);
  });

  it('CAT-PROGRESS-EMPTY: handles missing completion_summary gracefully', async () => {
    mockHttp({ get: jest.fn().mockResolvedValue({ data: {} }) });
    const result = await getCourseProgressSummary('course-v1:Test');
    expect(result.completedUnits).toBe(0);
    expect(result.totalUnits).toBe(0);
    expect(result.fraction).toBe(0);
  });

  it('CAT-PROGRESS-ZERO: returns fraction=0 when total=0 (avoids division by zero)', async () => {
    mockHttp({
      get: jest.fn().mockResolvedValue({
        data: { completion_summary: { complete_count: 0, incomplete_count: 0, locked_count: 0 } },
      }),
    });
    const result = await getCourseProgressSummary('course-v1:Test');
    expect(result.fraction).toBe(0);
  });
});

// ── gamification.ts ───────────────────────────────────────────────────────────

describe('getGamificationSummary', () => {
  it('GAM-SUMMARY: returns data from API', async () => {
    const payload = { lifetime_points: 500 };
    const { get } = mockHttp({ get: jest.fn().mockResolvedValue({ data: payload }) });
    const result = await getGamificationSummary();
    expect(result).toEqual(payload);
    expect(get).toHaveBeenCalledWith(`${LMS}/api/uber/gamification/v1/summary/`);
  });
});

describe('getLeaderboard', () => {
  it('GAM-LEADERBOARD: sends above and below as params', async () => {
    const payload = { rankings: [] };
    const { get } = mockHttp({ get: jest.fn().mockResolvedValue({ data: payload }) });
    const result = await getLeaderboard(5, 3);
    expect(result).toEqual(payload);
    expect(get).toHaveBeenCalledWith(
      `${LMS}/api/uber/gamification/v1/leaderboard/`,
      { params: { above: 5, below: 3 } },
    );
  });
});

describe('getCourseMaxPoints', () => {
  it('GAM-COURSE-MAX: encodes courseId and returns data', async () => {
    const payload = { course_id: 'course-v1:Test', max_points: 100 };
    const { get } = mockHttp({ get: jest.fn().mockResolvedValue({ data: payload }) });
    const result = await getCourseMaxPoints('course-v1:Test');
    expect(result).toEqual(payload);
    expect(get).toHaveBeenCalledWith(
      `${LMS}/api/uber/gamification/v1/courses/${encodeURIComponent('course-v1:Test')}/max-points/`,
    );
  });
});

// ── progress.ts ───────────────────────────────────────────────────────────────

describe('saveSequencePosition', () => {
  it('PROG-SAVE-POS: posts 1-based position to handler URL', async () => {
    const { post } = mockHttp();
    await saveSequencePosition('course-v1:T', 'block-v1:seq1', 2);
    expect(post).toHaveBeenCalledWith(
      `${LMS}/courses/course-v1:T/xblock/block-v1:seq1/handler/goto_position`,
      { position: 3 },
    );
  });
});

describe('getBlockCompletion', () => {
  it('PROG-GET-COMPLETE: returns true when API response has complete=true', async () => {
    mockHttp({ post: jest.fn().mockResolvedValue({ data: { complete: true } }) });
    const result = await getBlockCompletion('course-v1:T', 'block-v1:seq', 'block-v1:unit');
    expect(result).toBe(true);
  });

  it('PROG-GET-INCOMPLETE: returns false when API response has complete=false', async () => {
    mockHttp({ post: jest.fn().mockResolvedValue({ data: { complete: false } }) });
    const result = await getBlockCompletion('course-v1:T', 'block-v1:seq', 'block-v1:unit');
    expect(result).toBe(false);
  });
});

// ── curriculum.ts ─────────────────────────────────────────────────────────────

describe('getLearnerCurriculums', () => {
  it('CUR-CURRICULUMS: returns API data', async () => {
    const payload = [{ uuid: 'c1', title: 'Test' }];
    const { get } = mockHttp({ get: jest.fn().mockResolvedValue({ data: payload }) });
    const result = await getLearnerCurriculums();
    expect(result).toEqual(payload);
    expect(get).toHaveBeenCalledWith(`${LMS}/api/uber/curriculum/v1/learner/curriculums/`);
  });
});

describe('getLearnerBadges', () => {
  it('CUR-BADGES-ALL: default call uses base URL without query param', async () => {
    const payload = { curriculum_badges: [], course_badges: [] };
    const { get } = mockHttp({ get: jest.fn().mockResolvedValue({ data: payload }) });
    const result = await getLearnerBadges();
    expect(result).toEqual(payload);
    expect(get).toHaveBeenCalledWith(
      `${LMS}/api/uber/curriculum/v1/learner/badges/`,
    );
  });

  it('CUR-BADGES-UNSEEN: unseen=true appends ?unseen=true to URL', async () => {
    const { get } = mockHttp({ get: jest.fn().mockResolvedValue({ data: { curriculum_badges: [], course_badges: [] } }) });
    await getLearnerBadges(true);
    expect(get).toHaveBeenCalledWith(
      `${LMS}/api/uber/curriculum/v1/learner/badges/?unseen=true`,
    );
  });
});

describe('markBadgesSeen', () => {
  it('CUR-BADGES-SEEN: posts award_ids array', async () => {
    const { post } = mockHttp();
    await markBadgesSeen(['id-1', 'id-2']);
    expect(post).toHaveBeenCalledWith(
      `${LMS}/api/uber/curriculum/v1/learner/badges/seen/`,
      { award_ids: ['id-1', 'id-2'] },
    );
  });
});

describe('getLastActivity', () => {
  it('CUR-LAST-ACTIVITY: returns API data', async () => {
    const payload = { course: null };
    const { get } = mockHttp({ get: jest.fn().mockResolvedValue({ data: payload }) });
    const result = await getLastActivity();
    expect(result).toEqual(payload);
    expect(get).toHaveBeenCalledWith(
      `${LMS}/api/uber/curriculum/v1/learner/last-activity/`,
    );
  });
});

describe('searchLearnerContent', () => {
  it('CUR-SEARCH-OK: returns valid search response', async () => {
    const payload = { query: 'safety', curriculums: [], courses: [] };
    const { get } = mockHttp({ get: jest.fn().mockResolvedValue({ data: payload }) });
    const result = await searchLearnerContent('safety');
    expect(result).toEqual(payload);
    expect(get).toHaveBeenCalledWith(
      `${LMS}/api/uber/curriculum/v1/learner/search/`,
      { params: { q: 'safety' } },
    );
  });

  it('CUR-SEARCH-INVALID: throws when response is missing curriculums/courses arrays', async () => {
    mockHttp({ get: jest.fn().mockResolvedValue({ data: { query: 'x' } }) });
    await expect(searchLearnerContent('x')).rejects.toThrow('Unexpected search response shape');
  });
});
