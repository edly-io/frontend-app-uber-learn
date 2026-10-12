/**
 * Integration tests for the RewardsView page.
 *
 * Strategy: mock the three data hooks directly (same pattern as BadgesTab.test.tsx)
 * so the component gets immediate, synchronous data rather than waiting for
 * TanStack Query's async fetch cycle to complete.
 *
 * AC coverage:
 *   - RWD-LOADING:         shows skeleton while any hook is loading
 *   - RWD-ERROR-GAMIF:     renders ErrorView when gamification hook errors
 *   - RWD-ERROR-CURR:      renders ErrorView when curriculums hook errors
 *   - RWD-BADGES-01:       all three badge types rendered as not yet earned
 *   - RWD-BADGES-EARNED:   earned badge shows "— earned" aria-label
 *   - RWD-COMPLETE-BANNER: course-complete banner visible only when complete milestone reached
 *   - RWD-POINTS-01:       points row shows "0" when no gamification course data
 *   - RWD-ACTIVITIES-01:   activities row shows "—" when totalUnits is 0
 *   - RWD-ACTIVITIES-02:   activities row shows "N / M" when progress data is present
 *   - RWD-STREAK-01:       streak rows show "0 weeks" when no gamification data
 *   - RWD-NAV-01:          "Back to course" navigates to course overview
 */
import React from 'react';
import {
  render, screen, fireEvent,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RewardsView } from '../pages/RewardsView';
import type { LearnerCurriculum } from '../api/curriculum';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ courseId: 'course-v1:Uber+L2024' }),
}));

// Mock all three hooks directly — same pattern as BadgesTab.test.tsx
const mockUseCurriculums = jest.fn();
const mockUseGamification = jest.fn();
const mockUseCourseProgressSummary = jest.fn();

