/**
 * Integration tests for the full RewardsView page.
 *
 * AC coverage:
 *   - RWD-LOAD-01: Loading skeleton shown while progress is fetching
 *   - RWD-BADGES-01: All three badge types (applied, thorough, retained) are rendered
 *   - RWD-BADGES-02: Earned badges have distinct styling/aria from locked badges
 *   - RWD-POINTS-01: Points earned and possible are shown
 *   - RWD-POINTS-02: null points rendered as "—"
 *   - RWD-ACTIVITIES-01: Completed/total activities shown
 *   - RWD-STREAK-01: Current and longest streak shown
 *   - RWD-COMPLETE-01: Course complete banner shown when courseComplete=true
 *   - RWD-COMPLETE-02: No complete banner when courseComplete=false
 *   - RWD-NAV-01: "Back to course" navigates to course overview
 */
import React from 'react';
import {
  render, screen, waitFor, fireEvent,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RewardsView } from '../pages/RewardsView';
import * as progressApi from '../api/progress';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ courseId: 'course-v1:Uber+L2024' }),
}));

jest.mock('../api/progress');

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const COURSE_ID = 'course-v1:Uber+L2024';

const BASE_PROGRESS: progressApi.UberLearnProgress = {
  completedActivities: 15,
  totalActivities: 20,
  fraction: 0.75,
  assessments: {
    baseline: null,
    final: null,
    retention: null,
  },
  points: { earned: 850, possible: 1000 },
  streak: { currentDays: 3, longestDays: 7 },
  courseComplete: false,
  badges: [],
};

const PROGRESS_WITH_BADGES: progressApi.UberLearnProgress = {
  ...BASE_PROGRESS,
  courseComplete: true,
  badges: [
    { badgeType: 'applied', awardedAt: '2024-01-01T10:00:00Z' },
    { badgeType: 'thorough', awardedAt: '2024-01-02T10:00:00Z' },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: 0 } },
});

function renderComponent() {
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <RewardsView />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockNavigate.mockClear();
  jest.clearAllMocks();
  jest.mocked(progressApi.getUberLearnProgress).mockResolvedValue(BASE_PROGRESS);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RewardsView', () => {
  describe('RWD-LOAD-01: loading state', () => {
    it('shows a loading skeleton while progress is fetching', () => {
      jest.mocked(progressApi.getUberLearnProgress).mockReturnValue(new Promise(() => {}));

      renderComponent();

      expect(screen.getByLabelText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('RWD-BADGES: badge collection', () => {
    it('RWD-BADGES-01: renders all three badge types', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText(/applied badge/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/thorough badge/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/retained badge/i)).toBeInTheDocument();
      });
    });

    it('RWD-BADGES-02: earned badges show "earned" in aria-label', async () => {
      jest.mocked(progressApi.getUberLearnProgress).mockResolvedValue(PROGRESS_WITH_BADGES);

      renderComponent();

      await waitFor(() => {
        // applied and thorough are earned
        expect(screen.getByLabelText(/applied badge — earned/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/thorough badge — earned/i)).toBeInTheDocument();
        // retained is not earned
        expect(screen.getByLabelText(/retained badge — not yet earned/i)).toBeInTheDocument();
      });
    });

    it('shows all badges as locked when no badges earned', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText(/applied badge — not yet earned/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/thorough badge — not yet earned/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/retained badge — not yet earned/i)).toBeInTheDocument();
      });
    });
  });

  describe('RWD-POINTS: points display', () => {
    it('RWD-POINTS-01: shows earned and possible points', async () => {
      renderComponent();

      await waitFor(() => {
        // "850 / 1000" should appear somewhere in the stat row
        expect(screen.getByText('850 / 1000')).toBeInTheDocument();
      });
    });

    it('RWD-POINTS-02: null points displayed as "— / —"', async () => {
      jest.mocked(progressApi.getUberLearnProgress).mockResolvedValue({
        ...BASE_PROGRESS,
        points: { earned: null, possible: null },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('— / —')).toBeInTheDocument();
      });
    });

    it('shows partial null — e.g. earned set, possible null', async () => {
      jest.mocked(progressApi.getUberLearnProgress).mockResolvedValue({
        ...BASE_PROGRESS,
        points: { earned: 500, possible: null },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('500 / —')).toBeInTheDocument();
      });
    });
  });

  describe('RWD-ACTIVITIES-01: activities display', () => {
    it('shows completed and total activities', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('15 / 20')).toBeInTheDocument();
      });
    });
  });

  describe('RWD-STREAK-01: streak display', () => {
    it('shows current streak in days', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('3 days')).toBeInTheDocument();
      });
    });

    it('shows longest streak in days', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('7 days')).toBeInTheDocument();
      });
    });

    it('uses singular "day" for streak of 1', async () => {
      jest.mocked(progressApi.getUberLearnProgress).mockResolvedValue({
        ...BASE_PROGRESS,
        streak: { currentDays: 1, longestDays: 1 },
      });

      renderComponent();

      await waitFor(() => {
        const dayTexts = screen.getAllByText('1 day');
        expect(dayTexts.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('RWD-COMPLETE: course complete banner', () => {
    it('RWD-COMPLETE-01: shows course complete banner when courseComplete=true', async () => {
      jest.mocked(progressApi.getUberLearnProgress).mockResolvedValue(PROGRESS_WITH_BADGES);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/course complete/i)).toBeInTheDocument();
      });
    });

    it('RWD-COMPLETE-02: no complete banner when courseComplete=false', async () => {
      renderComponent();

      await waitFor(() => {
        // Badges section should be present but no complete banner
        expect(screen.getByLabelText(/applied badge/i)).toBeInTheDocument();
      });

      expect(screen.queryByText(/course complete!/i)).not.toBeInTheDocument();
    });
  });

  describe('RWD-NAV-01: navigation', () => {
    it('navigates to course overview when "Back to course" is clicked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back to course/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /back to course/i }));

      expect(mockNavigate).toHaveBeenCalledWith(`/course/${COURSE_ID}`);
    });

    it('back arrow also navigates to course overview', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /go back/i }));

      expect(mockNavigate).toHaveBeenCalledWith(`/course/${COURSE_ID}`);
    });
  });
});
