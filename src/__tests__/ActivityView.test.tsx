/**
 * Integration tests for ActivityView page.
 *
 * AC coverage:
 *   - AC-ACT-COMPLETE-01: plugin.completed from LMS origin enables Continue
 *   - AC-ACT-COMPLETE-02: plugin.completed from wrong origin does NOT enable Continue
 *   - AC-ACT-RECORD-01: Continue calls recordActivity with correct unit id and correctness
 *   - AC-ACT-NAV-01: Continue on non-last unit navigates to next step
 *   - AC-ACT-NAV-02: Continue on last unit navigates to course overview
 *   - AC-ACT-PM-01: Continue sends uber.continueClicked postMessage to LMS iframe
 *   - AC-ACT-RESET-01: Completion state resets when unit changes
 *   - AC-ACT-LOAD-01: Loading skeleton while sequence is fetching
 *   - AC-ACT-ERR-01: ErrorView rendered when sequence fetch fails
 *   - AC-ACT-STEP-01: StepIndicator visible when sequence has multiple units
 *   - AC-ACT-IFRAME-01: ContentIFrame renders with the current unit usage key
 */
import React from 'react';
import {
  render, screen, waitFor, fireEvent, act,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mergeConfig } from '@edx/frontend-platform';
import { ActivityView } from '../pages/ActivityView';
import * as coursewareApi from '../api/courseware';
import * as progressApi from '../api/progress';

// ---------------------------------------------------------------------------
// Routing mocks
// ---------------------------------------------------------------------------

const mockNavigate = jest.fn();
const mockUseParams = jest.fn<
{ courseId: string; sequenceId: string; unitIdx: string },
[]
>();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => mockUseParams(),
}));

// ---------------------------------------------------------------------------
// API module auto-mocks
// ---------------------------------------------------------------------------

jest.mock('../api/courseware');
jest.mock('../api/progress');

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const COURSE_ID = 'course-v1:Uber+L2024';
const SEQ_ID = 'block-v1:Uber+L2024+type@sequential+block@seq1';
const LMS_ORIGIN = 'http://localhost:18000'; // matches setupTest.ts LMS_BASE_URL

const MOCK_SEQUENCE_DATA = {
  sequence: {
    id: SEQ_ID,
    title: 'Driver Basics',
    unitIds: ['unit-1', 'unit-2'],
    activeUnitIndex: 0,
  },
  units: [
    {
      id: 'unit-1',
      sequenceId: SEQ_ID,
      title: 'Introduction',
      complete: false,
      contentType: 'video',
      graded: false,
    },
    {
      id: 'unit-2',
      sequenceId: SEQ_ID,
      title: 'Knowledge Check',
      complete: false,
      contentType: 'problem',
      graded: true,
    },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false, gcTime: 0 },
    mutations: { retry: false },
  },
});

function renderComponent() {
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <ActivityView />
    </QueryClientProvider>,
  );
}

/**
 * Simulate a postMessage from the XBlock iframe.
 * Wraps in act() because it triggers React state updates.
 */
