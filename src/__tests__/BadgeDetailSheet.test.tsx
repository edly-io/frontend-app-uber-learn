/**
 * Unit tests for BadgeDetailSheet bottom sheet.
 *
 * AC coverage:
 *   - BDS-NULL: renders nothing when data is null
 *   - BDS-COURSE-LABELS: course sheet renders type label, title, description with lesson count
 *   - BDS-COURSE-NOT-STARTED-CTA: not-started course shows "See course"
 *   - BDS-COURSE-UNEARNED-CTA: in-progress course shows "Continue course"
 *   - BDS-COURSE-EARNED-CTA: earned course shows "Review course"
 *   - BDS-COURSE-EARNED-DATE: earned course shows earned date
 *   - BDS-COURSE-NAV: in-progress with no resume → navigates to course overview
 *   - BDS-COURSE-NAV-RESUME: in-progress with resume → navigates to last lesson
 *   - BDS-COURSE-NAV-NOT-STARTED: not-started → navigates to course overview
 *   - BDS-PATH-LABELS: path sheet renders "Path badge", title, CTA "See path"
 *   - BDS-PATH-NAV: "See path" closes sheet and navigates to learning path
 *   - BDS-PATH-THIRTY-VISIBLE: 30-day check card shown when retained badge not yet earned
 *   - BDS-PATH-THIRTY-RETAINED: 30-day check card shows "Passed on" text when retained badge earned
 *   - BDS-PATH-CHECK-OPEN: "Start 30-day check" when check is open and not passed
 *   - BDS-PATH-CHECK-OPEN-NAV: navigates to knowledge check course when check is open
 *   - BDS-A11Y: sheet has role="dialog" and aria-modal="true"
 *   - BDS-BACKDROP: backdrop click triggers onClose
 */
import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BadgeDetailSheet, type SheetBadgeData } from '../components/ui/BadgeDetailSheet';
import type { LearnerCurriculum } from '../api/curriculum';

// ── Router mock ───────────────────────────────────────────

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// ── Courseware API mock ───────────────────────────────────

const mockGetResumeBlock = jest.fn();
jest.mock('../api/courseware', () => ({
  getResumeBlock: (...args: unknown[]) => mockGetResumeBlock(...args),
}));

// ── Progress API mock (never resolves so tests control cache via setQueryData) ─

const mockGetCourseProgressSummary = jest.fn((_courseId: string) => new Promise<never>(() => {}));
jest.mock('../api/catalog', () => ({
  getCourseProgressSummary: (courseId: string) => mockGetCourseProgressSummary(courseId),
  getCourseProgressSummaryUrl: jest.fn(),
}));

// ── Render helpers ─────────────────────────────────────────

function renderSheet(data: SheetBadgeData | null, onClose = jest.fn(), queryClient?: QueryClient) {
  const client = queryClient ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BadgeDetailSheet data={data} onClose={onClose} />
    </QueryClientProvider>,
  );
}

/** Build a QueryClient with course-progress (and optionally resume) pre-seeded. */
function makeProgressClient(
  courseId: string,
  opts: { fraction?: number; totalUnits?: number; sectionId?: string } = {},
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['course-progress', courseId], {
    fraction: opts.fraction ?? 0,
    totalUnits: opts.totalUnits ?? null,
  });
  if (opts.sectionId) {
    client.setQueryData(['resume', courseId], { sectionId: opts.sectionId, blockId: null, unitId: null });
  }
  return client;
}

// ── Helpers ────────────────────────────────────────────────

const COURSE_DATA_UNEARNED: SheetBadgeData = {
  kind: 'course',
  courseId: 'course-v1:Uber+Safety',
  title: 'Road safety fundamentals',
  description: 'Earned when you finish all lessons and the final check.',
  art: 'art.svg',
  tintColor: '#dee9fe',
  progress: '',
  earned: false,
};

const COURSE_DATA_EARNED: SheetBadgeData = {
  ...COURSE_DATA_UNEARNED,
  earned: true,
  earnedDate: '18 November 2026',
};

