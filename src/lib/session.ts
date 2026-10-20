/**
 * Whether a failed LMS request means the learner's session has ended.
 *
 * A persistent 401 (after the platform's own JWT-refresh attempt) usually does. But two course home APIs the
 * app reads (progress and dates) also answer 401 with the body "User not enrolled." for a signed-in learner who
 * isn't enrolled in the course. That isn't a lost session: the page shows its "not enrolled" state instead.
 */
export const NOT_ENROLLED_BODY = 'User not enrolled.';

export function endsSession(error: unknown): boolean {
  const response = (error as { response?: { status?: unknown; data?: unknown } } | null)?.response;
  return response?.status === 401 && response.data !== NOT_ENROLLED_BODY;
}

/** Whether the app is already on its "session ended" page (under any base path, such as /uber-learn). */
export function isSessionEndedPath(pathname: string): boolean {
  return pathname.endsWith('/session-ended');
}
