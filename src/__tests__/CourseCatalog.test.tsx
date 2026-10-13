/**
 * Unit/integration tests for the CourseCatalog page.
 *
 * Strategy: mock all API functions and hooks so the component renders
 * synchronously (or resolves immediately with test fixtures) without
 * real HTTP calls.
 *
 * AC coverage:
 *   - CC-LOADING:       loading skeleton shown while enrolled-courses query is in-flight
 *   - CC-ERROR:         ErrorView shown when enrolled-courses query fails
 *   - CC-EMPTY:         navigates to /no-courses when no courses enrolled (HOME-010)
 *   - CC-ENROLLED:      Continue card shown when courses are enrolled
 *   - CC-STAT-POINTS:   points stat chip renders with lifetime_points value from gamification
 *   - CC-STAT-STREAK:   streak stat chip renders with current_streak_weeks value
 *   - CC-STAT-BADGES:   badge stat chip renders "0" when no badge data
 *   - CC-NAV-POINTS:    clicking points chip navigates to /progress with { tab: 'Points' }
 *   - CC-NAV-STREAK:    clicking streak chip navigates to /progress with { tab: 'Streak' }
 *   - CC-NAV-BADGES:    clicking badges chip navigates to /progress with { tab: 'Badges' }
 *   - CC-PATHS-SHOWN:   "Your learning paths" section visible when curriculums is non-empty
 *   - CC-PATHS-HIDDEN:  "Your learning paths" section absent when curriculums is empty
 *   - CC-THIS-WEEK:     "This week" section always visible
 */
import React from 'react';
import {
  render, screen, fireEvent, waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CourseCatalog } from '../pages/CourseCatalog';
import type { LearnerCurriculum } from '../api/curriculum';
import type { EnrolledCourse } from '../api/catalog';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Catalog API — getEnrolledCourses is the queryFn used directly in the component
jest.mock('../api/catalog', () => ({
  getEnrolledCourses: jest.fn(),
}));

// Courseware API — getResumeBlock is called inside ConnectedContinueCard
jest.mock('../api/courseware', () => ({
  getResumeBlock: jest.fn().mockResolvedValue(null),
}));

// Mock the three hook-based data sources used in the page header/body
const mockUseGamification = jest.fn();
const mockUseCurriculums = jest.fn();
const mockUseBadges = jest.fn();
const mockUseCourseOutline = jest.fn();
const mockUseSequence = jest.fn();

jest.mock('../hooks/useGamification', () => ({
  useGamification: (...args: unknown[]) => mockUseGamification(...args),
}));
jest.mock('../hooks/useCurriculums', () => ({
  useCurriculums: (...args: unknown[]) => mockUseCurriculums(...args),
}));
jest.mock('../hooks/useBadges', () => ({
  useBadges: (...args: unknown[]) => mockUseBadges(...args),
}));
jest.mock('../hooks/useCourseOutline', () => ({
  useCourseOutline: (...args: unknown[]) => mockUseCourseOutline(...args),
}));
jest.mock('../hooks/useSequence', () => ({
  useSequence: (...args: unknown[]) => mockUseSequence(...args),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COURSE: EnrolledCourse = {
  courseId: 'course-v1:Uber+Safety+2026',
  title: 'Road safety fundamentals',
  imageUrl: null,
  courseStart: null,
  courseEnd: null,
  isActive: true,
};

const CURRICULUM: LearnerCurriculum = {
  uuid: 'curr-1',
  title: 'New driver onboarding',
  description: '',
  image_url: null,
  assigned_at: '2026-01-01T00:00:00Z',
  courses: [],
  courses_finished: 1,
  courses_total: 3,
  milestones: {
    complete: { reached_at: null, badge: null },
    retained: { reached_at: null, badge: null },
  },
  knowledge_check: {
    course_id: 'kc-1', display_name: null, exists: true, unlocks_at: null, is_open: false,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Each test gets a fresh QueryClient to prevent cache bleed-through
const makeQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: 0 } },
});

function renderComponent(qc = makeQueryClient()) {
  return render(
    <QueryClientProvider client={qc}>
      <CourseCatalog />
    </QueryClientProvider>,
  );
}

function getCatalogMock() {
  // eslint-disable-next-line global-require
  return jest.requireMock('../api/catalog') as { getEnrolledCourses: jest.Mock };
}

function setDefaultMocks() {
  getCatalogMock().getEnrolledCourses.mockResolvedValue([]);
  mockUseGamification.mockReturnValue({ data: undefined });
  mockUseCurriculums.mockReturnValue({ data: [] });
  mockUseBadges.mockReturnValue({ data: undefined });
  mockUseCourseOutline.mockReturnValue({ data: null });
  mockUseSequence.mockReturnValue({ units: [] });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockNavigate.mockClear();
  jest.clearAllMocks();
  setDefaultMocks();
});

