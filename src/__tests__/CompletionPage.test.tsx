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
 *   CCP-RENDERS:        "Course complete" kicker always present
 *   CCP-BADGE-VISIBLE:  earned date shown when complete milestone reached_at is set
 *   CCP-BADGE-HIDDEN:   badge row absent when no badge image_url
 *   CCP-POINTS:         course points > 0 → points chip renders
 *   CCP-NAV-PROGRESS:   "See your badges" navigates to /progress with Badges tab
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
 *   RCRP-NAV-RETRY:     FAIL state: clicking "Try again" navigates to /course/:id/retention
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

  it('LCP-DATA: renders course title and lesson position from outline', async () => {
    mockUseCourseOutline.mockReturnValue({ data: OUTLINE_TWO_LESSONS, isLoading: false });
    mockUseParams.mockReturnValue({ courseId: COURSE_ID, sequenceId: SEQ_ID_1 });
    wrap(<LessonCompletePage />);
    await waitFor(() => {
      expect(screen.getByText('Road Safety · Lesson 1 of 2')).toBeInTheDocument();
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

  it('LCP-BACK: clicking Back button navigates to course overview', async () => {
    wrap(<LessonCompletePage />);
    await waitFor(() => screen.getByRole('button', { name: /^back$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    expect(mockNavigate).toHaveBeenCalledWith(`/course/${COURSE_ID}`);
  });

  it('LCP-NO-SINCE: without router state since, points/score stats are hidden and page still renders', async () => {
    // since is absent (no router state) — the resultsQuery should be disabled and
    // the points chip and correct-count row must not appear.
    mockUseLocation.mockReturnValue({ state: null, pathname: '/completion' });
    mockUseCourseOutline.mockReturnValue({ data: OUTLINE_TWO_LESSONS, isLoading: false });
    // getLessonResults must NOT be called when since is absent.
    getLessonResultsMock().getLessonResults.mockClear();
    wrap(<LessonCompletePage />);
    // Page renders without loading state (query is disabled, not in-flight).
    await waitFor(() => {
      expect(screen.getByText('Lesson complete')).toBeInTheDocument();
    });
    // Points chip absent.
    expect(screen.queryByText(/\+\d/)).not.toBeInTheDocument();
    // "Right first time" row absent (only shown when since is provided).
    expect(screen.queryByText(/right first time/i)).not.toBeInTheDocument();
    // The results API was never called.
    expect(getLessonResultsMock().getLessonResults).not.toHaveBeenCalled();
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

  it('RCRP-ERROR: shows ErrorView with "Unable to load results" when query errors', async () => {
    getGamificationMock().getLessonResults.mockRejectedValue(new Error('Network error'));
    wrap(<RetentionCheckResultPage />);
    await waitFor(() => {
      expect(screen.getByText('Unable to load results')).toBeInTheDocument();
    }, { timeout: 5000 });
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
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

  it('RCRP-NULL-PERCENT: correct_percent null + poll expired → score label shows dash "—" in fail lead', async () => {
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
    const lead = screen.getByText(/you got/i);
    expect(lead.textContent).toContain('—');
    jest.useRealTimers();
  });
});
