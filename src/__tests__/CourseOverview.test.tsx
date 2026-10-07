/**
 * Integration tests for CourseOverview page.
 *
 * AC coverage:
 *   - AC-NAV-01: Fresh user (sectionId=null) stays on overview, renders lesson list
 *   - AC-NAV-02: Returning user (sectionId set) redirects to /lesson/:sectionId/step/0
 *   - AC-NAV-03: Lesson card click navigates to the selected sequence
 *   - AC-EDGE-01: Outline error renders ErrorView
 *   - AC-EDGE-02: Empty outline renders empty-state message
 *   - AC-LOAD-01: Loading skeleton shown while data loads
 */
import React from 'react';
import {
  render, screen, waitFor, fireEvent,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CourseOverview } from '../pages/CourseOverview';
import * as coursewareApi from '../api/courseware';
import * as progressApi from '../api/progress';

// ---------------------------------------------------------------------------
// Routing mocks — avoid a real router; use stubs for useNavigate / useParams
// ---------------------------------------------------------------------------

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ courseId: 'course-v1:Uber+L2024' }),
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
    'seq-1': { id: 'seq-1', title: 'Lesson 1: Basics', sectionId: 'section-1' },
    'seq-2': { id: 'seq-2', title: 'Lesson 2: Advanced', sectionId: 'section-1' },
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

const MOCK_PROGRESS: progressApi.UberLearnProgress = {
  completedActivities: 0,
  totalActivities: 2,
  fraction: 0,
  assessments: { baseline: null, final: null, retention: null },
  points: { earned: null, possible: null },
  streak: { currentDays: 0, longestDays: 0 },
  courseComplete: false,
  badges: [],
};

beforeEach(() => {
  mockNavigate.mockClear();
  jest.mocked(coursewareApi.getResumeBlock).mockResolvedValue(RESUME_FRESH);
  jest.mocked(coursewareApi.getCourseOutline).mockResolvedValue(OUTLINE);
  jest.mocked(progressApi.getUberLearnProgress).mockResolvedValue(MOCK_PROGRESS);
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
        expect(screen.getByRole('heading', { level: 1, name: 'Driver Safety 101' })).toBeInTheDocument();
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

  describe('returning user (sectionId is set)', () => {
    it('AC-NAV-02: stays on the overview and "Continue course" resumes /lesson/:sectionId/step/0', async () => {
      jest.mocked(coursewareApi.getResumeBlock).mockResolvedValue(RESUME_RETURNING);

      renderComponent();

      const cta = await screen.findByRole('button', { name: 'Continue course' });
      expect(mockNavigate).not.toHaveBeenCalled();

      fireEvent.click(cta);

      expect(mockNavigate).toHaveBeenCalledWith(`/course/${COURSE_ID}/lesson/seq-1/step/0`);
    });

    it('AC-NAV-02b: uses sectionId (camelCased from section_id) not sectionId as raw string', async () => {
      // Verify the camelCased key "sectionId" is what drives navigation,
      // NOT a raw snake_case field. RESUME_RETURNING.sectionId = 'seq-1'.
      jest.mocked(coursewareApi.getResumeBlock).mockResolvedValue({
        ...RESUME_RETURNING,
        sectionId: 'block-v1:Uber+L2024+type@sequential+block@abc',
      });

      renderComponent();

      fireEvent.click(await screen.findByRole('button', { name: 'Continue course' }));

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining('block-v1:Uber+L2024+type@sequential+block@abc'),
      );
    });
  });

  describe('lesson card interaction', () => {
    // Lessons unlock in order: the current lesson and completed ones are clickable,
    // lessons not reached yet ("upcoming") are disabled.
    it('AC-NAV-03: clicking the current lesson card navigates to /lesson/:seqId/step/0', async () => {
      jest.mocked(coursewareApi.getResumeBlock).mockResolvedValue(RESUME_RETURNING);
      renderComponent();

      await waitFor(() => expect(screen.getByText('Lesson 1: Basics')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Lesson 1: Basics'));

      expect(mockNavigate).toHaveBeenCalledWith(
        `/course/${COURSE_ID}/lesson/seq-1/step/0`,
      );
    });

    it('AC-NAV-03b: clicking a different lesson card uses the correct sequenceId', async () => {
      jest.mocked(coursewareApi.getResumeBlock).mockResolvedValue({ ...RESUME_RETURNING, sectionId: 'seq-2' });
      renderComponent();

      await waitFor(() => expect(screen.getByText('Lesson 2: Advanced')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Lesson 2: Advanced'));
      expect(mockNavigate).toHaveBeenLastCalledWith(`/course/${COURSE_ID}/lesson/seq-2/step/0`);

      // The completed lesson before it stays reachable.
      fireEvent.click(screen.getByText('Lesson 1: Basics'));
      expect(mockNavigate).toHaveBeenLastCalledWith(`/course/${COURSE_ID}/lesson/seq-1/step/0`);
    });

    it('AC-NAV-03c: lessons not reached yet are disabled', async () => {
      jest.mocked(coursewareApi.getResumeBlock).mockResolvedValue(RESUME_RETURNING);
      renderComponent();

      await waitFor(() => expect(screen.getByText('Lesson 2: Advanced')).toBeInTheDocument());

      expect(screen.getByText('Lesson 2: Advanced').closest('button')).toBeDisabled();
      fireEvent.click(screen.getByText('Lesson 2: Advanced'));
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('AC-EDGE-01: shows ErrorView with retry option when outline fetch fails', async () => {
      jest.mocked(coursewareApi.getCourseOutline).mockRejectedValue(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/could not load course/i)).toBeInTheDocument();
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
});
