/**
 * Tests for the optional-courses API client in src/api/optionalCourses.ts.
 */
import { mergeConfig } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import {
  enrollInOptionalCourse,
  getOptionalCourses,
  optionalEnrollErrorCode,
} from '../api/optionalCourses';

jest.mock('@edx/frontend-platform/auth', () => ({
  getAuthenticatedHttpClient: jest.fn(),
}));

const LMS = 'https://learn.uber.example';
const COURSE = {
  course_id: 'course-v1:Uber+OPT101+2026',
  display_name: 'Night driving tips',
  short_description: 'Stay safe after dark.',
  image_url: null,
  is_enrolled: false,
  groups: [{ slug: 'night', title: 'Night drivers' }],
};

const mockGet = jest.fn();
const mockPost = jest.fn();

/** An axios-style error carrying an HTTP response. */
function httpError(status: number, data: unknown) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mergeConfig({ LMS_BASE_URL: LMS });
  jest.mocked(getAuthenticatedHttpClient).mockReturnValue({ get: mockGet, post: mockPost } as never);
});

describe('getOptionalCourses', () => {
  it('returns the results from the LMS', async () => {
    mockGet.mockResolvedValue({ data: { results: [COURSE] } });

    await expect(getOptionalCourses()).resolves.toEqual([COURSE]);
    expect(mockGet).toHaveBeenCalledWith(`${LMS}/api/uber/optional-courses/v1/courses/`);
  });

  it.each([
    [{ results: [] }],
    [{}],
    [null],
  ])('returns an empty list for %p', async (data) => {
    mockGet.mockResolvedValue({ data });

    await expect(getOptionalCourses()).resolves.toEqual([]);
  });

  it('lets a failure through', async () => {
    mockGet.mockRejectedValue(httpError(500, undefined));

    await expect(getOptionalCourses()).rejects.toThrow('500');
  });
});

describe('enrollInOptionalCourse', () => {
  it('posts the course key with the authenticated client', async () => {
    mockPost.mockResolvedValue({ data: { course_id: COURSE.course_id } });

    await enrollInOptionalCourse(COURSE.course_id);

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith(
      `${LMS}/api/uber/optional-courses/v1/courses/enroll/`,
      { course_id: COURSE.course_id },
    );
  });

  it('lets a refusal through', async () => {
    const error = httpError(404, { error_code: 'not_optional_for_learner' });
    mockPost.mockRejectedValue(error);

    await expect(enrollInOptionalCourse(COURSE.course_id)).rejects.toBe(error);
  });
});

describe('optionalEnrollErrorCode', () => {
  it.each([
    [httpError(404, { error_code: 'not_optional_for_learner' }), 'not_optional_for_learner'],
    [httpError(403, { error_code: 'enrollment_not_allowed' }), 'enrollment_not_allowed'],
    [httpError(403, { detail: 'CSRF Failed: CSRF token missing.' }), 'unknown'],
    [httpError(400, { error_code: 'something_new' }), 'unknown'],
    [httpError(502, '<html></html>'), 'unknown'],
    [new Error('Network Error'), 'unknown'],
    [null, 'unknown'],
    ['boom', 'unknown'],
  ])('maps %p to %p', (error, expected) => {
    expect(optionalEnrollErrorCode(error)).toBe(expected);
  });
});
