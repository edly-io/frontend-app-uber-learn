/**
 * Helpers for the signed Uber launch page (/uber-learn/launch).
 *
 * Uber opens `${PUBLIC_PATH}launch#<launch string>` (or `?<launch string>` as a
 * fallback). The launch string is signed by Uber and verified by the LMS, so
 * the MFE treats it as opaque: it never parses it, never stores it, and only
 * forwards it to POST /api/uber/launch/v1/.
 *
 * Everything here runs in src/index.jsx before initialize(), so it must not
 * depend on anything initialize() sets up.
 */
import { getConfig } from '@edx/frontend-platform';

/** Longest launch string the page forwards; the LMS applies the same limit. */
export const LAUNCH_PARAMS_MAX = 2048;

const COURSE_ID_PATTERN = /^course-v1:[A-Za-z0-9._~:+-]+$/;

/**
 * The MFE's public path with exactly one leading and one trailing slash:
 * '/uber-learn/' for '/uber-learn' or '/uber-learn/', and '/' for '/' or ''.
 */
export function appBasePath(publicPath: string = getConfig().PUBLIC_PATH): string {
  const trimmed = (publicPath || '').replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}/` : '/';
}

/**
 * True only for the launch page itself: `${PUBLIC_PATH}launch`, with an
 * optional trailing slash. Sub-paths and look-alikes ('/launcher',
 * '/course/x/launch') do not match, so they stay behind the login.
 */
export function isLaunchPath(
  pathname: string,
  publicPath: string = getConfig().PUBLIC_PATH,
): boolean {
  const launchPath = `${appBasePath(publicPath)}launch`;
  return pathname === launchPath || pathname === `${launchPath}/`;
}

/**
 * Reads the launch string from the address bar and removes it.
 *
 * The fragment ('#...') is preferred, because browsers never send it to a
 * server or put it in a Referer. A query string ('?...') is accepted when the
 * fragment is empty. Both are always stripped with history.replaceState, so
 * the signed parameters do not stay in the address bar or in history.
 *
 * Returns the raw string without its leading '#' or '?', or null when it is
 * empty or longer than LAUNCH_PARAMS_MAX.
 */
export function takeLaunchParams(): string | null {
  const { hash, search, pathname } = window.location;
  const fromHash = hash.replace(/^#/, '');
  const raw = fromHash || search.replace(/^\?/, '');

  window.history.replaceState(window.history.state, '', pathname);

  if (!raw || raw.length > LAUNCH_PARAMS_MAX) {
    return null;
  }
  return raw;
}

/**
 * The MFE path of a course overview, or null when `courseId` is not a plain
 * course-v1 key. This guards the post-launch redirect: a value with '/', '#',
 * '?', '%' or a scheme can never become a navigation target.
 */
export function coursePathFor(
  courseId: unknown,
  publicPath: string = getConfig().PUBLIC_PATH,
): string | null {
  if (typeof courseId !== 'string' || !COURSE_ID_PATTERN.test(courseId)) {
    return null;
  }
  return `${appBasePath(publicPath)}course/${courseId}`;
}

/**
 * Leaves the launch page with a full page load, replacing the history entry.
 *
 * A full load is required: the launch page boots without a user, and the next
 * page must boot again with the new session (and the CSRF token that login
 * rotated). replace() keeps the spent launch URL out of the back stack.
 */
export function leavePage(url: string): void {
  window.location.replace(url);
}