function dispatchPluginMessage(
  type: string,
  payload: Record<string, unknown>,
  origin: string = LMS_ORIGIN,
) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        origin,
        data: { type, payload, version: 1 },
      }),
    );
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Clear ALL mock call history before each test to prevent bleed-through.
  jest.clearAllMocks();
  mockUseParams.mockReturnValue({ courseId: COURSE_ID, sequenceId: SEQ_ID, unitIdx: '0' });
  jest.mocked(coursewareApi.getSequenceMetadata).mockResolvedValue(MOCK_SEQUENCE_DATA);
  jest.mocked(progressApi.recordActivity).mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ActivityView', () => {
  describe('loading and error states', () => {
    it('AC-ACT-LOAD-01: shows "Loading…" heading while the sequence is fetching', () => {
      jest.mocked(coursewareApi.getSequenceMetadata).mockReturnValue(new Promise(() => {}));

      renderComponent();

      // ActivityView renders <NavHeader title="Loading…"> while loading
      expect(screen.getByRole('heading', { level: 1, name: /loading/i })).toBeInTheDocument();
    });

    it('AC-ACT-ERR-01: shows ErrorView when sequence fetch fails', async () => {
      jest.mocked(coursewareApi.getSequenceMetadata).mockRejectedValue(
        new Error('Sequence not found'),
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
      expect(screen.getByText(/could not load lesson/i)).toBeInTheDocument();
    });
  });

  describe('iframe and navigation display', () => {
    it('AC-ACT-IFRAME-01: ContentIFrame is rendered with the current unit usage key', async () => {
      renderComponent();

      await waitFor(() => {
        const iframe = document.querySelector<HTMLIFrameElement>(
          '[data-usage-key="unit-1"]',
        );
        expect(iframe).toBeInTheDocument();
      });
    });

    it('AC-ACT-STEP-01: StepIndicator is visible when sequence has multiple units', async () => {
      renderComponent();

      await waitFor(() => {
        // StepIndicator renders aria-label="Step 1 of 2"
        expect(screen.getByLabelText(/step 1 of 2/i)).toBeInTheDocument();
      });
    });

    it('renders "Continue" on non-last unit and "Finish" on the last unit', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument());

      // Re-render with last unit (idx=1 = last of 2)
      mockUseParams.mockReturnValue({ courseId: COURSE_ID, sequenceId: SEQ_ID, unitIdx: '1' });
      renderComponent();
      await waitFor(() => expect(screen.getAllByRole('button', { name: /finish/i }).length).toBeGreaterThan(0));
    });
  });

  describe('plugin.completed security and state', () => {
    it('AC-ACT-COMPLETE-01: Continue button is disabled before plugin.completed', async () => {
      renderComponent();

      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument());

      expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    });

    it('AC-ACT-COMPLETE-01b: plugin.completed from LMS origin enables Continue', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument());

      dispatchPluginMessage('plugin.completed', { correct: true });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled();
      });
    });

    it('AC-ACT-COMPLETE-02: plugin.completed from wrong origin does NOT enable Continue', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument());

      dispatchPluginMessage('plugin.completed', { correct: true }, 'https://evil.example.com');

      // State should not change — button remains disabled
      expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    });

    it('plugin.resize from LMS origin does NOT enable Continue (sizing only)', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument());

      dispatchPluginMessage('plugin.resize', { height: 600 });

      expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    });

    it('plugin.videoEnded from LMS origin enables Continue (video completion path)', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument());

      dispatchPluginMessage('plugin.videoEnded', {});

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled();
      });
    });
  });

  describe('Continue button: recordActivity', () => {
    it('AC-ACT-RECORD-01: calls recordActivity with courseId, unitId, and correct=true', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument());

      dispatchPluginMessage('plugin.completed', { correct: true });
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled());

      fireEvent.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(progressApi.recordActivity).toHaveBeenCalledTimes(1);
        expect(progressApi.recordActivity).toHaveBeenCalledWith({
          courseId: COURSE_ID,
          unitId: 'unit-1',
          correct: true,
        });
      });
    });

    it('AC-ACT-RECORD-01b: passes correct=false when plugin.completed reported incorrect', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument());

      dispatchPluginMessage('plugin.completed', { correct: false });
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled());

      fireEvent.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(progressApi.recordActivity).toHaveBeenCalledTimes(1);
        expect(progressApi.recordActivity).toHaveBeenCalledWith({
          courseId: COURSE_ID,
          unitId: 'unit-1',
          correct: false,
        });
      });
    });

    it('AC-ACT-RECORD-01c: passes correct=null for video completion (no correctness)', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument());

      // plugin.videoEnded sets correct=null
      dispatchPluginMessage('plugin.videoEnded', {});
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled());

      fireEvent.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(progressApi.recordActivity).toHaveBeenCalledTimes(1);
        expect(progressApi.recordActivity).toHaveBeenCalledWith({
          courseId: COURSE_ID,
          unitId: 'unit-1',
          correct: null,
        });
      });
    });
  });

  describe('Continue button: navigation', () => {
    it('AC-ACT-NAV-01: navigates to step/1 when current unit is not the last', async () => {
      // unitIdx=0, 2 units → next step is step/1
      renderComponent();
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument());

      dispatchPluginMessage('plugin.completed', { correct: true });
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled());

      fireEvent.click(screen.getByRole('button', { name: /continue/i }));

      expect(mockNavigate).toHaveBeenCalledWith(
        `/uber-learn/course/${COURSE_ID}/lesson/${SEQ_ID}/step/1`,
      );
    });

    it('AC-ACT-NAV-02: navigates to course overview when on the last unit', async () => {
      // unitIdx=1 = last of 2 units
      mockUseParams.mockReturnValue({ courseId: COURSE_ID, sequenceId: SEQ_ID, unitIdx: '1' });

      renderComponent();
      await waitFor(() => expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument());

      dispatchPluginMessage('plugin.completed', { correct: true });
      await waitFor(() => expect(screen.getByRole('button', { name: /finish/i })).not.toBeDisabled());

      fireEvent.click(screen.getByRole('button', { name: /finish/i }));

      // The non-assessment last-unit flow shows LessonCompleteOverlay before navigating.
      // Dismiss the overlay by clicking it, which triggers handleLessonCompleteDismiss.
      await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('status'));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(`/uber-learn/course/${COURSE_ID}`);
      });
    });
  });

  describe('showing the unit before the iframe load event', () => {
    beforeEach(() => mergeConfig({ UBER_LIGHTWEIGHT_IFRAMES: true }));
    afterEach(() => mergeConfig({ UBER_LIGHTWEIGHT_IFRAMES: undefined }));

    /** Simulate the unversioned plugin.resize the LMS posts once the unit's DOM is built. */
    function dispatchFrameResize(source: MessageEventSource | null, origin: string = LMS_ORIGIN) {
      act(() => {
        window.dispatchEvent(new MessageEvent('message', {
          origin,
          source,
          data: { type: 'plugin.resize', payload: { width: 400, height: 600 } },
        }));
      });
    }
    const getFrame = () => document.querySelector<HTMLIFrameElement>('.content-iframe-frame')!;
    const spinner = () => document.querySelector('.content-iframe-spinner');

    it('first plugin.resize from the unit iframe hides the spinner and enables Continue', async () => {
      renderComponent();
      await waitFor(() => expect(getFrame()).toBeInTheDocument());
      expect(spinner()).toBeInTheDocument();

      dispatchFrameResize(getFrame().contentWindow);

      await waitFor(() => expect(spinner()).not.toBeInTheDocument());
      expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled();
    });

    it('ignores plugin.resize from another window on the LMS origin', async () => {
      renderComponent();
      await waitFor(() => expect(getFrame()).toBeInTheDocument());

      dispatchFrameResize(window);

      expect(spinner()).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    });

    it('ignores plugin.resize from the iframe when the origin is not the LMS', async () => {
      renderComponent();
      await waitFor(() => expect(getFrame()).toBeInTheDocument());

      dispatchFrameResize(getFrame().contentWindow, 'https://evil.example.com');

      expect(spinner()).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    });

    it('waits for the iframe load event when lightweight mode is off', async () => {
      mergeConfig({ UBER_LIGHTWEIGHT_IFRAMES: false });
      renderComponent();
      await waitFor(() => expect(getFrame()).toBeInTheDocument());

      dispatchFrameResize(getFrame().contentWindow);

      expect(spinner()).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();

      fireEvent.load(getFrame());

      await waitFor(() => expect(spinner()).not.toBeInTheDocument());
    });

    it('still shows the unit on the iframe load event (no plugin.resize)', async () => {
      renderComponent();
      await waitFor(() => expect(getFrame()).toBeInTheDocument());

      fireEvent.load(getFrame());

      await waitFor(() => expect(spinner()).not.toBeInTheDocument());
      expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled();
    });
  });

  describe('AC-ACT-PM-01: uber.continueClicked postMessage to LMS iframe', () => {
    // Isolate the contentWindow override to this describe block only.
    const mockPostMessage = jest.fn();

    beforeEach(() => {
      mockPostMessage.mockClear();
      Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
        get() { return { postMessage: mockPostMessage }; },
        configurable: true,
      });
    });

    afterEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (HTMLIFrameElement.prototype as any).contentWindow;
    });

    it('sends uber.continueClicked to the LMS origin via the iframe contentWindow', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument());

      dispatchPluginMessage('plugin.completed', { correct: true });
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled());

      fireEvent.click(screen.getByRole('button', { name: /continue/i }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        { type: 'uber.continueClicked', version: 1 },
        LMS_ORIGIN,
      );
    });

    it('does NOT send uber.continueClicked when Continue is clicked before plugin.completed', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument());

      // Click while disabled — handler guards with `if (!isCompleted) return`
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));

      expect(mockPostMessage).not.toHaveBeenCalled();
      expect(progressApi.recordActivity).not.toHaveBeenCalled();
    });
  });

  describe('AC-ACT-RESET-01: completion state resets on unit change', () => {
    it('Continue becomes disabled again after unit index changes', async () => {
      // Step 1: render unit 0, complete it
      renderComponent();
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument());

      dispatchPluginMessage('plugin.completed', { correct: true });
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled());

      // Step 2: simulate navigation to next unit by re-rendering with unitIdx=1
      mockUseParams.mockReturnValue({ courseId: COURSE_ID, sequenceId: SEQ_ID, unitIdx: '1' });
      renderComponent();

      await waitFor(() => {
        // After unit change, isCompleted resets to false — button should be disabled again
        const finishBtns = screen.getAllByRole('button', { name: /finish/i });
        // The freshest render's button should be disabled
        expect(finishBtns[finishBtns.length - 1]).toBeDisabled();
      });
    });
  });
});
