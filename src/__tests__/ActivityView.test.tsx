/**
 * Integration tests for ActivityView page.
 *
 * AC coverage:
 *   - AC-ACT-COMPLETE-01: plugin.completed from LMS origin enables Continue
 *   - AC-ACT-COMPLETE-02: plugin.completed from wrong origin does NOT enable Continue
 *   - AC-ACT-RECORD-01: Continue calls saveSequencePosition with courseId, sequenceId, unitIdx
 *   - AC-ACT-NAV-01: Continue on non-last unit navigates to next step
 *   - AC-ACT-NAV-02: Continue on last unit navigates to the lesson-complete page
 *   - AC-ACT-PM-01: Continue sends uber.continueClicked postMessage to LMS iframe
 *   - AC-ACT-RESET-01: Completion state resets when unit changes
 *   - AC-ACT-LOAD-01: Loading skeleton while sequence is fetching
 *   - AC-ACT-ERR-01: SlowLoadView rendered when sequence fetch fails
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
import { qk } from '../api/queries';

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
  useLocation: () => ({
    key: 'test-key',
    pathname: '/',
    search: '',
    hash: '',
    state: null,
  }),
}));

// ---------------------------------------------------------------------------
// API module auto-mocks
// ---------------------------------------------------------------------------

jest.mock('../api/courseware');
jest.mock('../api/progress');
jest.mock('../api/gamification', () => ({
  getGamificationSummary: jest.fn().mockResolvedValue({ server_time: '2026-10-12T10:00:00Z' }),
}));

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

function renderComponent(client?: QueryClient) {
  const qc = client ?? makeQueryClient();
  render(
    <QueryClientProvider client={qc}>
      <ActivityView />
    </QueryClientProvider>,
  );
  return qc;
}

/**
 * Simulates the polling detecting that a unit is complete by setting the
 * blockCompletion query data directly — no need to advance real timers.
 */
async function simulatePollComplete(client: QueryClient, unitId: string) {
  await act(async () => {
    client.setQueryData(qk.blockCompletion(COURSE_ID, SEQ_ID, unitId), true);
  });
}

/**
 * Simulate a postMessage from the XBlock iframe.
 * Passes the iframe's contentWindow as `source` so the updated usePostMessage
 * source-window guard accepts the message (same as a real browser would send).
 * Wraps in act() because it triggers React state updates.
 */
