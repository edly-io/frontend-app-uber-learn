/**
 * Unit/integration tests for the CourseCatalog page.
 *
 * Strategy: mock all API functions and hooks so the component renders
 * synchronously (or resolves immediately with test fixtures) without
 * real HTTP calls.
 *
 * AC coverage:
 *   - CC-LOADING:       loading skeleton shown while courses query is in-flight
 *   - CC-ERROR:         ErrorView shown when courses query fails
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
 *   - CC-STEP-BACKEND:  uses backend nextStep when sequenceKey matches outline
 *   - CC-STEP-META:     falls back to first incomplete unit from sequence cache
 */
import React from 'react';
import {
  render, screen, fireEvent, waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CourseCatalog } from '../pages/CourseCatalog';
import type { LearnerCurriculum } from '../api/curriculum';
import type { LearnCourse } from '../api/learn';
import type { CourseOutline } from '../api/courseware';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Learn API — getLearnCourses returns every enrolled course with its progress in one call
jest.mock('../api/learn', () => ({
  getLearnCourses: jest.fn(),
}));

// Courseware API — getResumeBlock is called inside ConnectedContinueCard
jest.mock('../api/courseware', () => ({
  getResumeBlock: jest.fn().mockResolvedValue(null),
}));

// Curriculum API — getLastActivity drives which course the continue card features
const mockGetLastActivity = jest.fn();
jest.mock('../api/curriculum', () => ({
  getLastActivity: (...args: unknown[]) => mockGetLastActivity(...args),
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

const COURSE: LearnCourse = {
  courseId: 'course-v1:Uber+Safety+2026',
  title: 'Road safety fundamentals',
  imageUrl: null,
  courseStart: null,
  courseEnd: null,
  lessonCount: 0,
  completedLessons: 0,
  progress: 0,
  nextLesson: null,
  status: 'not_started',
  curriculum: null,
  lastActivity: null,
  points: 0,
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

function getLearnMock() {
  // eslint-disable-next-line global-require
  return jest.requireMock('../api/learn') as { getLearnCourses: jest.Mock };
}

function setDefaultMocks() {
  getLearnMock().getLearnCourses.mockResolvedValue([]);
  mockUseGamification.mockReturnValue({ data: undefined });
  mockUseCurriculums.mockReturnValue({ data: [] });
  mockUseBadges.mockReturnValue({ data: undefined });
  mockUseCourseOutline.mockReturnValue({ data: null });
  mockUseSequence.mockReturnValue({ units: [] });
  mockGetLastActivity.mockResolvedValue({ course: null });
}

const makeCourse = (courseId: string, title: string): LearnCourse => ({
  ...COURSE, courseId, title,
});

const makeCurriculumCourse = (courseId: string, position: number, finished: boolean) => ({
  course_id: courseId,
  display_name: null,
  exists: true,
  position,
  finished,
  description: null,
  image_url: null,
});

async function clickContinueCard() {
  const btn = await screen.findByRole('button', { name: /^(Continue|Start)$/ });
  fireEvent.click(btn);
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
    it('shows loading skeleton while courses query is in-flight', () => {
      // Never-resolving promise keeps the query in "loading" state
      getLearnMock().getLearnCourses.mockReturnValue(new Promise(() => {}));
      renderComponent();
      expect(screen.getByLabelText('Loading…')).toBeInTheDocument();
    });
  });

  describe('CC-ERROR: error state', () => {
    it('shows ErrorView when courses query rejects', async () => {
      getLearnMock().getLearnCourses.mockRejectedValue(new Error('Network failure'));
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
      getLearnMock().getLearnCourses.mockResolvedValue([]);
      renderComponent();
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/no-courses', { replace: true });
      });
    });

    it('does not show the Continue card when no courses are enrolled', async () => {
      getLearnMock().getLearnCourses.mockResolvedValue([]);
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
      getLearnMock().getLearnCourses.mockResolvedValue([COURSE]);
      renderComponent();
      await waitFor(() => {
        // ConnectedContinueCard renders either "Continue" or "Start"
        const btn = screen.queryByText('Continue') ?? screen.queryByText('Start');
        expect(btn).toBeInTheDocument();
      });
    });
  });

  describe('CC-CONTINUE-PICK: which course the continue card features', () => {
    const DEMO = makeCourse('course-v1:OpenedX+DemoX+DemoCourse', 'Open edX Demo Course');
    const CON101 = makeCourse('course-v1:uber+CON101+2026', 'Code of Business Conduct');
    const CON102 = makeCourse('course-v1:uber+CON102+2026', 'Business Ethics');
    const SAF101 = makeCourse('course-v1:uber+SAF101+2026', 'Workplace Safety 101');

    const conductPath = (con101Finished: boolean): LearnerCurriculum => ({
      ...CURRICULUM,
      uuid: 'conduct',
      title: 'Business Conduct & Ethics',
      assigned_at: '2026-09-23T05:49:19Z',
      courses: [
        makeCurriculumCourse(CON101.courseId, 1, con101Finished),
        makeCurriculumCourse(CON102.courseId, 2, false),
      ],
      courses_finished: con101Finished ? 1 : 0,
      courses_total: 2,
    });
    // Assigned more recently than the conduct path but never touched.
    const safetyPath: LearnerCurriculum = {
      ...CURRICULUM,
      uuid: 'safety',
      title: 'Workplace Safety',
      assigned_at: '2026-09-30T05:49:19Z',
      courses: [makeCurriculumCourse(SAF101.courseId, 1, false)],
      courses_finished: 0,
      courses_total: 1,
    };

    it('does not feature a course outside every learning path just because the API lists it first', async () => {
      getLearnMock().getLearnCourses.mockResolvedValue([DEMO, CON101, CON102]);
      mockUseCurriculums.mockReturnValue({ data: [conductPath(true)] });
      renderComponent();
      await clickContinueCard();
      expect(mockNavigate).not.toHaveBeenCalledWith(`/course/${DEMO.courseId}`, expect.anything());
      expect(mockNavigate).toHaveBeenCalledWith(`/course/${CON102.courseId}`, { state: { origin: '/' } });
    });

    it('features the last-activity course when it is not finished, over a newer untouched path', async () => {
      getLearnMock().getLearnCourses.mockResolvedValue([DEMO, CON101, CON102, SAF101]);
      mockUseCurriculums.mockReturnValue({ data: [conductPath(false), safetyPath] });
      mockGetLastActivity.mockResolvedValue({
        course: {
          course_id: CON101.courseId,
          display_name: CON101.title,
          last_activity_at: '2026-10-14T06:59:24Z',
          curriculum_ids: ['conduct'],
        },
      });
      renderComponent();
      await waitFor(() => expect(mockGetLastActivity).toHaveBeenCalled());
      await clickContinueCard();
      expect(mockNavigate).toHaveBeenCalledWith(`/course/${CON101.courseId}`, { state: { origin: '/' } });
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
      getLearnMock().getLearnCourses.mockResolvedValue([]);
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
      getLearnMock().getLearnCourses.mockResolvedValue([]);
      renderComponent();
      await waitFor(() => {
        expect(screen.getByLabelText(/3-week streak/i)).toBeInTheDocument();
      });
    });

    it('CC-STAT-BADGES: shows "0" when no badge data is present', async () => {
      mockUseBadges.mockReturnValue({ data: undefined });
      getLearnMock().getLearnCourses.mockResolvedValue([]);
      renderComponent();
      await waitFor(() => {
        expect(screen.getByLabelText(/0 badges earned/i)).toBeInTheDocument();
      });
    });
  });

  describe('CC-NAV: stat chip navigation', () => {
    it('CC-NAV-POINTS: clicking points chip navigates to /progress with { tab: "Points" }', async () => {
      getLearnMock().getLearnCourses.mockResolvedValue([]);
      renderComponent();
      await waitFor(() => screen.getByLabelText(/points — view points/i));
      fireEvent.click(screen.getByLabelText(/points — view points/i));
      expect(mockNavigate).toHaveBeenCalledWith('/progress', { state: { tab: 'Points' } });
    });

    it('CC-NAV-STREAK: clicking streak chip navigates to /progress with { tab: "Streak" }', async () => {
      getLearnMock().getLearnCourses.mockResolvedValue([]);
      renderComponent();
      await waitFor(() => screen.getByLabelText(/streak — view streak/i));
      fireEvent.click(screen.getByLabelText(/streak — view streak/i));
      expect(mockNavigate).toHaveBeenCalledWith('/progress', { state: { tab: 'Streak' } });
    });

    it('CC-NAV-BADGES: clicking badges chip navigates to /progress with { tab: "Badges" }', async () => {
      getLearnMock().getLearnCourses.mockResolvedValue([]);
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
      getLearnMock().getLearnCourses.mockResolvedValue([COURSE]);
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Your learning paths')).toBeInTheDocument();
        expect(screen.getByText('New driver onboarding')).toBeInTheDocument();
      });
    });

    it('CC-PATHS-HIDDEN: "Your learning paths" section absent when curriculums is empty', async () => {
      mockUseCurriculums.mockReturnValue({ data: [] });
      // Use an enrolled course so the page does not redirect to /no-courses
      getLearnMock().getLearnCourses.mockResolvedValue([COURSE]);
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
      getLearnMock().getLearnCourses.mockResolvedValue([COURSE]);
      renderComponent();
      await waitFor(() => {
        const btn = screen.queryByText('Continue') ?? screen.queryByText('Start');
        expect(btn).toBeInTheDocument();
      });
      expect(screen.getByText('This week')).toBeInTheDocument();
    });
  });

  describe('CC-STEP: step index selection in ConnectedContinueCard', () => {
    const SEQ_ID = 'block-v1:Uber+Safety+2026+type@sequential+block@seq1';
    const OUTLINE: CourseOutline = {
      courseId: COURSE.courseId,
      title: 'Road Safety',
      sections: {
        'sec-1': { id: 'sec-1', title: 'Module 1', sequenceIds: [SEQ_ID] },
      },
      sequences: {
        [SEQ_ID]: {
          id: SEQ_ID, title: 'Lesson 1', sectionId: 'sec-1', complete: false,
        },
      },
    };

    it('CC-STEP-BACKEND: uses backend nextStep when sequenceKey matches outline next lesson', async () => {
      const course: LearnCourse = {
        ...COURSE,
        status: 'in_progress',
        nextLesson: {
          sequenceKey: SEQ_ID, title: null, nextStep: 2, unitCount: 5,
        },
      };
      getLearnMock().getLearnCourses.mockResolvedValue([course]);
      mockUseCourseOutline.mockReturnValue({ data: OUTLINE });
      renderComponent();
      await clickContinueCard();
      expect(mockNavigate).toHaveBeenCalledWith(
        `/course/${COURSE.courseId}/lesson/${SEQ_ID}/step/2`,
        { state: { origin: '/' } },
      );
    });

    it('CC-STEP-META: falls back to first incomplete unit from sequence cache when backend step is absent', async () => {
      const course: LearnCourse = { ...COURSE, status: 'in_progress', nextLesson: null };
      getLearnMock().getLearnCourses.mockResolvedValue([course]);
      mockUseCourseOutline.mockReturnValue({ data: OUTLINE });
      // Use a high gcTime so sequence data we seed is not evicted before handleContinue reads it.
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
      // unit 0 complete, unit 1 incomplete → meta fallback should land on step 1
      qc.setQueryData(['sequence', SEQ_ID], {
        units: [{ complete: true }, { complete: false }, { complete: false }],
      });
      renderComponent(qc);
      await clickContinueCard();
      expect(mockNavigate).toHaveBeenCalledWith(
        `/course/${COURSE.courseId}/lesson/${SEQ_ID}/step/1`,
        { state: { origin: '/' } },
      );
    });
  });
});
