/**
 * Tests for the signed Uber launch page.
 *
 * Coverage:
 *   - LAUNCH-01: no launch string -> "incomplete" state, nothing is sent
 *   - LAUNCH-02: loading state while the LMS answers
 *   - LAUNCH-03: exactly one POST, even under StrictMode
 *   - LAUNCH-04: success leaves for the course overview with a full page load
 *   - LAUNCH-05: a course_id that is not a course-v1 key is never navigated to
 *   - LAUNCH-06: every outcome renders its title and copy
 *   - LAUNCH-07: secondary actions (Try again, Sign out, Go to my courses)
 *   - LAUNCH-08: layout: one <main>, and every action in the ErrorView footer
 */
import React, { StrictMode } from 'react';
import {
  render, screen, waitFor, fireEvent,
} from '@testing-library/react';
import { mergeConfig } from '@edx/frontend-platform';
import { getAuthenticatedUser, redirectToLogout } from '@edx/frontend-platform/auth';
import { LAUNCH_COPY, LaunchPage } from '../pages/LaunchPage';
import { LaunchError, postLaunch, type LaunchErrorCode } from '../api/launch';
import { leavePage } from '../lib/launch';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../api/launch', () => ({
  ...jest.requireActual('../api/launch'),
  postLaunch: jest.fn(),
}));

jest.mock('../lib/launch', () => ({
  ...jest.requireActual('../lib/launch'),
  leavePage: jest.fn(),
}));

