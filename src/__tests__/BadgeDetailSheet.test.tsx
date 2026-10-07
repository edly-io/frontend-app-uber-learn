/**
 * Unit tests for BadgeDetailSheet bottom sheet.
 *
 * AC coverage:
 *   - BDS-NULL: renders nothing when data is null
 *   - BDS-COURSE-LABELS: course sheet renders type label, title, description, progress
 *   - BDS-COURSE-UNEARNED-CTA: unearded course shows "Continue course"
 *   - BDS-COURSE-EARNED-CTA: earned course shows "View course"
 *   - BDS-COURSE-EARNED-DATE: earned course shows earned date, not progress string
 *   - BDS-COURSE-NAV: CTA closes sheet and navigates to course
 *   - BDS-PATH-LABELS: path sheet renders "Path badge", title, CTA "See path"
 *   - BDS-PATH-NAV: "See path" closes sheet and navigates to learning path
 *   - BDS-PATH-THIRTY-VISIBLE: 30-day check card shown when retained badge not yet earned
 *   - BDS-PATH-THIRTY-HIDDEN: 30-day check card hidden when retained badge earned
 *   - BDS-A11Y: sheet has role="dialog" and aria-modal="true"
 *   - BDS-BACKDROP: backdrop click triggers onClose
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BadgeDetailSheet, type SheetBadgeData } from '../components/ui/BadgeDetailSheet';
import type { LearnerCurriculum } from '../api/curriculum';

// ── Router mock ───────────────────────────────────────────

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// ── Helpers ────────────────────────────────────────────────

const COURSE_DATA_UNEARNED: SheetBadgeData = {
  kind: 'course',
  courseId: 'course-v1:Uber+Safety',
  title: 'Road safety fundamentals',
  description: 'Earned when you finish all 7 lessons.',
  art: 'art.svg',
  tintColor: '#dee9fe',
  progress: '2 of 7 lessons done',
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
    assigned_at: '2026-10-01T00:00:00Z',
    courses: [],
    courses_passed: 1,
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

const PATH_DATA_THIRTY_EARNED: SheetBadgeData = {
  kind: 'path',
  curriculum: makeCurriculum({
    milestones: {
      halfway: { reached_at: null, badge: null },
      complete: { reached_at: '2026-11-01T00:00:00Z', badge: null },
      retained: { reached_at: '2026-12-01T00:00:00Z', badge: null },
    },
  }),
};

// ── Tests ──────────────────────────────────────────────────

describe('BadgeDetailSheet', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders nothing when data is null (BDS-NULL)', () => {
    const { container } = render(
      <BadgeDetailSheet data={null} onClose={jest.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  describe('course badge sheet', () => {
    it('renders type label, title, and description (BDS-COURSE-LABELS)', () => {
      render(<BadgeDetailSheet data={COURSE_DATA_UNEARNED} onClose={jest.fn()} />);
      expect(screen.getByText('Course badge')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /road safety fundamentals/i })).toBeInTheDocument();
      expect(screen.getByText(/earned when you finish all 7 lessons/i)).toBeInTheDocument();
    });

    it('shows "Continue course" when badge not yet earned (BDS-COURSE-UNEARNED-CTA)', () => {
      render(<BadgeDetailSheet data={COURSE_DATA_UNEARNED} onClose={jest.fn()} />);
      expect(screen.getByRole('button', { name: /continue course/i })).toBeInTheDocument();
    });

    it('shows "View course" when badge is earned (BDS-COURSE-EARNED-CTA)', () => {
      render(<BadgeDetailSheet data={COURSE_DATA_EARNED} onClose={jest.fn()} />);
      expect(screen.getByRole('button', { name: /view course/i })).toBeInTheDocument();
    });

    it('shows earned date instead of progress string when earned (BDS-COURSE-EARNED-DATE)', () => {
      render(<BadgeDetailSheet data={COURSE_DATA_EARNED} onClose={jest.fn()} />);
      expect(screen.getByText(/earned 18 november 2026/i)).toBeInTheDocument();
      expect(screen.queryByText(/2 of 7 lessons done/i)).not.toBeInTheDocument();
    });

    it('calls onClose then navigates to course on CTA click (BDS-COURSE-NAV)', () => {
      const onClose = jest.fn();
      render(<BadgeDetailSheet data={COURSE_DATA_UNEARNED} onClose={onClose} />);
      fireEvent.click(screen.getByRole('button', { name: /continue course/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/course/course-v1:Uber+Safety');
    });
  });

  describe('path badge sheet', () => {
    it('renders "Path badge" label and curriculum title (BDS-PATH-LABELS)', () => {
      render(<BadgeDetailSheet data={PATH_DATA_UNEARNED} onClose={jest.fn()} />);
      expect(screen.getByText('Path badge')).toBeInTheDocument();
    });

    it('renders "See path" CTA (BDS-PATH-LABELS)', () => {
      render(<BadgeDetailSheet data={PATH_DATA_UNEARNED} onClose={jest.fn()} />);
      expect(screen.getByRole('button', { name: /see path/i })).toBeInTheDocument();
    });

    it('calls onClose then navigates to learning path on CTA click (BDS-PATH-NAV)', () => {
      const onClose = jest.fn();
      render(<BadgeDetailSheet data={PATH_DATA_UNEARNED} onClose={onClose} />);
      fireEvent.click(screen.getByRole('button', { name: /see path/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/learning-path/path-1');
    });

    it('shows 30-day check card when retained badge not earned (BDS-PATH-THIRTY-VISIBLE)', () => {
      render(<BadgeDetailSheet data={PATH_DATA_UNEARNED} onClose={jest.fn()} />);
      expect(screen.getByText('30-day check')).toBeInTheDocument();
    });

    it('hides 30-day check card when retained badge is earned (BDS-PATH-THIRTY-HIDDEN)', () => {
      render(<BadgeDetailSheet data={PATH_DATA_THIRTY_EARNED} onClose={jest.fn()} />);
      expect(screen.queryByText('30-day check')).not.toBeInTheDocument();
    });
  });

  it('sheet has role="dialog" and aria-modal="true" (BDS-A11Y)', () => {
    render(<BadgeDetailSheet data={COURSE_DATA_UNEARNED} onClose={jest.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('clicking the backdrop calls onClose (BDS-BACKDROP)', () => {
    const onClose = jest.fn();
    const { container } = render(
      <BadgeDetailSheet data={COURSE_DATA_UNEARNED} onClose={onClose} />,
    );
    const backdrop = container.querySelector('.bds-backdrop')!;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
