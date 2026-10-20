import { getConfig } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';

/**
 * Outcomes the launch page can show. All but 'incomplete_link' come from the
 * LMS (POST /api/uber/launch/v1/); 'incomplete_link' is decided in the browser
 * when there is no launch string to send.
 */
export type LaunchErrorCode =
  | 'invalid_link'
  | 'expired_link'
  | 'used_link'
  | 'course_unavailable'
  | 'enrollment_not_allowed'
  | 'login_prevented'
  | 'account_unavailable'
  | 'session_conflict'
  | 'launch_disabled'
  | 'try_again'
  | 'incomplete_link';

const SERVER_ERROR_CODES: ReadonlySet<string> = new Set<LaunchErrorCode>([
  'invalid_link',
  'expired_link',
  'used_link',
  'course_unavailable',
  'enrollment_not_allowed',
  'login_prevented',
  'account_unavailable',
  'session_conflict',
  'launch_disabled',
  'try_again',
]);

export class LaunchError extends Error {
  readonly code: LaunchErrorCode;

  /** Learner-safe text from the LMS (enrollment and login filters only). */
  readonly userMessage: string | null;

  /** HTTP status, or null when no response arrived. */
  readonly status: number | null;

  constructor(code: LaunchErrorCode, userMessage: string | null = null, status: number | null = null) {
    // The message names the outcome only; it never includes the launch string.
    super(`Uber launch failed: ${code}`);
    this.name = 'LaunchError';
    this.code = code;
    this.userMessage = userMessage;
    this.status = status;
  }
}

export interface LaunchResult {
  /**
   * Where to go next, as an app path relative to the MFE's base path ('/',
   * '/course/<course key>', '/?section=optional'), or null when the LMS sent
   * none. Untrusted: the page checks it before following it.
   */
  next: string | null;
  /** The course key the learner was enrolled in, or null when the launch named no course. */
  courseId: string | null;
}

interface ErrorResponseShape {
  response?: {
    status?: unknown;
    data?: unknown;
  };
}

/**
 * Turns anything postLaunch can throw into a LaunchError.
 *
 * Known `error_code` values from the LMS map through, with `user_message` when
 * it is a string. Everything else (no response, 5xx, DRF `{detail}` errors such
 * as a CSRF 403 or a 415, or an unknown code) becomes 'try_again': the LMS
 * rolls those back, so sending the same link again is safe.
 */
export function toLaunchError(error: unknown): LaunchError {
  if (error instanceof LaunchError) {
    return error;
  }
  const response = (error as ErrorResponseShape | null)?.response;
  const status = typeof response?.status === 'number' ? response.status : null;
  const data = response?.data;
  if (data && typeof data === 'object') {
    const { error_code: code, user_message: userMessage } = data as Record<string, unknown>;
    if (typeof code === 'string' && SERVER_ERROR_CODES.has(code)) {
      return new LaunchError(
        code as LaunchErrorCode,
        typeof userMessage === 'string' ? userMessage : null,
        status,
      );
    }
  }
  return new LaunchError('try_again', null, status);
}

/**
 * Sends the signed launch string to the LMS, which verifies it, signs the
 * learner in (setting the session and JWT cookies), enrolls them, and answers
 * with the page to open (`next`) and the course, if any (`course_id`).
 *
 * The launch string is opaque here and is never logged.
 */
export async function postLaunch(launch: string): Promise<LaunchResult> {
  const url = `${getConfig().LMS_BASE_URL}/api/uber/launch/v1/`;
  try {
    // isPublic: there is no session yet, so skip the JWT refresh. The CSRF
    // interceptor still runs for this POST and adds X-CSRFToken, and the
    // client sends cookies (withCredentials) so the LMS can set new ones.
    const { data } = await getAuthenticatedHttpClient().post(url, { launch }, { isPublic: true });
    const { next, course_id: courseId } = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
    return {
      next: typeof next === 'string' ? next : null,
      courseId: typeof courseId === 'string' ? courseId : null,
    };
  } catch (error) {
    throw toLaunchError(error);
  }
}
