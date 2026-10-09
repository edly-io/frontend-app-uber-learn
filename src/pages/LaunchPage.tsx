/**
 * Signed Uber launch page (/uber-learn/launch).
 *
 * src/index.jsx renders this page instead of <App /> on the launch path, and
 * boots it without requiring a signed-in user. The page sends the signed
 * launch string to the LMS once. On success the LMS has signed the learner in
 * and enrolled them, and the page leaves with a full page load to the course,
 * where the app boots again with the new session.
 *
 * No router and no react-query: there is one request, no cache to share, and
 * the page must never send the single-use link twice by itself.
 */
import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { getAuthenticatedUser, redirectToLogout } from '@edx/frontend-platform/auth';
import { postLaunch, toLaunchError, type LaunchErrorCode } from '../api/launch';
import { appBasePath, coursePathFor, leavePage } from '../lib/launch';
import { Button } from '../components/ui/Button';
import { ErrorView } from '../components/ui/ErrorView';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import './launch-page.css';

const OPEN_AGAIN = 'Open the course again from the Uber app.';
const CHOOSE_ANOTHER = 'Open the Uber app to choose another course.';
const CONTACT_SUPPORT = 'Contact Uber support.';

export const LAUNCH_COPY: Record<LaunchErrorCode, { title: string; message: string }> = {
  incomplete_link: {
    title: 'This link is incomplete',
    message: OPEN_AGAIN,
  },
  invalid_link: {
    title: "This link isn't valid",
    message: OPEN_AGAIN,
  },
  expired_link: {
    title: 'This link has expired',
    message: `Course links only work for a few minutes. ${OPEN_AGAIN}`,
  },
  used_link: {
    title: 'This link was already used',
    message: `For your security, each link works once. ${OPEN_AGAIN}`,
  },
  course_unavailable: {
    title: "This course isn't available",
    message: CHOOSE_ANOTHER,
  },
  enrollment_not_allowed: {
    title: "You can't start this course yet",
    message: CHOOSE_ANOTHER,
  },
  login_prevented: {
    title: "You can't sign in right now",
    message: CONTACT_SUPPORT,
  },
  account_unavailable: {
    title: "Your learning account isn't available",
    message: CONTACT_SUPPORT,
  },
  session_conflict: {
    title: "You're signed in to a different account",
    message: 'Sign out, then open the course again from the Uber app.',
  },
  launch_disabled: {
    title: "Course links aren't available right now",
    message: 'Please try again later.',
  },
  try_again: {
    title: 'Something went wrong',
    message: "We couldn't open your course. Check your connection and try again.",
  },
};

/** Outcomes whose message may come from the LMS (enrollment and login filters). */
const SHOWS_USER_MESSAGE: ReadonlySet<LaunchErrorCode> = new Set<LaunchErrorCode>([
  'enrollment_not_allowed',
  'login_prevented',
]);

/** Outcomes where "Go to my courses" would be wrong: another account, or no usable account. */
const HIDES_MY_COURSES: ReadonlySet<LaunchErrorCode> = new Set<LaunchErrorCode>([
  'session_conflict',
  'account_unavailable',
]);

type LaunchState =
  | { status: 'loading' }
  | { status: 'error'; code: LaunchErrorCode; userMessage: string | null };

export interface LaunchPageProps {
  /** The raw launch string from the URL, or null when it was missing or too long. */
  launch: string | null;
}

export const LaunchPage = ({ launch }: LaunchPageProps) => {
  const [state, setState] = useState<LaunchState>(
    launch
      ? { status: 'loading' }
      : { status: 'error', code: 'incomplete_link', userMessage: null },
  );
  // StrictMode runs effects twice in development; the link is single use, so
  // the automatic POST must happen once per page load.
  const sent = useRef(false);

  const send = useCallback(() => {
    if (!launch) { return; }
    setState({ status: 'loading' });
    postLaunch(launch)
      .then(({ courseId }) => {
        const coursePath = coursePathFor(courseId);
        if (coursePath) {
          // Stay in the loading state while the browser navigates away.
          leavePage(coursePath);
          return;
        }
        setState({ status: 'error', code: 'try_again', userMessage: null });
      })
      .catch((error: unknown) => {
        const { code, userMessage } = toLaunchError(error);
        setState({ status: 'error', code, userMessage });
      });
  }, [launch]);

  useEffect(() => {
    if (sent.current) { return; }
    sent.current = true;
    send();
  }, [send]);

  if (state.status === 'loading') {
    return (
      <main className="launch-page">
        <div className="launch-page__loading" role="status" aria-busy="true">
          <LoadingSkeleton />
          <p className="launch-page__status">Opening your course…</p>
        </div>
      </main>
    );
  }

  const { code, userMessage } = state;
  const copy = LAUNCH_COPY[code];
  const message = SHOWS_USER_MESSAGE.has(code) && userMessage ? userMessage : copy.message;
  const showMyCourses = !HIDES_MY_COURSES.has(code) && getAuthenticatedUser() !== null;
  const showSignOut = code === 'session_conflict';

  return (
    <main className="launch-page">
      <ErrorView
        title={copy.title}
        message={message}
        onRetry={code === 'try_again' ? send : undefined}
      />
      {(showSignOut || showMyCourses) && (
        <div className="launch-page__actions">
          {showSignOut && (
            <Button
              fullWidth
              onClick={() => redirectToLogout(`${window.location.origin}${appBasePath()}launch`)}
            >
              Sign out
            </Button>
          )}
          {showMyCourses && (
            <Button
              fullWidth
              variant="secondary"
              onClick={() => leavePage(appBasePath())}
            >
              Go to my courses
            </Button>
          )}
        </div>
      )}
    </main>
  );
};

export default LaunchPage;
