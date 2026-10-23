/**
 * Unit tests for CompletionPage components:
 *   - LessonCompletePage
 *   - CourseCompletePage
 *   - RetentionInvitePage
 *   - RetentionCheckResultPage
 *
 * Strategy: mock all hooks and the getLessonResults API function so the
 * components render synchronously without HTTP calls. Each component is
 * tested in isolation via useParams/useNavigate/useLocation stubs.
 *
 * AC coverage:
 *   LCP-LOADING:        results query in-flight → LoadingSkeleton shown (prevents heading flash)
 *   LCP-DATA:           course title and lesson position rendered from outline data in subtitle
 *   LCP-PROGRESS-BAR:   "N of M lessons" renders with correct counts in stats card
 *   LCP-PRIMARY-NEXT:   next lesson exists → primary CTA is "Start lesson N+1"
 *   LCP-PRIMARY-FINAL:  last lesson → primary CTA is "Continue"
 *   LCP-NAVIGATE-NEXT:  clicking primary CTA navigates to next lesson route
 *   LCP-REPEAT:         already_completed_before (last lesson) → heading says "Course refreshed"
 *
 *   CCP-RENDERS:         "Course complete" kicker always present
 *   CCP-BADGE-VISIBLE:   earned date shown when complete milestone reached_at is set
 *   CCP-BADGE-HIDDEN:    badge row absent when no badge image_url
 *   CCP-BADGE-RING:      earned course badge item gets --earned class (blue ring via CSS)
 *   CCP-POINTS:          course points > 0 → points chip renders
 *   CCP-NAV-PROGRESS:    "See your badges" navigates to /progress with Badges tab
 *   CCP-CHECK-BOTH:      quick_check + final_check both present → both score cards render
 *   CCP-CHECK-IMPROVEMENT: final > quick → improvement chip shows positive delta
 *   CCP-CHECK-NULL:      both null → check grid absent
 *
 *   RIP-CHECK-OPEN:     check is open → "Still with you?" heading + "Start 30-day check" button
 *   RIP-CHECK-NOT-OPEN: check not open → "Come back in 30 days" heading shown
 *   RIP-OPENS-ON-DATE:  unlocks_at is set → "opens on <date>" text shown
 *   RIP-NO-PARENT:      no parent curriculum found → shows "Still with you?" (open state default)
 *   RIP-NAV-START:      clicking "Start 30-day check" navigates to lesson route
 *
 *   RCRP-LOADING:       isLoading → LoadingSkeleton rendered
 *   RCRP-ERROR:         isError → ErrorView with "Unable to load results"
 *   RCRP-PASS:          correct_percent >= 80 → pass lead text "stayed with you" shown
 *   RCRP-FAIL:          correct_percent < 80 → "Worth another look" heading
 *   RCRP-SCORE-LABEL:   score label "N of M" rendered in lead paragraph
 *   RCRP-NAV-BADGE:     PASS state: clicking "See your badges" navigates to /progress with tab
 *   RCRP-NAV-RETRY:     FAIL state: clicking "Try again now" navigates to /course/:id/retention
 */
import React from 'react';
import {
  render, screen, fireEvent, waitFor, act,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  LessonCompletePage,
  CourseCompletePage,
  RetentionInvitePage,
  RetentionCheckResultPage,
} from '../pages/CompletionPage';
import type { LearnerCurriculum } from '../api/curriculum';
import type { CourseOutline } from '../api/courseware';

// ---------------------------------------------------------------------------
// Router mocks
// ---------------------------------------------------------------------------

const mockNavigate = jest.fn();
const mockUseParams = jest.fn();
const mockUseLocation = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => mockUseParams(),
  useLocation: () => mockUseLocation(),
}));

// ---------------------------------------------------------------------------
// Hook mocks
// ---------------------------------------------------------------------------

const mockUseCourseOutline = jest.fn();
const mockUseCourseProgressSummary = jest.fn();
const mockUseGamification = jest.fn();
const mockUseCurriculums = jest.fn();

jest.mock('../hooks/useCourseOutline', () => ({
  useCourseOutline: (...args: unknown[]) => mockUseCourseOutline(...args),
}));
jest.mock('../hooks/useCourseProgressSummary', () => ({
  useCourseProgressSummary: (...args: unknown[]) => mockUseCourseProgressSummary(...args),
}));
jest.mock('../hooks/useGamification', () => ({
  useGamification: (...args: unknown[]) => mockUseGamification(...args),
}));
jest.mock('../hooks/useCurriculums', () => ({
  useCurriculums: (...args: unknown[]) => mockUseCurriculums(...args),
}));
jest.mock('../hooks/useBadgeCelebration', () => ({
  useBadgeCelebration: () => null,
  goToBadgeCelebration: jest.fn(),
}));

