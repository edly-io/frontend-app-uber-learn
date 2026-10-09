/**
 * Integration tests for the RewardsView page.
 *
 * AC coverage:
 *   - RWD-BADGES-01: All three badge types are rendered (all unlocked = not earned)
 *   - RWD-POINTS-01: Points row shows "— / —" (no progress API)
 *   - RWD-ACTIVITIES-01: Activities row shows "0 / 0"
 *   - RWD-STREAK-01: Streak rows show "0 days"
 *   - RWD-NAV-01: "Back to course" navigates to course overview
 */
import React from 'react';
import {
  render, screen, waitFor, fireEvent,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RewardsView } from '../pages/RewardsView';

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
// Helpers
// ---------------------------------------------------------------------------

const COURSE_ID = 'course-v1:Uber+L2024';

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

beforeEach(() => {
  mockNavigate.mockClear();
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RewardsView', () => {
  describe('RWD-BADGES: badge collection', () => {
    it('RWD-BADGES-01: renders all three badge types as not yet earned', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText(/applied badge — not yet earned/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/thorough badge — not yet earned/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/retained badge — not yet earned/i)).toBeInTheDocument();
      });
    });
  });

  describe('RWD-POINTS: points display', () => {
    it('RWD-POINTS-01: shows "— / —" when no progress data', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('— / —')).toBeInTheDocument();
      });
    });
  });

  describe('RWD-ACTIVITIES-01: activities display', () => {
    it('shows "0 / 0" when no progress data', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('0 / 0')).toBeInTheDocument();
      });
    });
  });

  describe('RWD-STREAK-01: streak display', () => {
    it('shows "0 days" for current and longest streak', async () => {
      renderComponent();

      await waitFor(() => {
        const dayTexts = screen.getAllByText('0 days');
        expect(dayTexts.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('RWD-NAV-01: navigation', () => {
    it('navigates to course overview when "Back to course" is clicked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back to course/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /back to course/i }));

      expect(mockNavigate).toHaveBeenCalledWith(`/uber-learn/course/${COURSE_ID}`);
    });
  });
});