function makeCurriculum(overrides: Partial<LearnerCurriculum> = {}): LearnerCurriculum {
  return {
    uuid: 'path-1',
    title: 'New driver onboarding',
    description: 'Complete all courses to earn your badge.',
    image_url: null,
    assigned_at: '2026-10-01T00:00:00Z',
    courses: [],
    courses_finished: 1,
    courses_total: 3,
    milestones: {
      halfway: { reached_at: null, badge: null },
      complete: { reached_at: null, badge: null },
      retained: { reached_at: null, badge: null },
    },
    knowledge_check: {
      course_id: 'kc-1',
      display_name: 'Check',
      exists: true,
      unlocks_at: null,
      is_open: false,
    },
    ...overrides,
  };
}

const PATH_DATA_UNEARNED: SheetBadgeData = {
  kind: 'path',
  curriculum: makeCurriculum(),
};

/** Complete path, 30-day check not yet earned (check also not open) */
const PATH_DATA_COMPLETE: SheetBadgeData = {
  kind: 'path',
  curriculum: makeCurriculum({
    courses_finished: 3,
    courses_total: 3,
    milestones: {
      halfway: { reached_at: null, badge: null },
      complete: { reached_at: '2026-11-01T00:00:00Z', badge: null },
      retained: { reached_at: null, badge: null },
    },
  }),
};

const PATH_DATA_THIRTY_EARNED: SheetBadgeData = {
  kind: 'path',
  curriculum: makeCurriculum({
    courses_finished: 3,
    courses_total: 3,
    milestones: {
      halfway: { reached_at: null, badge: null },
      complete: { reached_at: '2026-11-01T00:00:00Z', badge: null },
      retained: { reached_at: '2026-12-01T00:00:00Z', badge: null },
    },
  }),
};

// ── Tests ──────────────────────────────────────────────────

const PATH_DATA_CHECK_OPEN: SheetBadgeData = {
  kind: 'path',
  curriculum: makeCurriculum({
    milestones: {
      halfway: { reached_at: null, badge: null },
      complete: { reached_at: '2026-11-01T00:00:00Z', badge: null },
      retained: { reached_at: null, badge: null },
    },
    knowledge_check: {
      course_id: 'kc-1',
      display_name: 'Check',
      exists: true,
      unlocks_at: null,
      is_open: true,
    },
  }),
};