jest.mock('../hooks/useCurriculums', () => ({
  useCurriculums: (...args: unknown[]) => mockUseCurriculums(...args),
}));
jest.mock('../hooks/useGamification', () => ({
  useGamification: (...args: unknown[]) => mockUseGamification(...args),
}));
jest.mock('../hooks/useCourseProgressSummary', () => ({
  useCourseProgressSummary: (...args: unknown[]) => mockUseCourseProgressSummary(...args),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COURSE_ID = 'course-v1:Uber+L2024';

const BASE_CURRICULUM: LearnerCurriculum = {
  uuid: 'c-1',
  title: 'Safety Fundamentals',
  description: '',
  image_url: null,
  assigned_at: '2026-01-01T00:00:00Z',
  courses: [
    {
      course_id: COURSE_ID,
      display_name: 'Safety basics',
      exists: true,
      position: 1,
      finished: false,
      description: null,
      image_url: null,
    },
  ],
  courses_finished: 0,
  courses_total: 1,
  milestones: {
    complete: { reached_at: null, badge: null },
    retained: { reached_at: null, badge: null },
  },
  knowledge_check: {
    course_id: 'kc-1', display_name: null, exists: true, unlocks_at: null, is_open: false,
  },
};

const COMPLETE_CURRICULUM: LearnerCurriculum = {
  ...BASE_CURRICULUM,
  milestones: {
    ...BASE_CURRICULUM.milestones,
    complete: { reached_at: '2026-09-01T00:00:00Z', badge: null },
  },
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

function setDefaultMocks() {
  mockUseCurriculums.mockReturnValue({ data: [], isLoading: false, isError: false });
  mockUseGamification.mockReturnValue({ data: undefined, isLoading: false, isError: false });
  mockUseCourseProgressSummary.mockReturnValue({ data: undefined, isLoading: false, isError: false });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockNavigate.mockClear();
  jest.clearAllMocks();
  setDefaultMocks();
});

describe('RewardsView', () => {
  describe('RWD-LOADING: loading state', () => {
    it('shows skeleton (hides badge section) while curriculums hook is loading', () => {
      mockUseCurriculums.mockReturnValue({ data: undefined, isLoading: true, isError: false });
      renderComponent();
      // "Badges" heading is inside the non-loading branch only
      expect(screen.queryByText('Badges')).not.toBeInTheDocument();
      // LoadingSkeleton renders with aria-label="Loading…"
      expect(screen.getByLabelText('Loading…')).toBeInTheDocument();
    });
  });

  describe('RWD-ERROR: error states', () => {
    it('RWD-ERROR-GAMIF: renders ErrorView (not badge section) when gamification hook errors', () => {
      mockUseGamification.mockReturnValue({ data: undefined, isLoading: false, isError: true });
      renderComponent();
      // ErrorView replaces the main content
      expect(screen.getByText(/We could not load your badges and progress/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      // Badge section must not be present
      expect(screen.queryByText('Badges')).not.toBeInTheDocument();
    });

    it('RWD-ERROR-CURR: renders ErrorView when curriculums hook errors', () => {
      mockUseCurriculums.mockReturnValue({ data: undefined, isLoading: false, isError: true });
      renderComponent();
      expect(screen.getByText(/We could not load your badges and progress/i)).toBeInTheDocument();
      expect(screen.queryByText('Badges')).not.toBeInTheDocument();
    });
  });

  describe('RWD-BADGES: badge collection', () => {
    it('RWD-BADGES-01: renders both badge types as not yet earned', () => {
      renderComponent();
      // Component uses BADGE_LABELS: { complete: 'Complete', retained: 'Retained' }
      expect(screen.getByLabelText('Complete badge — not yet earned')).toBeInTheDocument();
      expect(screen.getByLabelText('Retained badge — not yet earned')).toBeInTheDocument();
    });

    it('RWD-BADGES-EARNED: earned complete badge shows "— earned"; retained remains "not yet earned"', () => {
      mockUseCurriculums.mockReturnValue({
        data: [COMPLETE_CURRICULUM],
        isLoading: false,
        isError: false,
      });
      renderComponent();
      expect(screen.getByLabelText('Complete badge — earned')).toBeInTheDocument();
      expect(screen.getByLabelText('Retained badge — not yet earned')).toBeInTheDocument();
    });
  });

  describe('RWD-COMPLETE-BANNER: course complete banner', () => {
    it('banner is hidden when the complete milestone has not been reached', () => {
      renderComponent();
      expect(screen.queryByText('Course complete!')).not.toBeInTheDocument();
    });

    it('banner is visible when all course units are completed', () => {
      mockUseCourseProgressSummary.mockReturnValue({
        data: { completedUnits: 5, totalUnits: 5, fraction: 1 },
        isLoading: false,
        isError: false,
      });
      renderComponent();
      expect(screen.getByText('Course complete!')).toBeInTheDocument();
    });
  });

  describe('RWD-POINTS-01: points display', () => {
    it('shows "0" when no gamification data is present (coursePoints defaults to 0)', () => {
      renderComponent();
      // StatRow renders String(coursePoints) = "0"
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  describe('RWD-ACTIVITIES: activities display', () => {
    it('RWD-ACTIVITIES-01: shows "—" when totalUnits is 0 (no progress data)', () => {
      renderComponent();
      // totalUnits === 0 → value is "—" not "0 / 0"
      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('RWD-ACTIVITIES-02: shows "N / M" when progress data has totalUnits > 0', () => {
      mockUseCourseProgressSummary.mockReturnValue({
        data: { completedUnits: 3, totalUnits: 10, fraction: 0.3 },
        isLoading: false,
        isError: false,
      });
      renderComponent();
      expect(screen.getByText('3 / 10')).toBeInTheDocument();
    });
  });

  describe('RWD-STREAK-01: streak display', () => {
    it('shows "0 weeks" for both current and longest streak when gamification data is absent', () => {
      renderComponent();
      // pluralWeeks(0) → "0 weeks"; two StatRows (current + longest) use this
      const weekTexts = screen.getAllByText('0 weeks');
      expect(weekTexts.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('RWD-NAV-01: navigation', () => {
    it('navigates to course overview when "Back to course" is clicked', () => {
      renderComponent();
      fireEvent.click(screen.getByRole('button', { name: /back to course/i }));
      expect(mockNavigate).toHaveBeenCalledWith(`/course/${COURSE_ID}`);
    });
  });
});