jest.mock('@edx/frontend-platform/auth', () => ({
  getAuthenticatedUser: jest.fn(),
  redirectToLogout: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Test data and helpers
// ---------------------------------------------------------------------------

const LAUNCH = 'external_id=test-learner-0001&course_id=course-v1%3AUber%2BDRV101%2B2026_Q4'
  + '&expires=1791547200&nonce=n0nce-test-vector-0001&sig=DaKexTWl64m1_Y_NvCTFYbyLf6McI5jT-ARahux_Zuc';
const COURSE_ID = 'course-v1:Uber+DRV101+2026_Q4';
const LEARNER = { userId: 7, username: 'uber_0123456789abcdef0123', administrator: false };

function renderPage(launch: string | null = LAUNCH) {
  return render(
    <StrictMode>
      <LaunchPage launch={launch} />
    </StrictMode>,
  );
}

function rejectWith(code: LaunchErrorCode, userMessage: string | null = null) {
  jest.mocked(postLaunch).mockRejectedValue(new LaunchError(code, userMessage, 403));
}

async function findAlert() {
  return screen.findByRole('alert');
}

/** The labels of the buttons in the ErrorView footer, in order. */
function footerButtons(): Array<[string, string]> {
  return Array.from(document.querySelectorAll('.ss-page > .ss-footer > button'))
    .map((button) => [button.textContent ?? '', button.className]);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mergeConfig({ PUBLIC_PATH: '/uber-learn/' });
  jest.mocked(getAuthenticatedUser).mockReturnValue(null);
  jest.mocked(postLaunch).mockResolvedValue({ courseId: COURSE_ID });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LaunchPage', () => {
  describe('LAUNCH-01: no launch string', () => {
    it('shows the incomplete-link state and sends nothing', async () => {
      renderPage(null);

      expect(await findAlert()).toBeInTheDocument();
      expect(screen.getByText('This link is incomplete')).toBeInTheDocument();
      expect(screen.getByText('Open the course again from the Uber app.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
      expect(postLaunch).not.toHaveBeenCalled();
      expect(leavePage).not.toHaveBeenCalled();
    });
  });

  describe('LAUNCH-02: loading', () => {
    it('shows a busy status while the LMS answers', () => {
      jest.mocked(postLaunch).mockReturnValue(new Promise(() => {}));

      renderPage();

      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-busy', 'true');
      expect(status).toHaveTextContent('Opening your course…');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('LAUNCH-03: single POST', () => {
    it('sends the raw launch string exactly once under StrictMode', async () => {
      renderPage();

      await waitFor(() => expect(leavePage).toHaveBeenCalled());
      expect(postLaunch).toHaveBeenCalledTimes(1);
      expect(postLaunch).toHaveBeenCalledWith(LAUNCH);
    });

    it('does not send again when it re-renders', async () => {
      const { rerender } = renderPage();
      rerender(
        <StrictMode>
          <LaunchPage launch={LAUNCH} />
        </StrictMode>,
      );

      await waitFor(() => expect(leavePage).toHaveBeenCalled());
      expect(postLaunch).toHaveBeenCalledTimes(1);
    });
  });

  describe('LAUNCH-04: success', () => {
    it('leaves for the course overview and keeps showing the loading state', async () => {
      renderPage();

      await waitFor(() => expect(leavePage).toHaveBeenCalledTimes(1));
      expect(leavePage).toHaveBeenCalledWith(`/uber-learn/course/${COURSE_ID}`);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('LAUNCH-05: unsafe course_id', () => {
    it.each([
      'https://evil.example',
      '//evil.example/course-v1:Uber+DRV101+2026_Q4',
      'course-v1:a/../../logout',
      '',
    ])('does not navigate to %p and shows try_again', async (courseId) => {
      jest.mocked(postLaunch).mockResolvedValue({ courseId });

      renderPage();

      expect(await findAlert()).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
      expect(leavePage).not.toHaveBeenCalled();
    });
  });

  describe('LAUNCH-06: outcome copy', () => {
    const EXPECTED: Array<[LaunchErrorCode, string, string]> = [
      ['invalid_link', "This link isn't valid", 'Open the course again from the Uber app.'],
      ['expired_link', 'This link has expired',
        'Course links only work for a few minutes. Open the course again from the Uber app.'],
      ['used_link', 'This link was already used',
        'For your security, each link works once. Open the course again from the Uber app.'],
      ['course_unavailable', "This course isn't available", 'Open the Uber app to choose another course.'],
      ['enrollment_not_allowed', "You can't start this course yet", 'Open the Uber app to choose another course.'],
      ['login_prevented', "You can't sign in right now", 'Contact Uber support.'],
      ['account_unavailable', "Your learning account isn't available", 'Contact Uber support.'],
      ['session_conflict', "You're signed in to a different account",
        'Sign out, then open the course again from the Uber app.'],
      ['launch_disabled', "Course links aren't available right now", 'Please try again later.'],
      ['try_again', 'Something went wrong', "We couldn't open your course. Check your connection and try again."],
    ];

    it.each(EXPECTED)('%p shows its title and message', async (code, title, message) => {
      rejectWith(code);

      renderPage();

      const alert = await findAlert();
      expect(alert).toHaveTextContent(title);
      expect(alert).toHaveTextContent(message);
      expect(leavePage).not.toHaveBeenCalled();
    });

    it('has copy for every outcome, including incomplete_link', () => {
      expect(Object.keys(LAUNCH_COPY).sort()).toEqual(
        [...EXPECTED.map(([code]) => code), 'incomplete_link'].sort(),
      );
    });

    it.each(['enrollment_not_allowed', 'login_prevented'] as LaunchErrorCode[])(
      '%p shows the message from the LMS when there is one',
      async (code) => {
        rejectWith(code, 'This knowledge check opens on 2026-10-20.');

        renderPage();

        const alert = await findAlert();
        expect(alert).toHaveTextContent('This knowledge check opens on 2026-10-20.');
        expect(alert).not.toHaveTextContent(LAUNCH_COPY[code].message);
      },
    );

    it('ignores a message from the LMS for other outcomes', async () => {
      rejectWith('invalid_link', 'unexpected server text');

      renderPage();

      const alert = await findAlert();
      expect(alert).not.toHaveTextContent('unexpected server text');
      expect(alert).toHaveTextContent('Open the course again from the Uber app.');
    });
  });

  describe('LAUNCH-07: actions', () => {
    it('"Try again" sends the same launch string again', async () => {
      rejectWith('try_again');
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

      await waitFor(() => expect(postLaunch).toHaveBeenCalledTimes(2));
      expect(postLaunch).toHaveBeenLastCalledWith(LAUNCH);
    });

    it('"Try again" goes to the course when the retry succeeds', async () => {
      jest.mocked(postLaunch)
        .mockRejectedValueOnce(new LaunchError('try_again', null, 503))
        .mockResolvedValueOnce({ courseId: COURSE_ID });
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

      await waitFor(() => expect(leavePage).toHaveBeenCalledWith(`/uber-learn/course/${COURSE_ID}`));
    });

    it.each([
      'invalid_link', 'expired_link', 'used_link', 'course_unavailable', 'enrollment_not_allowed',
      'login_prevented', 'account_unavailable', 'session_conflict', 'launch_disabled',
    ] as LaunchErrorCode[])('%p does not offer "Try again"', async (code) => {
      rejectWith(code);
      renderPage();

      await findAlert();
      expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    });

    it('"Sign out" logs out and comes back to the launch page', async () => {
      rejectWith('session_conflict');
      jest.mocked(getAuthenticatedUser).mockReturnValue(LEARNER);
      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));

      expect(redirectToLogout).toHaveBeenCalledWith(`${window.location.origin}/uber-learn/launch`);
      expect(screen.queryByRole('button', { name: 'Go to my courses' })).not.toBeInTheDocument();
    });

    it.each(['invalid_link', 'used_link', 'try_again'] as LaunchErrorCode[])(
      '%p does not offer "Sign out"',
      async (code) => {
        rejectWith(code);
        renderPage();

        await findAlert();
        expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
      },
    );

    it('"Go to my courses" is offered to a signed-in learner and opens the app home', async () => {
      rejectWith('used_link');
      jest.mocked(getAuthenticatedUser).mockReturnValue(LEARNER);
      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'Go to my courses' }));

      expect(leavePage).toHaveBeenCalledWith('/uber-learn/');
    });

    it('"Go to my courses" is offered on the incomplete-link state too', async () => {
      jest.mocked(getAuthenticatedUser).mockReturnValue(LEARNER);
      renderPage(null);

      expect(await screen.findByRole('button', { name: 'Go to my courses' })).toBeInTheDocument();
    });

    it('"Go to my courses" is not offered without a signed-in user', async () => {
      rejectWith('used_link');
      renderPage();

      await findAlert();
      expect(screen.queryByRole('button', { name: 'Go to my courses' })).not.toBeInTheDocument();
    });

    it.each(['session_conflict', 'account_unavailable'] as LaunchErrorCode[])(
      '%p never offers "Go to my courses"',
      async (code) => {
        rejectWith(code);
        jest.mocked(getAuthenticatedUser).mockReturnValue(LEARNER);
        renderPage();

        await findAlert();
        expect(screen.queryByRole('button', { name: 'Go to my courses' })).not.toBeInTheDocument();
      },
    );
  });

  describe('LAUNCH-08: layout', () => {
    it('the loading state is a single main landmark', () => {
      jest.mocked(postLaunch).mockReturnValue(new Promise(() => {}));

      renderPage();

      expect(screen.getAllByRole('main')).toHaveLength(1);
      expect(document.querySelectorAll('main')).toHaveLength(1);
    });

    it.each([
      'incomplete_link', 'used_link', 'account_unavailable', 'session_conflict', 'try_again',
    ] as LaunchErrorCode[])('%p is the ErrorView page itself, with a single <main>', async (code) => {
      jest.mocked(getAuthenticatedUser).mockReturnValue(LEARNER);
      rejectWith(code);

      const { container } = renderPage(code === 'incomplete_link' ? null : LAUNCH);

      const alert = await findAlert();
      // No wrapper around the full-height ErrorView: nothing can sit below it.
      expect(container.children).toHaveLength(1);
      expect(container.firstElementChild).toHaveClass('ss-page');
      expect(container.firstElementChild).toContainElement(alert);
      expect(document.querySelectorAll('main')).toHaveLength(1);
      expect(document.querySelector('main main')).toBeNull();
    });

    it('session_conflict puts "Sign out" in the ErrorView footer', async () => {
      rejectWith('session_conflict');

      renderPage();

      const signOut = await screen.findByRole('button', { name: 'Sign out' });
      expect(signOut.closest('.ss-footer')).not.toBeNull();
      expect(footerButtons()).toEqual([['Sign out', 'ss-footer__btn']]);
    });

    it('try_again puts "Try again" first and "Go to my courses" under it, in the footer', async () => {
      jest.mocked(getAuthenticatedUser).mockReturnValue(LEARNER);
      rejectWith('try_again');

      renderPage();

      await findAlert();
      expect(footerButtons()).toEqual([
        ['Try again', 'ss-footer__btn'],
        ['Go to my courses', 'ss-footer__secondary'],
      ]);
    });

    it('"Go to my courses" is the footer action when the outcome has none', async () => {
      jest.mocked(getAuthenticatedUser).mockReturnValue(LEARNER);
      rejectWith('used_link');

      renderPage();

      await findAlert();
      expect(footerButtons()).toEqual([['Go to my courses', 'ss-footer__btn']]);
    });

    it('an outcome with no action for this learner has no footer', async () => {
      rejectWith('used_link');

      renderPage();

      await findAlert();
      expect(document.querySelector('.ss-footer')).toBeNull();
    });
  });
});