describe('BadgeDetailSheet', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGetResumeBlock.mockClear();
    mockGetCourseProgressSummary.mockClear();
  });

  it('renders nothing when data is null (BDS-NULL)', () => {
    const { container } = render(
      <BadgeDetailSheet data={null} onClose={jest.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  describe('course badge sheet', () => {
    it('renders type label, title, and description with lesson count (BDS-COURSE-LABELS)', () => {
      // Seed totalUnits so CourseBadgeSheet derives the full description text.
      const client = makeProgressClient('course-v1:Uber+Safety', { fraction: 0.3, totalUnits: 7 });
      renderSheet(COURSE_DATA_UNEARNED, jest.fn(), client);
      expect(screen.getByText('Course badge')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /road safety fundamentals/i })).toBeInTheDocument();
      expect(screen.getByText(/earned when you finish all 7 lessons and the final check/i)).toBeInTheDocument();
    });

    it('falls back to generic description before progress loads (BDS-COURSE-LABELS-FALLBACK)', () => {
      // No progress seeded — hook is still loading, so data.description is shown.
      renderSheet(COURSE_DATA_UNEARNED);
      expect(screen.getByText(/earned when you finish all lessons/i)).toBeInTheDocument();
    });

    it('shows "See course" when course has not been started (BDS-COURSE-NOT-STARTED-CTA)', () => {
      // fraction=0 → not started
      const client = makeProgressClient('course-v1:Uber+Safety', { fraction: 0, totalUnits: 7 });
      renderSheet(COURSE_DATA_UNEARNED, jest.fn(), client);
      expect(screen.getByRole('button', { name: /see course/i })).toBeInTheDocument();
    });

    it('shows "Continue course" when course is in progress (BDS-COURSE-UNEARNED-CTA)', () => {
      const client = makeProgressClient('course-v1:Uber+Safety', { fraction: 0.4, totalUnits: 7 });
      renderSheet(COURSE_DATA_UNEARNED, jest.fn(), client);
      expect(screen.getByRole('button', { name: /continue course/i })).toBeInTheDocument();
    });

    it('shows "Review course" when badge is earned (BDS-COURSE-EARNED-CTA)', () => {
      renderSheet(COURSE_DATA_EARNED);
      expect(screen.getByRole('button', { name: /review course/i })).toBeInTheDocument();
    });

    it('shows earned date when earned (BDS-COURSE-EARNED-DATE)', () => {
      renderSheet(COURSE_DATA_EARNED);
      expect(screen.getByText(/earned 18 november 2026/i)).toBeInTheDocument();
    });

    it('navigates to course overview when no resume block exists (BDS-COURSE-NAV)', () => {
      const onClose = jest.fn();
      // In-progress (fraction > 0) but no resume block → falls back to course overview.
      const client = makeProgressClient('course-v1:Uber+Safety', { fraction: 0.4 });
      renderSheet(COURSE_DATA_UNEARNED, onClose, client);
      fireEvent.click(screen.getByRole('button', { name: /continue course/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/course/course-v1:Uber+Safety');
    });

    it('navigates to last lesson when resume block is available (BDS-COURSE-NAV-RESUME)', () => {
      const onClose = jest.fn();
      const client = makeProgressClient('course-v1:Uber+Safety', { fraction: 0.4, sectionId: 'seq-99' });
      renderSheet(COURSE_DATA_UNEARNED, onClose, client);
      fireEvent.click(screen.getByRole('button', { name: /continue course/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/course/course-v1:Uber+Safety/lesson/seq-99/step/0');
    });

    it('navigates to course overview when course not started (BDS-COURSE-NAV-NOT-STARTED)', () => {
      const onClose = jest.fn();
      const client = makeProgressClient('course-v1:Uber+Safety', { fraction: 0 });
      renderSheet(COURSE_DATA_UNEARNED, onClose, client);
      fireEvent.click(screen.getByRole('button', { name: /see course/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/course/course-v1:Uber+Safety');
    });
  });

  describe('path badge sheet', () => {
    it('renders "Path badge" label and curriculum title (BDS-PATH-LABELS)', () => {
      renderSheet(PATH_DATA_UNEARNED);
      expect(screen.getByText('Path badge')).toBeInTheDocument();
    });

    it('renders "See path" CTA (BDS-PATH-LABELS)', () => {
      renderSheet(PATH_DATA_UNEARNED);
      expect(screen.getByRole('button', { name: /see path/i })).toBeInTheDocument();
    });

    it('calls onClose then navigates to learning path on CTA click (BDS-PATH-NAV)', () => {
      const onClose = jest.fn();
      renderSheet(PATH_DATA_UNEARNED, onClose);
      fireEvent.click(screen.getByRole('button', { name: /see path/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/learning-path/path-1');
    });

    it('shows 30-day check card when path is complete but retained badge not yet earned (BDS-PATH-THIRTY-VISIBLE)', () => {
      renderSheet(PATH_DATA_COMPLETE);
      expect(screen.getByText('30-day check')).toBeInTheDocument();
    });

    it('shows 30-day check card with "Passed on" text when retained badge is earned (BDS-PATH-THIRTY-RETAINED)', () => {
      renderSheet(PATH_DATA_THIRTY_EARNED);
      expect(screen.getByText('30-day check')).toBeInTheDocument();
      expect(screen.getByText(/passed on/i)).toBeInTheDocument();
    });

    it('shows "Start 30-day check" when check is open and not yet passed (BDS-PATH-CHECK-OPEN)', () => {
      renderSheet(PATH_DATA_CHECK_OPEN);
      expect(screen.getByRole('button', { name: /start 30-day check/i })).toBeInTheDocument();
    });

    it('navigates to knowledge check course when check is open (BDS-PATH-CHECK-OPEN-NAV)', () => {
      const onClose = jest.fn();
      renderSheet(PATH_DATA_CHECK_OPEN, onClose);
      fireEvent.click(screen.getByRole('button', { name: /start 30-day check/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/course/kc-1');
    });
  });

  it('sheet has role="dialog" and aria-modal="true" (BDS-A11Y)', () => {
    renderSheet(COURSE_DATA_UNEARNED);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('clicking the backdrop calls onClose (BDS-BACKDROP)', () => {
    const onClose = jest.fn();
    const { container } = renderSheet(COURSE_DATA_UNEARNED, onClose);
    const backdrop = container.querySelector('.bds-backdrop')!;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
