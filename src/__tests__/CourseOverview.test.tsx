/**
 * Integration tests for CourseOverview page.
 *
 * AC coverage:
 *   - AC-NAV-01: Fresh user (sectionId=null) stays on overview, renders lesson list
 *   - AC-NAV-02: Returning user (sectionId set) redirects to /lesson/:sectionId/step/0
 *   - AC-NAV-03: Lesson card click navigates to the selected sequence
 *   - AC-EDGE-01: Outline error renders SlowLoadView
 *   - AC-EDGE-02: Empty outline renders empty-state message
 *   - AC-LOAD-01: Loading skeleton shown while data loads
 */
import React from 'react';
import {
  render, screen, waitFor, fireEvent,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CourseOverview, resetResumedLocationKeys } from '../pages/CourseOverview';
import * as coursewareApi from '../api/courseware';
import * as gamificationApi from '../api/gamification';
import type { LearnerCurriculum } from '../api/curriculum';

// ---------------------------------------------------------------------------
// Routing mocks — avoid a real router; use stubs for useNavigate / useParams
// ---------------------------------------------------------------------------

const mockNavigate = jest.fn();
const mockUseCurriculums = jest.fn();
const mockUseBadges = jest.fn();
const mockUseCourseProgressSummary = jest.fn();
const mockUseGamification = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ courseId: 'course-v1:Uber+L2024' }),
  useLocation: () => ({
    key: 'test-key', pathname: '/course/course-v1:Uber+L2024', search: '', hash: '', state: null,
  }),
}));

jest.mock('../hooks/useCurriculums', () => ({
  useCurriculums: (...args: unknown[]) => mockUseCurriculums(...args),
}));

jest.mock('../hooks/useBadges', () => ({
  useBadges: (...args: unknown[]) => mockUseBadges(...args),
}));

jest.mock('../hooks/useCourseProgressSummary', () => ({
  useCourseProgressSummary: (...args: unknown[]) => mockUseCourseProgressSummary(...args),
}));

// ---------------------------------------------------------------------------
// API module auto-mocks
// ---------------------------------------------------------------------------

jest.mock('../api/courseware');
jest.mock('../api/gamification');