const mockUseBadges = jest.fn();
jest.mock('../hooks/useBadges', () => ({
  useBadges: (...args: unknown[]) => mockUseBadges(...args),
}));

const mockUseSequence = jest.fn();
jest.mock('../hooks/useSequence', () => ({
  useSequence: (...args: unknown[]) => mockUseSequence(...args),
}));

// ---------------------------------------------------------------------------
// API mocks — getLessonResults (used directly via useQuery in RCRP)
// ---------------------------------------------------------------------------

jest.mock('../api/gamification', () => ({
  getLessonResults: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COURSE_ID = 'course-v1:Uber+Safety+2026';
const SEQ_ID_1 = 'block-v1:Uber+seq1';
const SEQ_ID_2 = 'block-v1:Uber+seq2';

/** Minimal CourseOutline with two sequences (both incomplete) */
const OUTLINE_TWO_LESSONS: CourseOutline = {
  courseId: COURSE_ID,
  title: 'Road Safety',
  sections: {
    'sec-1': { id: 'sec-1', title: 'Section One', sequenceIds: [SEQ_ID_1, SEQ_ID_2] },
  },
  sequences: {
    [SEQ_ID_1]: {
      id: SEQ_ID_1, title: 'Lesson One', sectionId: 'sec-1', complete: false,
    },
    [SEQ_ID_2]: {
      id: SEQ_ID_2, title: 'Lesson Two', sectionId: 'sec-1', complete: false,
    },
  },
};

/** Outline with first lesson complete, second not — for outline-based progress tests */
const OUTLINE_TWO_LESSONS_ONE_DONE: CourseOutline = {
  ...OUTLINE_TWO_LESSONS,
  sequences: {
    [SEQ_ID_1]: {
      id: SEQ_ID_1, title: 'Lesson One', sectionId: 'sec-1', complete: true,
    },
    [SEQ_ID_2]: {
      id: SEQ_ID_2, title: 'Lesson Two', sectionId: 'sec-1', complete: false,
    },
  },
};

/** Minimal CourseOutline with a single sequence (last lesson) */
const OUTLINE_ONE_LESSON: CourseOutline = {
  courseId: COURSE_ID,
  title: 'Road Safety',
  sections: {
    'sec-1': { id: 'sec-1', title: 'Section One', sequenceIds: [SEQ_ID_1] },
  },
  sequences: {
    [SEQ_ID_1]: {
      id: SEQ_ID_1, title: 'Only Lesson', sectionId: 'sec-1', complete: false,
    },
  },
};

const PROGRESS_SUMMARY = { completedUnits: 1, totalUnits: 5, fraction: 0.2 };

function makeCurriculum(overrides: Partial<LearnerCurriculum> = {}): LearnerCurriculum {
  return {
    uuid: 'curr-1',
    title: 'New driver onboarding',
    description: '',
    image_url: null,
    assigned_at: '2026-01-01T00:00:00Z',
    courses: [{
      course_id: COURSE_ID, display_name: 'Road Safety', exists: true, position: 0, finished: false, description: null, image_url: null,
    }],
    courses_finished: 1,
    courses_total: 3,
    milestones: {
      complete: { reached_at: null, badge: null },
      retained: { reached_at: null, badge: null },
    },
    knowledge_check: {
      course_id: COURSE_ID,
      display_name: 'Knowledge check',
      exists: true,
      unlocks_at: null,
      is_open: true,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeQC = () => new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: 0, retryDelay: 0 } },
});

function wrap(ui: React.ReactElement, qc = makeQC()) {
  return render(
    <QueryClientProvider client={qc}>{ui}</QueryClientProvider>,
  );
}

function getLessonResultsMock() {
  return jest.requireMock('../api/gamification') as { getLessonResults: jest.Mock };
}

const DEFAULT_LESSON_RESULTS = {
  sequence_key: SEQ_ID_1,
  course_key: COURSE_ID,
  points_earned: 0,
  correct_percent: null,
  questions: 0,
  already_completed_before: false,
  steps_count: null,
};

function setDefaultMocks() {
  mockUseParams.mockReturnValue({ courseId: COURSE_ID, sequenceId: SEQ_ID_1 });
  mockUseLocation.mockReturnValue({ state: null, pathname: '/completion' });
  mockUseCourseOutline.mockReturnValue({ data: null, isLoading: false, isError: false });
  mockUseCourseProgressSummary.mockReturnValue({ data: null, isLoading: false, isError: false });
  mockUseGamification.mockReturnValue({ data: null, isLoading: false, isError: false });
  mockUseCurriculums.mockReturnValue({ data: undefined, isLoading: false, isError: false });
  mockUseBadges.mockReturnValue({ data: undefined });
  // SEQ_ID_1 = current lesson (3 units); anything else = next lesson placeholder (empty).
  mockUseSequence.mockImplementation((seqId: string) => {
    if (seqId === SEQ_ID_1) {
      return { units: [{ id: 'u1', graded: false }, { id: 'u2', graded: false }, { id: 'u3', graded: false }] };
    }
    return { units: [] };
  });
  // Provide a default resolved value so LessonCompletePage clears its loading guard.
  getLessonResultsMock().getLessonResults.mockResolvedValue(DEFAULT_LESSON_RESULTS);
}

// ---------------------------------------------------------------------------
// ── LessonCompletePage ─────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('LessonCompletePage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    setDefaultMocks();
  });

  it('LCP-LOADING: shows LoadingSkeleton while results query is in-flight (when since is provided)', () => {
    // Query only runs when `since` is present — provide it so the loading state triggers.
    mockUseLocation.mockReturnValue({ state: { since: '2026-10-01T00:00:00Z' }, pathname: '/completion' });
    getLessonResultsMock().getLessonResults.mockReturnValue(new Promise(() => {}));
    wrap(<LessonCompletePage />);
    expect(screen.getByLabelText('Loading…')).toBeInTheDocument();
  });

  it('LCP-DATA: renders lesson title (not course title) and lesson position from outline', async () => {
    mockUseCourseOutline.mockReturnValue({ data: OUTLINE_TWO_LESSONS, isLoading: false });
    mockUseParams.mockReturnValue({ courseId: COURSE_ID, sequenceId: SEQ_ID_1 });
    wrap(<LessonCompletePage />);
    // Subtitle should show the lesson/sequence title, not the course title (Figma 1121:11166)
    await waitFor(() => {
      expect(screen.getByText('Lesson One · Lesson 1 of 2')).toBeInTheDocument();
    });
  });

  it('LCP-PROGRESS-BAR: shows correct "N of M lessons complete" from outline (not progress units)', async () => {
    // OUTLINE_TWO_LESSONS_ONE_DONE has 2 sequences, 1 complete → expect "1 of 2 lessons"
    mockUseCourseOutline.mockReturnValue({ data: OUTLINE_TWO_LESSONS_ONE_DONE, isLoading: false });
    mockUseCourseProgressSummary.mockReturnValue({ data: PROGRESS_SUMMARY });
    wrap(<LessonCompletePage />);
    await waitFor(() => {
      expect(screen.getByText(/1 of 2 lessons/i)).toBeInTheDocument();
    });
  });

  it('LCP-PRIMARY-NEXT: primary CTA is "Start lesson N+1" when next lesson exists', async () => {
    mockUseCourseOutline.mockReturnValue({ data: OUTLINE_TWO_LESSONS, isLoading: false });
    mockUseParams.mockReturnValue({ courseId: COURSE_ID, sequenceId: SEQ_ID_1 });
    wrap(<LessonCompletePage />);
    // Lesson 1 of 2 → label should be "Start lesson 2"
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /start lesson 2/i })).toBeInTheDocument();
    });
  });

  it('LCP-PRIMARY-FINAL: primary CTA is "Continue" when on last lesson', async () => {
    mockUseCourseOutline.mockReturnValue({ data: OUTLINE_ONE_LESSON, isLoading: false });
    mockUseParams.mockReturnValue({ courseId: COURSE_ID, sequenceId: SEQ_ID_1 });
    wrap(<LessonCompletePage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^continue$/i })).toBeInTheDocument();
    });
  });

  it('LCP-NAVIGATE-NEXT: clicking primary CTA navigates to next lesson route', async () => {
    mockUseCourseOutline.mockReturnValue({ data: OUTLINE_TWO_LESSONS, isLoading: false });
    mockUseParams.mockReturnValue({ courseId: COURSE_ID, sequenceId: SEQ_ID_1 });
    wrap(<LessonCompletePage />);
    await waitFor(() => screen.getByRole('button', { name: /start lesson 2/i }));
    fireEvent.click(screen.getByRole('button', { name: /start lesson 2/i }));
    expect(mockNavigate).toHaveBeenCalledWith(
      `/course/${COURSE_ID}/lesson/${SEQ_ID_2}/step/0`,
    );
  });

  it('LCP-REPEAT: already_completed_before → heading says "Course refreshed" on last lesson', async () => {
    (jest.requireMock('../api/gamification') as { getLessonResults: jest.Mock }).getLessonResults.mockResolvedValue({
      sequence_key: SEQ_ID_1,
      course_key: COURSE_ID,
      points_earned: 5,
      correct_percent: 80,
      first_try_goal_met: true,
      questions: 5,
      already_completed_before: true,
      steps_count: null,
    });
    mockUseLocation.mockReturnValue({ state: { since: '2026-10-01T00:00:00Z' }, pathname: '/completion' });
    mockUseCourseOutline.mockReturnValue({ data: OUTLINE_ONE_LESSON, isLoading: false });
    mockUseParams.mockReturnValue({ courseId: COURSE_ID, sequenceId: SEQ_ID_1 });
    wrap(<LessonCompletePage />);
    await waitFor(() => {
      expect(screen.getByText('Course refreshed')).toBeInTheDocument();
    });
  });

  it('LCP-BACK: clicking Back button navigates to last step of completed lesson', async () => {
    wrap(<LessonCompletePage />);
    await waitFor(() => screen.getByRole('button', { name: /^back$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    // SEQ_ID_1 has 3 units in the mock → lastIdx = 2
    expect(mockNavigate).toHaveBeenCalledWith(`/course/${COURSE_ID}/lesson/${SEQ_ID_1}/step/2`);
  });

  it('LCP-RENDERS: page renders when router state has no sequenceId override', async () => {
    // Router state is absent — the page still renders correctly using the sequenceId from params.
    mockUseLocation.mockReturnValue({ state: null, pathname: '/completion' });
    mockUseCourseOutline.mockReturnValue({ data: OUTLINE_TWO_LESSONS, isLoading: false });
    wrap(<LessonCompletePage />);
    // Page renders.
    await waitFor(() => {
      expect(screen.getByText('Lesson complete')).toBeInTheDocument();
    });
    // Results are always fetched regardless of router state (since removal).
    expect(getLessonResultsMock().getLessonResults).toHaveBeenCalled();
  });

  it('LCP-POINTS-SETTLE: re-reads results so points awarded after the first read are shown', async () => {
    // Points rows are written by a Celery task after the completion commits, so the first read
    // can miss the final step's row (10 of 20). The page must pick up the settled total.
    jest.useFakeTimers();
    try {
      getLessonResultsMock().getLessonResults
        .mockResolvedValueOnce({ ...DEFAULT_LESSON_RESULTS, points_earned: 10, steps_count: 2 })
        .mockResolvedValue({ ...DEFAULT_LESSON_RESULTS, points_earned: 20, steps_count: 2 });
      mockUseLocation.mockReturnValue({ state: { since: '2026-10-14T12:35:04.847061Z' }, pathname: '/completion' });
      mockUseCourseOutline.mockReturnValue({ data: OUTLINE_TWO_LESSONS, isLoading: false });
      wrap(<LessonCompletePage />);

      await act(async () => { await jest.advanceTimersByTimeAsync(0); });
      expect(screen.getByText('+10')).toBeInTheDocument();

      await act(async () => { await jest.advanceTimersByTimeAsync(10_000); });
      expect(screen.getByText('+20')).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });
});

// ---------------------------------------------------------------------------
// ── CourseCompletePage ─────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('CourseCompletePage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    setDefaultMocks();
    mockUseParams.mockReturnValue({ courseId: COURSE_ID });
  });

  it('CCP-RENDERS: "Course complete" kicker is always present', () => {
    wrap(<CourseCompletePage />);
    expect(screen.getByText('Course complete')).toBeInTheDocument();
  });

  it('CCP-BADGE-HIDDEN: earned date absent when complete milestone reached_at is null', () => {
    const curriculum = makeCurriculum();
    mockUseCurriculums.mockReturnValue({ data: [curriculum] });
    wrap(<CourseCompletePage />);
    expect(screen.queryByText(/earned/i)).not.toBeInTheDocument();
  });

  it('CCP-BADGE-VISIBLE: earned date shown when complete milestone reached_at is set', () => {
    const curriculum = makeCurriculum({
      milestones: {
        complete: {
          reached_at: '2026-10-01T00:00:00Z',
          badge: {
            uuid: 'badge-1',
            title: 'Course Complete Badge',
            description: 'Earned it',
            image_url: 'https://example.com/badge.png',
          },
        },
        retained: { reached_at: null, badge: null },
      },
    });
    mockUseCurriculums.mockReturnValue({ data: [curriculum] });
    wrap(<CourseCompletePage />);
    expect(screen.getByText(/earned/i)).toBeInTheDocument();
  });

  it('CCP-BADGE-RING: earned course badge gets --earned class; unearned does not', () => {
    const curriculum = makeCurriculum({
      courses: [
        {
          course_id: COURSE_ID,
          display_name: 'Road Safety',
          exists: true,
          position: 0,
          finished: true,
          description: null,
          image_url: null,
        },
        {
          course_id: 'course-v1:Uber+Other+2026',
          display_name: 'Driving Basics',
          exists: true,
          position: 1,
          finished: false,
          description: null,
          image_url: null,
        },
      ],
    });
    mockUseCurriculums.mockReturnValue({ data: [curriculum] });
    mockUseBadges.mockReturnValue({
      data: {
        curriculum_badges: [],
        course_badges: [{
          awarded: true,
          id: 'award-1',
          awarded_at: '2026-10-01T00:00:00Z',
          seen: false,
          badge: {
            uuid: 'b-1',
            title: 'Safety Badge',
            description: '',
            image_url: 'https://example.com/safety.png',
          },
          source: { type: 'course', course_id: COURSE_ID, display_name: 'Road Safety' },
        }],
      },
    });
    const { container } = wrap(<CourseCompletePage />);
    const items = container.querySelectorAll('.cpc-badge-item');
    expect(items).toHaveLength(2);
    expect(items[0].classList.contains('cpc-badge-item--earned')).toBe(true);
    expect(items[1].classList.contains('cpc-badge-item--earned')).toBe(false);
  });

  it('CCP-POINTS: course points > 0 renders the points chip', () => {
    mockUseGamification.mockReturnValue({
      data: {
        lifetime_points: 100,
        month_points: 50,
        month: '2026-10',
        current_streak_weeks: 0,
        longest_streak_weeks: 0,
        last_learning_date: null,
        courses: [{ course_key: COURSE_ID, points: 42 }],
        this_week: null,
        recent_weeks: [],
        server_time: '2026-10-09T00:00:00Z',
      },
    });
    wrap(<CourseCompletePage />);
    expect(screen.getByText('+42')).toBeInTheDocument();
  });

  it('CCP-NAV-PROGRESS: "See your badges" navigates to /progress with Badges tab', () => {
    wrap(<CourseCompletePage />);
    fireEvent.click(screen.getByRole('button', { name: /see your badges/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/progress', { state: { tab: 'Badges' } });
  });

  it('CCP-CHECK-BOTH: quick check and final check cards render with correct scores', () => {
    mockUseGamification.mockReturnValue({
      data: {
        lifetime_points: 100,
        month_points: 50,
        month: '2026-10',
        current_streak_weeks: 0,
        longest_streak_weeks: 0,
        last_learning_date: null,
        courses: [{
          course_key: COURSE_ID,
          points: 0,
          quick_check: { correct: 6, total: 10, at: '2026-10-01T00:00:00Z' },
          final_check: { correct: 9, total: 10, passed_at: '2026-10-15T00:00:00Z' },
        }],
        this_week: null,
        recent_weeks: [],
        server_time: '2026-10-20T00:00:00Z',
      },
      isLoading: false,
      isError: false,
    });
    wrap(<CourseCompletePage />);
    expect(screen.getByText('Quick check')).toBeInTheDocument();
    expect(screen.getByText('Final check')).toBeInTheDocument();
    expect(screen.getByText(/6\s+of\s+10/)).toBeInTheDocument();
    expect(screen.getByText(/9\s+of\s+10/)).toBeInTheDocument();
  });

  it('CCP-CHECK-IMPROVEMENT: improvement chip shows positive delta when final > quick', () => {
    mockUseGamification.mockReturnValue({
      data: {
        lifetime_points: 0,
        month_points: 0,
        month: '2026-10',
        current_streak_weeks: 0,
        longest_streak_weeks: 0,
        last_learning_date: null,
        courses: [{
          course_key: COURSE_ID,
          points: 0,
          quick_check: { correct: 6, total: 10, at: '2026-10-01T00:00:00Z' },
          final_check: { correct: 9, total: 10, passed_at: '2026-10-15T00:00:00Z' },
        }],
        this_week: null,
        recent_weeks: [],
        server_time: '2026-10-20T00:00:00Z',
      },
      isLoading: false,
      isError: false,
    });
    wrap(<CourseCompletePage />);
    expect(screen.getByText('+3')).toBeInTheDocument();
  });

  it('CCP-CHECK-NULL: check grid absent when both quick_check and final_check are null', () => {
    mockUseGamification.mockReturnValue({
      data: {
        lifetime_points: 0,
        month_points: 0,
        month: '2026-10',
        current_streak_weeks: 0,
        longest_streak_weeks: 0,
        last_learning_date: null,
        courses: [{
          course_key: COURSE_ID,
          points: 0,
          quick_check: null,
          final_check: null,
        }],
        this_week: null,
        recent_weeks: [],
        server_time: '2026-10-20T00:00:00Z',
      },
      isLoading: false,
      isError: false,
    });
    wrap(<CourseCompletePage />);
    expect(screen.queryByText('Quick check')).not.toBeInTheDocument();
    expect(screen.queryByText('Final check')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ── RetentionInvitePage ────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('RetentionInvitePage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    setDefaultMocks();
    mockUseParams.mockReturnValue({ courseId: COURSE_ID });
  });

  it('RIP-CHECK-OPEN: check is open → "Still with you?" heading + "Start 30-day check" button', () => {
    const curriculum = makeCurriculum({
      knowledge_check: {
        course_id: COURSE_ID,
        display_name: null,
        exists: true,
        unlocks_at: null,
        is_open: true,
      },
    });
    mockUseCurriculums.mockReturnValue({ data: [curriculum] });
    wrap(<RetentionInvitePage />);
    expect(screen.getByText('Still with you?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start 30-day check/i })).toBeInTheDocument();
  });

  it('RIP-CHECK-NOT-OPEN: check not open → "Come back in 30 days" heading shown', () => {
    const curriculum = makeCurriculum({
      knowledge_check: {
        course_id: COURSE_ID,
        display_name: null,
        exists: true,
        unlocks_at: null,
        is_open: false,
      },
    });
    mockUseCurriculums.mockReturnValue({ data: [curriculum] });
    wrap(<RetentionInvitePage />);
    expect(screen.getByText('Come back in 30 days')).toBeInTheDocument();
  });

  it('RIP-OPENS-ON-DATE: unlocks_at is set → "opens on <date>" text shown', () => {
    const curriculum = makeCurriculum({
      knowledge_check: {
        course_id: COURSE_ID,
        display_name: null,
        exists: true,
        unlocks_at: '2026-11-01T00:00:00Z',
        is_open: false,
      },
    });
    mockUseCurriculums.mockReturnValue({ data: [curriculum] });
    wrap(<RetentionInvitePage />);
    // Should mention the opens-on date
    expect(screen.getByText(/opens on/i)).toBeInTheDocument();
  });

  it('RIP-NO-PARENT: no parent curriculum → defaults to open state ("Still with you?")', () => {
    mockUseCurriculums.mockReturnValue({ data: [] });
    wrap(<RetentionInvitePage />);
    // knowledgeCheck is null → notOpenYet is false → open state
    expect(screen.getByText('Still with you?')).toBeInTheDocument();
  });

  it('RIP-NAV-START: clicking "Start 30-day check" navigates to first lesson route', () => {
    const curriculum = makeCurriculum({
      knowledge_check: {
        course_id: COURSE_ID,
        display_name: null,
        exists: true,
        unlocks_at: null,
        is_open: true,
      },
    });
    mockUseCurriculums.mockReturnValue({ data: [curriculum] });
    mockUseCourseOutline.mockReturnValue({ data: OUTLINE_TWO_LESSONS });
    wrap(<RetentionInvitePage />);
    fireEvent.click(screen.getByRole('button', { name: /start 30-day check/i }));
    expect(mockNavigate).toHaveBeenCalledWith(
      `/course/${COURSE_ID}/lesson/${SEQ_ID_1}/step/0`,
    );
  });
});

// ---------------------------------------------------------------------------
// ── RetentionCheckResultPage ───────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('RetentionCheckResultPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    setDefaultMocks();
    mockUseParams.mockReturnValue({ courseId: COURSE_ID, sequenceId: SEQ_ID_1 });
    mockUseLocation.mockReturnValue({ state: { since: '2026-10-01T00:00:00Z' }, pathname: '/retention/result' });
  });

  function getGamificationMock() {
    return jest.requireMock('../api/gamification') as { getLessonResults: jest.Mock };
  }

  it('RCRP-LOADING: shows LoadingSkeleton while results query is in-flight', () => {
    getGamificationMock().getLessonResults.mockReturnValue(new Promise(() => {}));
    wrap(<RetentionCheckResultPage />);
    expect(screen.getByLabelText('Loading…')).toBeInTheDocument();
  });

  it('RCRP-PENDING: retained.reached_at null + poll not yet expired → shows loading, not fail', async () => {
    // retained.reached_at is null (Celery hasn't run yet); poll timeout has not fired.
    // The component must show the loading/pending state, NOT "Worth another look".
    mockUseCurriculums.mockReturnValue({
      data: [makeCurriculum()], // default has retained: { reached_at: null }
      isLoading: false,
    });
    getGamificationMock().getLessonResults.mockResolvedValue({
      ...DEFAULT_LESSON_RESULTS,
      correct_percent: 60,
      questions: 5,
    });
    wrap(<RetentionCheckResultPage />);
    // After results resolve, the pending state should be active (poll not expired).
    await waitFor(() => {
      expect(screen.queryByText('Worth another look')).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText('Loading…')).toBeInTheDocument();
  });

  it('RCRP-ERROR: gamification error does not block result page — shows pending state instead', async () => {
    // A 404 / network error from the gamification API should not replace the page with an
    // ErrorView. Pass/fail comes from curriculums, so we degrade gracefully with score "—".
    getGamificationMock().getLessonResults.mockRejectedValue(new Error('Network error'));
    wrap(<RetentionCheckResultPage />);
    await waitFor(() => {
      expect(screen.queryByText('Unable to load results')).not.toBeInTheDocument();
    });
    // retained.reached_at is null and poll has not expired → pending/loading state shown.
    expect(screen.getByLabelText('Loading…')).toBeInTheDocument();
  });

  it('RCRP-SCORE-DASH: score "—" shown in pass state when no lesson results available (no since)', async () => {
    // When `since` is absent (deep-link or gamification unavailable), useLessonResults is
    // disabled and data is undefined. Score should degrade to "—" rather than blocking the page.
    mockUseLocation.mockReturnValue({ state: null, pathname: '/retention/result' });
    mockUseCurriculums.mockReturnValue({
      data: [makeCurriculum({
        milestones: {
          complete: { reached_at: null, badge: null },
          retained: { reached_at: '2026-10-10T00:00:00Z', badge: null },
        },
      })],
      isLoading: false,
    });
    wrap(<RetentionCheckResultPage />);
    await waitFor(() => {
      expect(screen.getByText(/What you learned stayed with you/i)).toBeInTheDocument();
    });
    const lead = document.querySelector('.cpl-lead');
    expect(lead?.textContent).toMatch(/—/);
  });

  it('RCRP-PASS: milestones.retained.reached_at set → pass lead text shown', async () => {
    // Pass/fail is now driven by milestones.retained.reached_at, not first_try_goal_met.
    mockUseCurriculums.mockReturnValue({
      data: [makeCurriculum({
        milestones: {
          complete: { reached_at: null, badge: null },
          retained: { reached_at: '2026-10-10T00:00:00Z', badge: null },
        },
      })],
    });
    getGamificationMock().getLessonResults.mockResolvedValue({
      sequence_key: SEQ_ID_1,
      course_key: COURSE_ID,
      points_earned: 10,
      correct_percent: 80,
      first_try_goal_met: true,
      questions: 5,
      already_completed_before: false,
      steps_count: null,
    });
    wrap(<RetentionCheckResultPage />);
    await waitFor(() => {
      expect(screen.getByText(/what you learned stayed with you/i)).toBeInTheDocument();
    });
  });

  it('RCRP-FAIL: after poll timeout, retained.reached_at null → "Worth another look" heading', async () => {
    jest.useFakeTimers();
    getGamificationMock().getLessonResults.mockResolvedValue({
      sequence_key: SEQ_ID_1,
      course_key: COURSE_ID,
      points_earned: 5,
      correct_percent: 60,
      first_try_goal_met: false,
      questions: 5,
      already_completed_before: false,
      steps_count: null,
    });
    wrap(<RetentionCheckResultPage />);
    // Flush promise resolutions (TanStack Query result delivery).
    await act(async () => {});
    // Advance past the 10-second poll timeout so setPollExpired fires.
    act(() => { jest.advanceTimersByTime(11000); });
    expect(screen.getByText('Worth another look')).toBeInTheDocument();
    jest.useRealTimers();
  });

  it('RCRP-SCORE-LABEL: score label "N of M" rendered in lead paragraph (pass state)', async () => {
    // Set retained.reached_at so the pass state renders and shows the score label.
    mockUseCurriculums.mockReturnValue({
      data: [makeCurriculum({
        milestones: {
          complete: { reached_at: null, badge: null },
          retained: { reached_at: '2026-10-10T00:00:00Z', badge: null },
        },
      })],
      isLoading: false,
    });
    getGamificationMock().getLessonResults.mockResolvedValue({
      sequence_key: SEQ_ID_1,
      course_key: COURSE_ID,
      points_earned: 10,
      correct_percent: 80,
      first_try_goal_met: true,
      questions: 5,
      already_completed_before: false,
      steps_count: null,
    });
    wrap(<RetentionCheckResultPage />);
    await waitFor(() => {
      // 80% of 5 = 4 correct → rendered as "4 of 5" in lead text
      expect(screen.getByText(/4 of 5/)).toBeInTheDocument();
    });
  });

  it('RCRP-NAV-BADGE: PASS state (retained.reached_at set): navigates to /progress', async () => {
    mockUseCurriculums.mockReturnValue({
      data: [makeCurriculum({
        milestones: {
          complete: { reached_at: null, badge: null },
          retained: { reached_at: '2026-10-10T00:00:00Z', badge: null },
        },
      })],
    });
    getGamificationMock().getLessonResults.mockResolvedValue({
      sequence_key: SEQ_ID_1,
      course_key: COURSE_ID,
      points_earned: 10,
      correct_percent: 100,
      first_try_goal_met: true,
      questions: 5,
      already_completed_before: false,
      steps_count: null,
    });
    wrap(<RetentionCheckResultPage />);
    await waitFor(() => screen.getByRole('button', { name: /see your badges/i }));
    fireEvent.click(screen.getByRole('button', { name: /see your badges/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/progress', { state: { tab: 'Badges' } });
  });

  it('RCRP-NAV-RETRY: FAIL state after poll timeout: "Try again" navigates to /course/:id/retention', async () => {
    jest.useFakeTimers();
    getGamificationMock().getLessonResults.mockResolvedValue({
      sequence_key: SEQ_ID_1,
      course_key: COURSE_ID,
      points_earned: 0,
      correct_percent: 40,
      first_try_goal_met: false,
      questions: 5,
      already_completed_before: false,
      steps_count: null,
    });
    wrap(<RetentionCheckResultPage />);
    // Flush promise resolutions.
    await act(async () => {});
    // Advance past poll timeout so "Try again" button is visible.
    act(() => { jest.advanceTimersByTime(11000); });
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(mockNavigate).toHaveBeenCalledWith(`/course/${COURSE_ID}/retention`);
    jest.useRealTimers();
  });

  it('RCRP-NULL-PERCENT: correct_percent null + poll expired → fallback lead shown (no score)', async () => {
    jest.useFakeTimers();
    getGamificationMock().getLessonResults.mockResolvedValue({
      sequence_key: SEQ_ID_1,
      course_key: COURSE_ID,
      points_earned: 0,
      correct_percent: null,
      first_try_goal_met: false,
      questions: 0,
      already_completed_before: false,
      steps_count: null,
    });
    wrap(<RetentionCheckResultPage />);
    // Flush promise resolutions.
    await act(async () => {});
    // Advance past poll timeout so the fail state renders.
    act(() => { jest.advanceTimersByTime(11000); });
    expect(screen.getByText(/worth another look/i)).toBeInTheDocument();
    // When score is unavailable, the lead shows the fallback copy (no "X of Y right").
    expect(screen.getByText(/review the missed topics/i)).toBeInTheDocument();
    jest.useRealTimers();
  });
});
