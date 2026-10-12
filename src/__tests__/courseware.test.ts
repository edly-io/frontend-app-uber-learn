/**
 * Unit tests for courseware.ts API functions.
 *
 * AC coverage:
 *   CW-OUTLINE-COURSE-ID:  getCourseOutline uses the courseId function argument
 *                          for the returned object's courseId, NOT data.course_key
 *                          from the API response (which does not exist on the
 *                          course_home/v1/outline endpoint).
 *   CW-OUTLINE-STRUCTURE:  parsed outline has correct sections/sequences structure
 *   CW-OUTLINE-COMPLETE:   sequence complete flag is read from the block's complete field
 */

// ---------------------------------------------------------------------------
// Imports first — jest.mock calls below are hoisted by Jest's babel transform
// so the mock factories execute before the module under test is imported.
// ---------------------------------------------------------------------------

import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { getCourseOutline } from '../api/courseware';

// ---------------------------------------------------------------------------
// Module mocks (hoisted by Jest to the top of the compiled output)
// ---------------------------------------------------------------------------

jest.mock('@edx/frontend-platform', () => ({
  getConfig: jest.fn(() => ({ LMS_BASE_URL: 'http://localhost:18000' })),
  camelCaseObject: (x: unknown) => x,
}));

jest.mock('@edx/frontend-platform/auth', () => ({
  getAuthenticatedHttpClient: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COURSE_ID_ARG = 'course-v1:Uber+Safety+2026';

const CHAPTER_ID = 'block-v1:Uber+Safety+2026+type@chapter+block@ch1';
const SEQ_ID_DONE = 'block-v1:Uber+Safety+2026+type@sequential+block@seq1';
const SEQ_ID_TODO = 'block-v1:Uber+Safety+2026+type@sequential+block@seq2';
const COURSE_BLOCK_ID = 'block-v1:Uber+Safety+2026+type@course+block@course';

/**
 * Minimal course_home/v1/outline response fixture.
 *
 * Intentionally has NO top-level `course_key` field — that field lives on
 * learning_sequences blocks, not course_home outline responses.
 * The courseId must come from the function argument.
 */
const OUTLINE_FIXTURE = {
  // No `course_key` at top level
  title: 'Fallback Title Only',
  course_blocks: {
    blocks: {
      [COURSE_BLOCK_ID]: {
        id: COURSE_BLOCK_ID,
        display_name: 'Road Safety',
        type: 'course',
        children: [CHAPTER_ID],
      },
      [CHAPTER_ID]: {
        id: CHAPTER_ID,
        display_name: 'Chapter 1',
        type: 'chapter',
        children: [SEQ_ID_DONE, SEQ_ID_TODO],
      },
      [SEQ_ID_DONE]: {
        id: SEQ_ID_DONE,
        display_name: 'Lesson One',
        type: 'sequential',
        complete: true,
      },
      [SEQ_ID_TODO]: {
        id: SEQ_ID_TODO,
        display_name: 'Lesson Two',
        type: 'sequential',
        complete: false,
      },
    },
  },
};

function mockHttpClient(responseData: unknown) {
  const mockGet = jest.fn().mockResolvedValue({ data: responseData });
  (getAuthenticatedHttpClient as jest.Mock).mockReturnValue({ get: mockGet });
  return mockGet;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getCourseOutline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('CW-OUTLINE-COURSE-ID: courseId comes from the function argument, not data.course_key', async () => {
    mockHttpClient(OUTLINE_FIXTURE);
    const outline = await getCourseOutline(COURSE_ID_ARG);
    // courseId must equal the argument, not any response field
    expect(outline.courseId).toBe(COURSE_ID_ARG);
  });

  it('CW-OUTLINE-COURSE-ID: courseId is not derived from response even when a course_key field exists', async () => {
    // Simulate a response that includes a course_key field (wrong source)
    const fixtureWithCourseKey = {
      ...OUTLINE_FIXTURE,
      course_key: 'course-v1:WRONG+wrong+wrong',
    };
    mockHttpClient(fixtureWithCourseKey);
    const outline = await getCourseOutline(COURSE_ID_ARG);
    // Must still be the argument, not the response field
    expect(outline.courseId).toBe(COURSE_ID_ARG);
    expect(outline.courseId).not.toBe('course-v1:WRONG+wrong+wrong');
  });

  it('CW-OUTLINE-STRUCTURE: sections[0].sequenceIds contains both sequence IDs in order', async () => {
    mockHttpClient(OUTLINE_FIXTURE);
    const outline = await getCourseOutline(COURSE_ID_ARG);
    expect(outline.sections[CHAPTER_ID]).toBeDefined();
    expect(outline.sections[CHAPTER_ID].sequenceIds).toEqual([SEQ_ID_DONE, SEQ_ID_TODO]);
  });

  it('CW-OUTLINE-COMPLETE: sequences[0].complete is true when block has complete: true', async () => {
    mockHttpClient(OUTLINE_FIXTURE);
    const outline = await getCourseOutline(COURSE_ID_ARG);
    expect(outline.sequences[SEQ_ID_DONE].complete).toBe(true);
  });

  it('CW-OUTLINE-COMPLETE: sequences[1].complete is false when block has complete: false', async () => {
    mockHttpClient(OUTLINE_FIXTURE);
    const outline = await getCourseOutline(COURSE_ID_ARG);
    expect(outline.sequences[SEQ_ID_TODO].complete).toBe(false);
  });

  it('CW-OUTLINE-STRUCTURE: title comes from course block display_name', async () => {
    mockHttpClient(OUTLINE_FIXTURE);
    const outline = await getCourseOutline(COURSE_ID_ARG);
    expect(outline.title).toBe('Road Safety');
  });
});