jest.mock('../hooks/useGamification', () => ({
  useGamification: (...args: unknown[]) => mockUseGamification(...args),
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const COURSE_ID = 'course-v1:Uber+L2024';

const RESUME_FRESH: coursewareApi.ResumeBlock = {
  blockId: null,
  sectionId: null,
  unitId: null,
  resumeBlock: false,
};

const RESUME_RETURNING: coursewareApi.ResumeBlock = {
  blockId: 'block-v1:unit-1',
  sectionId: 'seq-1',
  unitId: 'unit-1',
  resumeBlock: true,
};

const OUTLINE: coursewareApi.CourseOutline = {
  courseId: COURSE_ID,
  title: 'Driver Safety 101',
  sections: {
    'section-1': { id: 'section-1', title: 'Module 1', sequenceIds: ['seq-1', 'seq-2'] },
  },
  sequences: {
    'seq-1': {
      id: 'seq-1', title: 'Lesson 1: Basics', sectionId: 'section-1', complete: false,
    },
    'seq-2': {
      id: 'seq-2', title: 'Lesson 2: Advanced', sectionId: 'section-1', complete: false,
    },
  },
};

const RETENTION_CURRICULUM: LearnerCurriculum = {
  uuid: 'safety-path',
  title: 'Business Conduct & Ethics',
  description: 'Required learning path',
  image_url: null,
  assigned_at: '2026-01-01T00:00:00Z',
  courses: [],
  courses_finished: 1,
  courses_total: 1,
  milestones: {
    complete: { reached_at: '2026-01-01T00:00:00Z', badge: null },
    retained: { reached_at: null, badge: null },
  },
  knowledge_check: {
    course_id: COURSE_ID,
    display_name: '30-day check',
    exists: true,
    unlocks_at: null,
    is_open: true,
  },
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
      <CourseOverview />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetResumedLocationKeys();
  mockNavigate.mockClear();
  mockUseCurriculums.mockReturnValue({ data: [] });
  mockUseBadges.mockReturnValue({ data: { curriculum_badges: [], course_badges: [] } });
  mockUseCourseProgressSummary.mockReturnValue({ data: undefined });
  mockUseGamification.mockReturnValue({ data: undefined });
  jest.mocked(coursewareApi.getResumeBlock).mockResolvedValue(RESUME_FRESH);
  jest.mocked(coursewareApi.getCourseOutline).mockResolvedValue(OUTLINE);
  jest.mocked(gamificationApi.getCourseMaxPoints).mockResolvedValue({
    course_id: COURSE_ID,
    max_points: 0,
    completion_points: 0,
    first_try_points: 0,
    lessons: [],
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CourseOverview', () => {
  describe('loading state', () => {
    it('AC-LOAD-01: renders a loading indicator while resume and outline are fetching', () => {
      // Both queries hang — page should be in loading state
      jest.mocked(coursewareApi.getResumeBlock).mockReturnValue(new Promise(() => {}));
      jest.mocked(coursewareApi.getCourseOutline).mockReturnValue(new Promise(() => {}));

      renderComponent();

      // LoadingSkeleton has aria-label="Loading…" and aria-busy="true"
      expect(screen.getByLabelText(/loading/i)).toBeInTheDocument();
      // No lesson titles should be visible yet
      expect(screen.queryByText('Driver Safety 101')).not.toBeInTheDocument();
    });
  });

  describe('fresh user (sectionId is null)', () => {
    it('AC-NAV-01a: renders course title in the header', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Driver Safety 101');
      });
    });

    it('AC-NAV-01b: renders all lessons from the outline', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Lesson 1: Basics')).toBeInTheDocument();
      });
      expect(screen.getByText('Lesson 2: Advanced')).toBeInTheDocument();
    });

    it('AC-NAV-01c: does NOT navigate away when sectionId is null', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Lesson 1: Basics')).toBeInTheDocument();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('30-day check course context', () => {
    it('loads the course as required content in its parent curriculum', async () => {
      mockUseCurriculums.mockReturnValue({ data: [RETENTION_CURRICULUM] });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Driver Safety 101');
      });

      expect(screen.getByText('Required · Business Conduct & Ethics')).toBeInTheDocument();
      expect(document.querySelector('.cp-scene-header')).toBeInTheDocument();
      expect(document.querySelector('.cp-art-panel')).not.toBeInTheDocument();
    });

    it('AC-KC-RETRY-01: shows "Try final check again" when KC course is complete but retention not passed', async () => {
      mockUseCurriculums.mockReturnValue({ data: [RETENTION_CURRICULUM] }); // retained.reached_at = null
      mockUseCourseProgressSummary.mockReturnValue({ data: { completedUnits: 4, totalUnits: 4, fraction: 1.0 } });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Try final check again' })).toBeInTheDocument();
      });
    });

    it('AC-KC-RETRY-02: "Try final check again" navigates to first lesson of the KC course', async () => {
      mockUseCurriculums.mockReturnValue({ data: [RETENTION_CURRICULUM] });
      mockUseCourseProgressSummary.mockReturnValue({ data: { completedUnits: 4, totalUnits: 4, fraction: 1.0 } });

      renderComponent();

      await waitFor(() => screen.getByRole('button', { name: 'Try final check again' }));
      fireEvent.click(screen.getByRole('button', { name: 'Try final check again' }));

      expect(mockNavigate).toHaveBeenCalledWith(
        `/course/${COURSE_ID}/lesson/seq-1/step/0`,
        expect.objectContaining({}),
      );
    });

    it('AC-KC-RETRY-03: hides footer when KC course complete AND retention passed', async () => {
      mockUseCurriculums.mockReturnValue({
        data: [{
          ...RETENTION_CURRICULUM,
          milestones: {
            complete: { reached_at: '2026-01-01T00:00:00Z', badge: null },
            retained: { reached_at: '2026-02-01T00:00:00Z', badge: null },
          },
        }],
      });
      mockUseCourseProgressSummary.mockReturnValue({ data: { completedUnits: 4, totalUnits: 4, fraction: 1.0 } });

      renderComponent();

      await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: 'Try final check again' })).not.toBeInTheDocument();
      expect(document.querySelector('.course-footer')).not.toBeInTheDocument();
    });
  });

  describe('returning user (sectionId is set)', () => {
    it('AC-NAV-02: does NOT auto-redirect on mount (resume is driven by the Continue footer, not by auto-redirect)', async () => {
      jest.mocked(coursewareApi.getResumeBlock).mockResolvedValue(RESUME_RETURNING);

      renderComponent();

      // Wait for the outline to render so the component has fully mounted
      await waitFor(() => {
        expect(screen.getByText('Lesson 1: Basics')).toBeInTheDocument();
      });

      // No automatic navigate call should have fired
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('lesson card interaction', () => {
    it('AC-NAV-03: clicking a completed lesson navigates to /lesson/:seqId/step/0', async () => {
      // Both lessons complete so both are clickable
      jest.mocked(coursewareApi.getCourseOutline).mockResolvedValue({
        ...OUTLINE,
        sequences: {
          'seq-1': { ...OUTLINE.sequences['seq-1'], complete: true },
          'seq-2': { ...OUTLINE.sequences['seq-2'], complete: true },
        },
      });

      renderComponent();

      await waitFor(() => expect(screen.getByText('Lesson 1: Basics')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Lesson 1: Basics'));

      expect(mockNavigate).toHaveBeenCalledWith(
        `/course/${COURSE_ID}/lesson/seq-1/step/0`,
        expect.objectContaining({}),
      );
    });

    it('AC-NAV-03b: clicking a different completed lesson uses the correct sequenceId', async () => {
      jest.mocked(coursewareApi.getCourseOutline).mockResolvedValue({
        ...OUTLINE,
        sequences: {
          'seq-1': { ...OUTLINE.sequences['seq-1'], complete: true },
          'seq-2': { ...OUTLINE.sequences['seq-2'], complete: true },
        },
      });

      renderComponent();

      await waitFor(() => expect(screen.getByText('Lesson 2: Advanced')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Lesson 2: Advanced'));

      expect(mockNavigate).toHaveBeenCalledWith(
        `/course/${COURSE_ID}/lesson/seq-2/step/0`,
        expect.objectContaining({}),
      );
    });

    it('AC-NAV-03c: clicking a locked (upcoming) lesson does not navigate', async () => {
      // Default outline has complete: false — all lessons are locked
      renderComponent();

      await waitFor(() => expect(screen.getByText('Lesson 1: Basics')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Lesson 1: Basics'));

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('AC-EDGE-01: shows SlowLoadView with retry option when outline fetch fails', async () => {
      jest.mocked(coursewareApi.getCourseOutline).mockRejectedValue(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/this is taking longer than expected/i)).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('AC-EDGE-02: shows empty-state message when outline has no sequences', async () => {
      jest.mocked(coursewareApi.getCourseOutline).mockResolvedValue({
        ...OUTLINE,
        sections: {},
        sequences: {},
      });

      renderComponent();

      await waitFor(() => {
        // CourseOverview renders "No lessons are available yet." in the empty state
        expect(screen.getByText(/no lessons/i)).toBeInTheDocument();
      });
    });

    it('AC-BADGE-01: shows actual badge image (grayscale) when course badge has not been earned', async () => {
      // Curriculum must contain the course so showProgress = true and the seal renders
      mockUseCurriculums.mockReturnValue({
        data: [{
          ...RETENTION_CURRICULUM,
          courses: [{
            course_id: COURSE_ID,
            display_name: 'Driver Safety 101',
            exists: true,
            position: 1,
            finished: false,
            description: null,
            image_url: null,
          }],
          knowledge_check: {
            course_id: 'kc-other',
            display_name: null,
            exists: false,
            unlocks_at: null,
            is_open: false,
          },
        }],
      });
      mockUseBadges.mockReturnValue({
        data: {
          curriculum_badges: [],
          course_badges: [{
            awarded: false,
            id: null,
            awarded_at: null,
            seen: null,
            badge: {
              uuid: 'b1',
              title: 'Safety Badge',
              description: '',
              image_url: 'http://cdn/badge.png',
            },
            source: { type: 'course', course_id: COURSE_ID, display_name: null },
          }],
        },
      });

      renderComponent();

      await waitFor(() => expect(screen.getByText('Driver Safety 101')).toBeInTheDocument());

      const seal = document.querySelector('.cd-badge-seal') as HTMLElement;
      const sealImg = document.querySelector('.cd-badge-seal__icon') as HTMLImageElement;
      expect(seal).not.toBeNull();
      expect(seal.classList.contains('cd-badge-seal--earned')).toBe(false);
      expect(sealImg).not.toBeNull();
      expect(sealImg.src).toContain('badge.png');
      expect(sealImg.classList.contains('cd-badge-seal__icon--badge')).toBe(true);
    });

    it('AC-BADGE-02: shows course badge image when badge has been earned', async () => {
      mockUseCurriculums.mockReturnValue({
        data: [{
          ...RETENTION_CURRICULUM,
          courses: [{
            course_id: COURSE_ID,
            display_name: 'Driver Safety 101',
            exists: true,
            position: 1,
            finished: true,
            description: null,
            image_url: null,
          }],
          knowledge_check: {
            course_id: 'kc-other',
            display_name: null,
            exists: false,
            unlocks_at: null,
            is_open: false,
          },
        }],
      });
      mockUseBadges.mockReturnValue({
        data: {
          curriculum_badges: [],
          course_badges: [{
            awarded: true,
            id: 'award-1',
            awarded_at: '2026-10-01T00:00:00Z',
            seen: true,
            badge: {
              uuid: 'b1',
              title: 'Safety Badge',
              description: '',
              image_url: 'http://cdn/badge.png',
            },
            source: { type: 'course', course_id: COURSE_ID, display_name: null },
          }],
        },
      });

      renderComponent();

      await waitFor(() => expect(screen.getByText('Driver Safety 101')).toBeInTheDocument());

      const seal = document.querySelector('.cd-badge-seal') as HTMLElement;
      const sealImg = document.querySelector('.cd-badge-seal__icon') as HTMLImageElement;
      expect(seal).not.toBeNull();
      expect(seal.classList.contains('cd-badge-seal--earned')).toBe(true);
      expect(sealImg).not.toBeNull();
      expect(sealImg.src).toContain('badge.png');
      expect(sealImg.classList.contains('cd-badge-seal__icon--badge')).toBe(true);
    });

    it('AC-BADGE-03: falls back to book placeholder when badge is earned but has no image_url', async () => {
      mockUseCurriculums.mockReturnValue({
        data: [{
          ...RETENTION_CURRICULUM,
          courses: [{
            course_id: COURSE_ID,
            display_name: 'Driver Safety 101',
            exists: true,
            position: 1,
            finished: true,
            description: null,
            image_url: null,
          }],
          knowledge_check: {
            course_id: 'kc-other',
            display_name: null,
            exists: false,
            unlocks_at: null,
            is_open: false,
          },
        }],
      });
      mockUseBadges.mockReturnValue({
        data: {
          curriculum_badges: [],
          course_badges: [{
            awarded: true,
            id: 'award-2',
            awarded_at: '2026-10-01T00:00:00Z',
            seen: true,
            badge: {
              uuid: 'b2', title: 'Safety Badge', description: '', image_url: null,
            },
            source: { type: 'course', course_id: COURSE_ID, display_name: null },
          }],
        },
      });

      renderComponent();

      await waitFor(() => expect(screen.getByText('Driver Safety 101')).toBeInTheDocument());

      const sealImg = document.querySelector('.cd-badge-seal__icon') as HTMLImageElement;
      expect(sealImg).not.toBeNull();
      expect(sealImg.src).not.toBe('');
      expect(sealImg.classList.contains('cd-badge-seal__icon--badge')).toBe(false);
    });

    it('AC-EDGE-03: resume API failure does not block outline rendering', async () => {
      // Resume query failing should NOT prevent the lesson list from appearing.
      // The component only navigates if resumeQuery.data.sectionId is set —
      // a failed query leaves data undefined.
      jest.mocked(coursewareApi.getResumeBlock).mockRejectedValue(new Error('Resume unavailable'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Lesson 1: Basics')).toBeInTheDocument();
      });
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('points display', () => {
    it('AC-PTS-01: shows "Earn up to N points" when course not started', async () => {
      jest.mocked(gamificationApi.getCourseMaxPoints).mockResolvedValue({
        course_id: COURSE_ID, max_points: 80, completion_points: 80, first_try_points: 0, lessons: [],
      });
      mockUseGamification.mockReturnValue({ data: { courses: [] } });
      mockUseCourseProgressSummary.mockReturnValue({ data: { fraction: 0, completedUnits: 0, totalUnits: 4 } });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Earn up to 80 points')).toBeInTheDocument();
      });
    });

    it('AC-PTS-02: shows "X of Y points earned" when course is in progress', async () => {
      jest.mocked(gamificationApi.getCourseMaxPoints).mockResolvedValue({
        course_id: COURSE_ID, max_points: 80, completion_points: 80, first_try_points: 0, lessons: [],
      });
      mockUseGamification.mockReturnValue({
        data: { courses: [{ course_key: COURSE_ID, points: 40 }] },
      });
      mockUseCourseProgressSummary.mockReturnValue({ data: { fraction: 0.5, completedUnits: 2, totalUnits: 4 } });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('40 of 80 points earned')).toBeInTheDocument();
      });
    });

    it('AC-PTS-03: caps displayed earned points at max when gamification total exceeds max_points', async () => {
      jest.mocked(gamificationApi.getCourseMaxPoints).mockResolvedValue({
        course_id: COURSE_ID, max_points: 80, completion_points: 80, first_try_points: 0, lessons: [],
      });
      // Gamification summary reports 90 points (e.g. includes first-try bonuses counted differently)
      mockUseGamification.mockReturnValue({
        data: { courses: [{ course_key: COURSE_ID, points: 90 }] },
      });
      mockUseCourseProgressSummary.mockReturnValue({ data: { fraction: 1.0, completedUnits: 4, totalUnits: 4 } });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('80 of 80 points earned')).toBeInTheDocument();
      });
      expect(screen.queryByText('90 of 80 points earned')).not.toBeInTheDocument();
    });

    it('AC-PTS-04: falls back to "X points earned" while max-points query is still loading', async () => {
      // Simulate max-points query pending: mock never resolves
      jest.mocked(gamificationApi.getCourseMaxPoints).mockReturnValue(new Promise(() => {}));
      mockUseGamification.mockReturnValue({
        data: { courses: [{ course_key: COURSE_ID, points: 40 }] },
      });
      mockUseCourseProgressSummary.mockReturnValue({ data: { fraction: 0.5, completedUnits: 2, totalUnits: 4 } });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('40 points earned')).toBeInTheDocument();
      });
    });
  });
});
