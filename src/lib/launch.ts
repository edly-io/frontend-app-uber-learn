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
export const LAUNCH_PARAMS_MAX = 4096;

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

/** Longest `next` path the page follows; app paths are far shorter. */
export const NEXT_PATH_MAX = 512;

/** One leading '/' (not '//'), then no backslash, whitespace or fragment. */
const NEXT_PATH_PATTERN = /^\/(?![/\\])[^\\\s#]*$/;

/** Placeholder origin used only to check how a browser would resolve `next`. */
const PROBE_ORIGIN = 'https://app.invalid';

/**
 * The full MFE URL for `next`, the app path the LMS answers a launch with
 * ('/', '/course/<course key>', '/?section=optional'), or null when it is not a
 * safe in-app path.
 *
 * `next` is relative to the app's base path, so '/course/x' becomes
 * '/uber-learn/course/x'. It must start with a single '/', contain no
 * backslash, whitespace or fragment, and resolve to itself: dot segments
 * ('/../logout', '/%2e%2e/logout') would leave the app and characters a browser
 * would re-encode would change it, so both are refused, as is the launch page.
 */
export function appPathFor(
  next: unknown,
  publicPath: string = getConfig().PUBLIC_PATH,
): string | null {
  if (typeof next !== 'string' || next.length > NEXT_PATH_MAX || !NEXT_PATH_PATTERN.test(next)) {
    return null;
  }
  let resolved: URL;
  try {
    resolved = new URL(next, PROBE_ORIGIN);
  } catch {
    return null;
  }
  if (resolved.origin !== PROBE_ORIGIN || `${resolved.pathname}${resolved.search}` !== next) {
    return null;
  }
  const path = `${appBasePath(publicPath)}${next.slice(1)}`;
  if (isLaunchPath(path.split('?')[0], publicPath)) {
    return null;
  }
  return path;
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

/**
 * Reloads the launch page on its current URL.
 *
 * src/index.jsx calls this when another launch link is opened in the same
 * tab. Such a link differs from the stripped launch URL only in its fragment,
 * so the browser does not load the page again by itself. The reload runs the
 * boot code on the new URL, which reads, strips and sends the new string like
 * any first load.
 */
export function reloadPage(): void {
  window.location.reload();
}