describe('CourseCatalog', () => {
  describe('CC-LOADING: loading state', () => {
    it('shows loading skeleton while enrolled-courses query is in-flight', () => {
      // Never-resolving promise keeps the query in "loading" state
      getCatalogMock().getEnrolledCourses.mockReturnValue(new Promise(() => {}));
      renderComponent();
      expect(screen.getByLabelText('Loading…')).toBeInTheDocument();
    });
  });

  describe('CC-ERROR: error state', () => {
    it('shows ErrorView when enrolled-courses query rejects', async () => {
      getCatalogMock().getEnrolledCourses.mockRejectedValue(new Error('Network failure'));
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/We could not retrieve your enrolled courses/i)).toBeInTheDocument();
      });
      // Retry button must be present
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  describe('CC-EMPTY: empty state (no enrolled courses) — HOME-010', () => {
    it('navigates to /no-courses when enrolled courses list is empty after loading', async () => {
      getCatalogMock().getEnrolledCourses.mockResolvedValue([]);
      renderComponent();
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/no-courses', { replace: true });
      });
    });

    it('does not show the Continue card when no courses are enrolled', async () => {
      getCatalogMock().getEnrolledCourses.mockResolvedValue([]);
      renderComponent();
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/no-courses', { replace: true });
      });
      // The Continue card renders "Continue" or "Start" button — should be absent
      expect(screen.queryByText('Continue')).not.toBeInTheDocument();
      expect(screen.queryByText('Start')).not.toBeInTheDocument();
    });
  });

  describe('CC-ENROLLED: enrolled courses', () => {
    it('shows a Continue/Start button when at least one course is enrolled', async () => {
      getCatalogMock().getEnrolledCourses.mockResolvedValue([COURSE]);
      renderComponent();
      await waitFor(() => {
        // ConnectedContinueCard renders either "Continue" or "Start"
        const btn = screen.queryByText('Continue') ?? screen.queryByText('Start');
        expect(btn).toBeInTheDocument();
      });
    });
  });

  describe('CC-STAT: stat chips in header', () => {
    it('CC-STAT-POINTS: shows lifetime_points value from gamification', async () => {
      mockUseGamification.mockReturnValue({
        data: {
          lifetime_points: 42,
          current_streak_weeks: 0,
          this_week: null,
          courses: [],
        },
      });
      getCatalogMock().getEnrolledCourses.mockResolvedValue([]);
      renderComponent();
      await waitFor(() => {
        expect(screen.getByLabelText(/42 points/i)).toBeInTheDocument();
      });
    });

    it('CC-STAT-STREAK: shows current_streak_weeks value from gamification', async () => {
      mockUseGamification.mockReturnValue({
        data: {
          lifetime_points: 0,
          current_streak_weeks: 3,
          this_week: null,
          courses: [],
        },
      });
      getCatalogMock().getEnrolledCourses.mockResolvedValue([]);
      renderComponent();
      await waitFor(() => {
        expect(screen.getByLabelText(/3-week streak/i)).toBeInTheDocument();
      });
    });

    it('CC-STAT-BADGES: shows "0" when no badge data is present', async () => {
      mockUseBadges.mockReturnValue({ data: undefined });
      getCatalogMock().getEnrolledCourses.mockResolvedValue([]);
      renderComponent();
      await waitFor(() => {
        expect(screen.getByLabelText(/0 badges earned/i)).toBeInTheDocument();
      });
    });
  });

  describe('CC-NAV: stat chip navigation', () => {
    it('CC-NAV-POINTS: clicking points chip navigates to /progress with { tab: "Points" }', async () => {
      getCatalogMock().getEnrolledCourses.mockResolvedValue([]);
      renderComponent();
      await waitFor(() => screen.getByLabelText(/points — view points/i));
      fireEvent.click(screen.getByLabelText(/points — view points/i));
      expect(mockNavigate).toHaveBeenCalledWith('/progress', { state: { tab: 'Points' } });
    });

    it('CC-NAV-STREAK: clicking streak chip navigates to /progress with { tab: "Streak" }', async () => {
      getCatalogMock().getEnrolledCourses.mockResolvedValue([]);
      renderComponent();
      await waitFor(() => screen.getByLabelText(/streak — view streak/i));
      fireEvent.click(screen.getByLabelText(/streak — view streak/i));
      expect(mockNavigate).toHaveBeenCalledWith('/progress', { state: { tab: 'Streak' } });
    });

    it('CC-NAV-BADGES: clicking badges chip navigates to /progress with { tab: "Badges" }', async () => {
      getCatalogMock().getEnrolledCourses.mockResolvedValue([]);
      renderComponent();
      await waitFor(() => screen.getByLabelText(/badges earned — view badges/i));
      fireEvent.click(screen.getByLabelText(/badges earned — view badges/i));
      expect(mockNavigate).toHaveBeenCalledWith('/progress', { state: { tab: 'Badges' } });
    });
  });

  describe('CC-PATHS: learning paths section', () => {
    it('CC-PATHS-SHOWN: "Your learning paths" section is visible when curriculums is non-empty', async () => {
      mockUseCurriculums.mockReturnValue({ data: [CURRICULUM] });
      // Use an enrolled course so the page does not redirect to /no-courses
      getCatalogMock().getEnrolledCourses.mockResolvedValue([COURSE]);
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Your learning paths')).toBeInTheDocument();
        expect(screen.getByText('New driver onboarding')).toBeInTheDocument();
      });
    });

    it('CC-PATHS-HIDDEN: "Your learning paths" section absent when curriculums is empty', async () => {
      mockUseCurriculums.mockReturnValue({ data: [] });
      // Use an enrolled course so the page does not redirect to /no-courses
      getCatalogMock().getEnrolledCourses.mockResolvedValue([COURSE]);
      renderComponent();
      await waitFor(() => {
        // The Continue card is present once the enrolled course is loaded
        const btn = screen.queryByText('Continue') ?? screen.queryByText('Start');
        expect(btn).toBeInTheDocument();
      });
      expect(screen.queryByText('Your learning paths')).not.toBeInTheDocument();
    });
  });

  describe('CC-THIS-WEEK: This week section', () => {
    it('CC-THIS-WEEK: "This week" section is always visible (even with no API data)', async () => {
      // Use an enrolled course so the page does not redirect to /no-courses
      getCatalogMock().getEnrolledCourses.mockResolvedValue([COURSE]);
      renderComponent();
      await waitFor(() => {
        const btn = screen.queryByText('Continue') ?? screen.queryByText('Start');
        expect(btn).toBeInTheDocument();
      });
      expect(screen.getByText('This week')).toBeInTheDocument();
    });
  });
});