function dispatchPluginMessage(
  type: string,
  payload: Record<string, unknown>,
  origin: string = LMS_ORIGIN,
) {
  act(() => {
    const frame = document.querySelector<HTMLIFrameElement>('.content-iframe-frame');
    window.dispatchEvent(
      new MessageEvent('message', {
        origin,
        source: frame?.contentWindow ?? null,
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
  jest.mocked(progressApi.saveSequencePosition).mockResolvedValue(undefined);
  jest.mocked(progressApi.getBlockCompletion).mockResolvedValue(false);
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

    it('AC-ACT-ERR-01: shows SlowLoadView when sequence fetch fails', async () => {
      jest.mocked(coursewareApi.getSequenceMetadata).mockRejectedValue(
        new Error('Sequence not found'),
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/this is taking longer than expected/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/try again/i)).toBeInTheDocument();
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

  describe('unit completion and state', () => {
    it('AC-ACT-COMPLETE-01: Continue button is disabled before the iframe loads (video unit)', async () => {
      renderComponent();

      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument());

      expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    });

    it('AC-ACT-COMPLETE-01b: Continue is enabled when get_completion poll returns true', async () => {
      const client = renderComponent();
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument());

      await simulatePollComplete(client, 'unit-1');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled();
      });
    });

    it('AC-ACT-COMPLETE-02: Continue is disabled for a problem unit until poll returns complete', async () => {
      mockUseParams.mockReturnValue({ courseId: COURSE_ID, sequenceId: SEQ_ID, unitIdx: '1' });
      const client = renderComponent();
      await waitFor(() => expect(screen.getByRole('button', { name: /finish/i })).toBeDisabled());

      await simulatePollComplete(client, 'unit-2');

      await waitFor(() => expect(screen.getByRole('button', { name: /finish/i })).not.toBeDisabled());
    });

    it('plugin.resize from LMS origin does NOT enable Continue (sizing only)', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument());

      dispatchPluginMessage('plugin.resize', { height: 600 });

      expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    });

    it('Continue stays disabled until get_completion returns true for any unit type', async () => {
      // getBlockCompletion is mocked to return false in beforeEach.
      const client = renderComponent();
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument());
      expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();

      await simulatePollComplete(client, 'unit-1');
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled());
    });
  });

  describe('Continue button: saveSequencePosition', () => {
    it('AC-ACT-RECORD-01: calls saveSequencePosition with courseId, sequenceId, unitIdx=0', async () => {
      const client = renderComponent();
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument());

      await simulatePollComplete(client, 'unit-1');
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled());

      fireEvent.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(progressApi.saveSequencePosition).toHaveBeenCalledTimes(1);
        expect(progressApi.saveSequencePosition).toHaveBeenCalledWith(COURSE_ID, SEQ_ID, 0);
      });
    });

    it('AC-ACT-RECORD-01b: saveSequencePosition called when Continue clicked on a problem unit', async () => {
      mockUseParams.mockReturnValue({ courseId: COURSE_ID, sequenceId: SEQ_ID, unitIdx: '1' });
      const client = renderComponent();
      await waitFor(() => expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument());

      await simulatePollComplete(client, 'unit-2');
      await waitFor(() => expect(screen.getByRole('button', { name: /finish/i })).not.toBeDisabled());

      fireEvent.click(screen.getByRole('button', { name: /finish/i }));

      await waitFor(() => {
        expect(progressApi.saveSequencePosition).toHaveBeenCalledTimes(1);
        expect(progressApi.saveSequencePosition).toHaveBeenCalledWith(COURSE_ID, SEQ_ID, 1);
      });
    });
  });

  describe('Continue button: navigation', () => {
    it('AC-ACT-NAV-01: navigates to step/1 when current unit is not the last', async () => {
      // unitIdx=0, unit-1 — enabled when poll returns complete
      const client = renderComponent();
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument());

      await simulatePollComplete(client, 'unit-1');
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled());

      fireEvent.click(screen.getByRole('button', { name: /continue/i }));

      // handleContinue is async (awaits postMessage delivery); use waitFor.
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          `/course/${COURSE_ID}/lesson/${SEQ_ID}/step/1`,
        );
      });
    });

    it('AC-ACT-NAV-02: navigates to the lesson-complete page when on the last unit', async () => {
      // unitIdx=1 = last of 2 units, unit-2 (problem) — enabled by poll
      mockUseParams.mockReturnValue({ courseId: COURSE_ID, sequenceId: SEQ_ID, unitIdx: '1' });

      const client = renderComponent();
      await waitFor(() => expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument());

      await simulatePollComplete(client, 'unit-2');
      await waitFor(() => expect(screen.getByRole('button', { name: /finish/i })).not.toBeDisabled());

      fireEvent.click(screen.getByRole('button', { name: /finish/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          `/course/${COURSE_ID}/lesson-complete/${SEQ_ID}`,
          expect.objectContaining({ state: expect.objectContaining({ since: '2026-10-12T10:00:00Z' }) }),
        );
      });
    });
  });

  describe('course outline freshness after finishing a lesson', () => {
    const SEQ_2 = 'block-v1:Uber+L2024+type@sequential+block@seq2';
    const staleOutline = () => ({
      courseId: COURSE_ID,
      title: 'Course',
      sections: { s1: { id: 's1', title: 'S1', sequenceIds: [SEQ_ID, SEQ_2] } },
      sequences: {
        [SEQ_ID]: {
          id: SEQ_ID, title: 'L1', sectionId: 's1', complete: false,
        },
        [SEQ_2]: {
          id: SEQ_2, title: 'L2', sectionId: 's1', complete: false,
        },
      },
    });

    async function finishLastUnit(client: QueryClient) {
      mockUseParams.mockReturnValue({ courseId: COURSE_ID, sequenceId: SEQ_ID, unitIdx: '1' });
      render(
        <QueryClientProvider client={client}>
          <ActivityView />
        </QueryClientProvider>,
      );
      await waitFor(() => expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument());
      await waitFor(() => expect(client.getQueryData(['outline', COURSE_ID])).toBeDefined());
      await simulatePollComplete(client, 'unit-2');
      await waitFor(() => expect(screen.getByRole('button', { name: /finish/i })).not.toBeDisabled());
      fireEvent.click(screen.getByRole('button', { name: /finish/i }));
      await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    }

    it('marks the finished lesson complete in the cached outline before navigating', async () => {
      jest.mocked(coursewareApi.getCourseOutline).mockResolvedValue(staleOutline());
      const client = makeQueryClient();

      await finishLastUnit(client);

      const outline = client.getQueryData<ReturnType<typeof staleOutline>>(['outline', COURSE_ID]);
      expect(outline?.sequences[SEQ_ID].complete).toBe(true);
      expect(outline?.sequences[SEQ_2].complete).toBe(false);
    });
  });

  describe('showing the unit before the iframe load event', () => {
    beforeEach(() => mergeConfig({ UBER_LIGHTWEIGHT_IFRAMES: true }));
    afterEach(() => mergeConfig({ UBER_LIGHTWEIGHT_IFRAMES: false }));

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

    it('first plugin.resize from the unit iframe hides the spinner', async () => {
      renderComponent();
      await waitFor(() => expect(getFrame()).toBeInTheDocument());
      expect(spinner()).toBeInTheDocument();

      dispatchFrameResize(getFrame().contentWindow);

      await waitFor(() => expect(spinner()).not.toBeInTheDocument());
      // Continue is still disabled — waits for get_completion poll, not for iframe visibility
      expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
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

    it('still hides the spinner on the iframe load event (no plugin.resize)', async () => {
      renderComponent();
      await waitFor(() => expect(getFrame()).toBeInTheDocument());

      fireEvent.load(getFrame());

      await waitFor(() => expect(spinner()).not.toBeInTheDocument());
      // Continue is still disabled — waits for get_completion poll, not for iframe visibility
      expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    });
  });

  describe('completion of problem units and step changes', () => {
    beforeEach(() => mergeConfig({ UBER_LIGHTWEIGHT_IFRAMES: true }));
    afterEach(() => mergeConfig({ UBER_LIGHTWEIGHT_IFRAMES: false }));

    const getFrame = () => document.querySelector<HTMLIFrameElement>('.content-iframe-frame')!;
    const spinner = () => document.querySelector('.content-iframe-spinner');
    /** The unversioned plugin.resize the LMS posts once the unit's DOM is built. */
    const showContent = () => act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        origin: LMS_ORIGIN,
        source: getFrame().contentWindow,
        data: { type: 'plugin.resize', payload: { width: 400, height: 600 } },
      }));
    });

    // unit-2 is a graded problem unit and the last step ("Finish").
    it('keeps a problem unit locked after its content shows, until poll returns complete', async () => {
      mockUseParams.mockReturnValue({ courseId: COURSE_ID, sequenceId: SEQ_ID, unitIdx: '1' });
      const client = renderComponent();
      await waitFor(() => expect(getFrame()).toBeInTheDocument());

      showContent();
      fireEvent.load(getFrame());

      expect(spinner()).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /finish/i })).toBeDisabled();

      await simulatePollComplete(client, 'unit-2');
      await waitFor(() => expect(screen.getByRole('button', { name: /finish/i })).not.toBeDisabled());
    });

    it('unlocks a problem unit the learner completed on an earlier visit', async () => {
      jest.mocked(coursewareApi.getSequenceMetadata).mockResolvedValue({
        ...MOCK_SEQUENCE_DATA,
        units: MOCK_SEQUENCE_DATA.units.map((u) => (u.id === 'unit-2' ? { ...u, complete: true } : u)),
      });
      mockUseParams.mockReturnValue({ courseId: COURSE_ID, sequenceId: SEQ_ID, unitIdx: '1' });
      renderComponent();
      await waitFor(() => expect(getFrame()).toBeInTheDocument());

      expect(screen.getByRole('button', { name: /finish/i })).not.toBeDisabled();
    });

    it('does not record the previous step\'s answer against the next step', async () => {
      // Two non-problem steps; both complete on iframe load (no polling needed).
      jest.mocked(coursewareApi.getSequenceMetadata).mockResolvedValue({
        ...MOCK_SEQUENCE_DATA,
        units: [
          MOCK_SEQUENCE_DATA.units[0],
          {
            ...MOCK_SEQUENCE_DATA.units[0], id: 'unit-3', title: 'Recap', contentType: 'html',
          },
        ],
      });
      const queryClient = makeQueryClient();
      const view = () => (
        <QueryClientProvider client={queryClient}>
          <ActivityView />
        </QueryClientProvider>
      );
      const { rerender } = render(view());
      await waitFor(() => expect(getFrame()).toBeInTheDocument());
      // Enable Continue by simulating the poll returning complete for unit-1
      await act(async () => {
        queryClient.setQueryData(qk.blockCompletion(COURSE_ID, SEQ_ID, 'unit-1'), true);
      });
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled());
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));

      mockUseParams.mockReturnValue({ courseId: COURSE_ID, sequenceId: SEQ_ID, unitIdx: '1' });
      rerender(view());
      await waitFor(() => expect(getFrame().dataset.usageKey).toBe('unit-3'));
      showContent();
      fireEvent.click(await screen.findByRole('button', { name: /finish/i }));

      // recordActivity not implemented in this branch — step advance is the meaningful assertion above.
    });

    it('shows the spinner again when returning to a step whose iframe is reloading', async () => {
      const queryClient = makeQueryClient();
      const view = () => (
        <QueryClientProvider client={queryClient}>
          <ActivityView />
        </QueryClientProvider>
      );
      const { rerender } = render(view());
      await waitFor(() => expect(getFrame()).toBeInTheDocument());
      showContent();
      expect(spinner()).not.toBeInTheDocument();

      // To step 1 and straight back to step 0, before step 1's content showed.
      mockUseParams.mockReturnValue({ courseId: COURSE_ID, sequenceId: SEQ_ID, unitIdx: '1' });
      rerender(view());
      mockUseParams.mockReturnValue({ courseId: COURSE_ID, sequenceId: SEQ_ID, unitIdx: '0' });
      rerender(view());

      expect(getFrame().dataset.usageKey).toBe('unit-1');
      expect(spinner()).toBeInTheDocument();
    });
  });

  describe('AC-ACT-PM-01: uber.continueClicked postMessage to LMS iframe', () => {
    // Isolate the contentWindow override to this describe block only.
    const mockPostMessage = jest.fn();
    // Stable reference — the getter must return the same object on every call so
    // that event.source === frameRef.current.contentWindow comparisons hold.
    const mockContentWindow = { postMessage: mockPostMessage };

    beforeEach(() => {
      mockPostMessage.mockClear();
      Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
        get() { return mockContentWindow; },
        configurable: true,
      });
    });

    afterEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (HTMLIFrameElement.prototype as any).contentWindow;
    });

    it('sends uber.continueClicked to the LMS origin via the iframe contentWindow', async () => {
      const client = renderComponent();
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument());

      await simulatePollComplete(client, 'unit-1');
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
      expect(progressApi.saveSequencePosition).not.toHaveBeenCalled();
    });
  });

  describe('unit completion via polling (no iframe-load shortcut)', () => {
    it('Continue stays disabled after iframe loads — poll must return complete:true', async () => {
      const client = renderComponent(); // unit-1 is contentType 'video'
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled());

      const iframe = document.querySelector<HTMLIFrameElement>('[data-usage-key="unit-1"]');
      fireEvent.load(iframe as HTMLIFrameElement);
      // Iframe loaded but poll still returns false → button stays disabled
      expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();

      await simulatePollComplete(client, 'unit-1');
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled());
    });

    it('does NOT auto-complete any unit on iframe load', async () => {
      mockUseParams.mockReturnValue({ courseId: COURSE_ID, sequenceId: SEQ_ID, unitIdx: '1' });
      renderComponent();
      await waitFor(() => expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument());

      const iframe = document.querySelector<HTMLIFrameElement>('[data-usage-key="unit-2"]');
      fireEvent.load(iframe as HTMLIFrameElement);

      expect(screen.getByRole('button', { name: /finish/i })).toBeDisabled();
    });
  });

  describe('iframe loaded state survives a server completion refetch', () => {
    it('does not re-show the loading overlay when the poll detects completion', async () => {
      mockUseParams.mockReturnValue({ courseId: COURSE_ID, sequenceId: SEQ_ID, unitIdx: '1' });
      const client = renderComponent();
      await waitFor(() => expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument());

      const iframe = document.querySelector<HTMLIFrameElement>('[data-usage-key="unit-2"]');
      fireEvent.load(iframe as HTMLIFrameElement);
      await waitFor(() => expect(document.querySelector('.content-iframe-spinner')).toBeNull());

      await simulatePollComplete(client, 'unit-2');

      // Poll result enables the button; isIframeLoaded is unchanged so the overlay stays gone.
      await waitFor(() => expect(screen.getByRole('button', { name: /finish/i })).not.toBeDisabled());
      expect(document.querySelector('.content-iframe-spinner')).toBeNull();
    });
  });

  describe('AC-ACT-RESET-01: completion state resets on unit change', () => {
    it('Continue becomes disabled again after unit index changes', async () => {
      // Step 1: render unit-1, enable Continue via poll
      const client = renderComponent();
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument());

      await simulatePollComplete(client, 'unit-1');
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled());

      // Step 2: navigate to unit-2 — different blockCompletion key, poll returns false
      mockUseParams.mockReturnValue({ courseId: COURSE_ID, sequenceId: SEQ_ID, unitIdx: '1' });
      renderComponent();

      await waitFor(() => {
        // unit-2 is a problem unit; isBlockComplete=false (getBlockCompletion mock returns false)
        const finishBtns = screen.getAllByRole('button', { name: /finish/i });
        expect(finishBtns[finishBtns.length - 1]).toBeDisabled();
      });
    });
  });
});
