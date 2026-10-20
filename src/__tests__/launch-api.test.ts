/**
 * Tests for postLaunch and the LMS error mapping in src/api/launch.ts.
 */
import { mergeConfig } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import {
  LaunchError,
  postLaunch,
  toLaunchError,
  type LaunchErrorCode,
} from '../api/launch';

jest.mock('@edx/frontend-platform/auth', () => ({
  getAuthenticatedHttpClient: jest.fn(),
}));

const LMS = 'https://learn.uber.example';
const LAUNCH = 'external_id=a&course_id=course-v1%3AUber%2BDRV101%2B2026_Q4&expires=1&nonce=n&sig=s';

const mockPost = jest.fn();

/** An axios-style error carrying an HTTP response. */
function httpError(status: number, data: unknown) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data },
  });
}

async function launchError(promise: Promise<unknown>): Promise<LaunchError> {
  try {
    await promise;
  } catch (error) {
    return error as LaunchError;
  }
  throw new Error('expected postLaunch to reject');
}

beforeEach(() => {
  jest.clearAllMocks();
  mergeConfig({ LMS_BASE_URL: LMS });
  jest.mocked(getAuthenticatedHttpClient).mockReturnValue({ post: mockPost } as never);
});

describe('postLaunch', () => {
  it('posts the launch string to the LMS as a public request', async () => {
    mockPost.mockResolvedValue({ data: { course_id: 'course-v1:Uber+DRV101+2026_Q4' } });

    await postLaunch(LAUNCH);

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith(
      `${LMS}/api/uber/launch/v1/`,
      { launch: LAUNCH },
      { isPublic: true },
    );
  });

  it('maps next and course_id', async () => {
    mockPost.mockResolvedValue({
      data: { next: '/course/course-v1:Uber+DRV101+2026_Q4', course_id: 'course-v1:Uber+DRV101+2026_Q4' },
    });

    await expect(postLaunch(LAUNCH)).resolves.toEqual({
      next: '/course/course-v1:Uber+DRV101+2026_Q4',
      courseId: 'course-v1:Uber+DRV101+2026_Q4',
    });
  });

  it('maps a launch without a course', async () => {
    mockPost.mockResolvedValue({ data: { next: '/?section=optional', course_id: null } });

    await expect(postLaunch(LAUNCH)).resolves.toEqual({ next: '/?section=optional', courseId: null });
  });

  it('maps a body without next (an older LMS)', async () => {
    mockPost.mockResolvedValue({ data: { course_id: 'course-v1:Uber+DRV101+2026_Q4' } });

    await expect(postLaunch(LAUNCH)).resolves.toEqual({
      next: null,
      courseId: 'course-v1:Uber+DRV101+2026_Q4',
    });
  });

  it.each([
    [{}],
    [{ next: 42, course_id: 42 }],
    [{ next: ['/'], course_id: {} }],
    [null],
    ['<html></html>'],
  ])('returns null next and courseId when the 200 body is %p', async (data) => {
    mockPost.mockResolvedValue({ data });

    await expect(postLaunch(LAUNCH)).resolves.toEqual({ next: null, courseId: null });
  });

  const SERVER_CODES: Array<[LaunchErrorCode, number]> = [
    ['invalid_link', 400],
    ['invalid_link', 403],
    ['expired_link', 403],
    ['used_link', 409],
    ['course_unavailable', 404],
    ['enrollment_not_allowed', 403],
    ['login_prevented', 403],
    ['account_unavailable', 403],
    ['session_conflict', 409],
    ['launch_disabled', 404],
    ['try_again', 503],
  ];

  it.each(SERVER_CODES)('maps the LMS error_code %p (HTTP %p)', async (code, status) => {
    mockPost.mockRejectedValue(httpError(status, { error_code: code, user_message: null }));

    const error = await launchError(postLaunch(LAUNCH));

    expect(error).toBeInstanceOf(LaunchError);
    expect(error.code).toBe(code);
    expect(error.status).toBe(status);
    expect(error.userMessage).toBeNull();
  });

  it.each(['enrollment_not_allowed', 'login_prevented'])('keeps the user_message of %p', async (code) => {
    mockPost.mockRejectedValue(httpError(403, {
      error_code: code,
      user_message: 'This knowledge check opens on 2026-10-20.',
    }));

    const error = await launchError(postLaunch(LAUNCH));

    expect(error.code).toBe(code);
    expect(error.userMessage).toBe('This knowledge check opens on 2026-10-20.');
  });

  it('ignores a user_message that is not a string', async () => {
    mockPost.mockRejectedValue(httpError(403, { error_code: 'login_prevented', user_message: { html: '<b>' } }));

    expect((await launchError(postLaunch(LAUNCH))).userMessage).toBeNull();
  });

  it.each([
    ['a network error (no response)', Object.assign(new Error('Network Error'), { request: {} })],
    ['a 502 with an HTML body', httpError(502, '<!DOCTYPE html><html></html>')],
    ['a 500 with no body', httpError(500, undefined)],
    ['a DRF CSRF 403', httpError(403, { detail: 'CSRF Failed: CSRF token missing.' })],
    ['a DRF 415', httpError(415, { detail: 'Unsupported media type "text/plain" in request.' })],
    ['a DRF 405', httpError(405, { detail: 'Method "GET" not allowed.' })],
    ['an unknown error_code', httpError(400, { error_code: 'something_new', user_message: 'x' })],
    ['the client-only incomplete_link code', httpError(400, { error_code: 'incomplete_link' })],
    ['a non-Error rejection', 'boom'],
  ])('maps %s to try_again', async (_label, rejection) => {
    mockPost.mockRejectedValue(rejection);

    const error = await launchError(postLaunch(LAUNCH));

    expect(error).toBeInstanceOf(LaunchError);
    expect(error.code).toBe('try_again');
    expect(error.userMessage).toBeNull();
  });

  it('keeps the status of a failed response that maps to try_again', async () => {
    mockPost.mockRejectedValue(httpError(502, '<html></html>'));

    expect((await launchError(postLaunch(LAUNCH))).status).toBe(502);
  });

  it('reads the response through the prototype chain, as frontend-platform wraps axios errors', async () => {
    const wrapped = Object.create(httpError(409, { error_code: 'used_link', user_message: null }));
    mockPost.mockRejectedValue(wrapped);

    expect((await launchError(postLaunch(LAUNCH))).code).toBe('used_link');
  });

  it('never puts the launch string in the error', async () => {
    mockPost.mockRejectedValue(httpError(403, { error_code: 'invalid_link', user_message: null }));

    const error = await launchError(postLaunch(LAUNCH));

    expect(error.message).not.toContain(LAUNCH);
    expect(error.message).not.toContain('sig=');
  });
});

describe('toLaunchError', () => {
  it('returns a LaunchError unchanged', () => {
    const original = new LaunchError('used_link', null, 409);
    expect(toLaunchError(original)).toBe(original);
  });

  it('maps null and undefined to try_again', () => {
    expect(toLaunchError(null).code).toBe('try_again');
    expect(toLaunchError(undefined).code).toBe('try_again');
  });
});
