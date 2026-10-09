/**
 * Unit tests for the BadgesTab within LearningProgress.
 *
 * Strategy: render LearningProgress, switch to the "Badges" tab, then
 * assert against the BadgesTab UI. All API hooks are mocked at module level
 * so we control the data without HTTP calls.
 *
 * AC coverage:
 *   - BT-HERO-COUNT: hero shows total badge count from useBadges
 *   - BT-HERO-SINGULAR: "badge earned" singular label for count=1
 *   - BT-HERO-PLURAL: "badges earned" plural label for count≠1
 *   - BT-PATHS-SHOWN: "Learning paths" section renders when curriculums provided
 *   - BT-PATHS-HIDDEN: "Learning paths" section absent when curriculums is empty
 *   - BT-COURSES-SHOWN: "Courses" section renders when enrolled courses exist
 *   - BT-COURSES-HIDDEN: "Courses" section absent when no courses
 *   - BT-SHEET-OPENS: tapping a path badge item opens the detail sheet
 *   - BT-SHEET-CLOSES: tapping backdrop closes the sheet
 *   - BT-NEW-CHIP: unseen badge award gets "New" chip
 */
import React from 'react';
import {
  render, screen, fireEvent, waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LearningProgress } from '../pages/LearningProgress';
import type { LearnerCurriculum } from '../api/curriculum';
import type { EnrolledCourse } from '../api/catalog';

// ── Module mocks ──────────────────────────────────────────

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: null, pathname: '/progress' }),
}));

// Stub every hook/api used by LearningProgress so the render is self-contained

jest.mock('../api/catalog', () => ({
  getEnrolledCourses: jest.fn().mockResolvedValue([]),
}));
jest.mock('../api/progress', () => ({
  getProgress: jest.fn().mockResolvedValue(null),
}));
jest.mock('../hooks/useProgress', () => ({
  useProgress: jest.fn().mockReturnValue({ data: null }),
}));
jest.mock('../hooks/useCourseOutline', () => ({
  useCourseOutline: jest.fn().mockReturnValue({ data: null }),
}));
jest.mock('../hooks/useGamification', () => ({
  useGamification: jest.fn().mockReturnValue({ data: null }),
}));
jest.mock('../hooks/useLeaderboard', () => ({
  useLeaderboard: jest.fn().mockReturnValue({ data: null }),
}));

// These two we override per test
const mockUseCurriculums = jest.fn();
const mockUseBadges = jest.fn();

jest.mock('../hooks/useCurriculums', () => ({
  useCurriculums: (...args: unknown[]) => mockUseCurriculums(...args),
}));
jest.mock('../hooks/useBadges', () => ({
  useBadges: (...args: unknown[]) => mockUseBadges(...args),
}));

// ── Test data ──────────────────────────────────────────────

function makeCurriculum(overrides: Partial<LearnerCurriculum> = {}): LearnerCurriculum {
  return {
    uuid: 'c-1',
    title: 'New driver onboarding',
    description: '',
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
      course_id: 'kc-1', display_name: 'Check', exists: true, unlocks_at: null, is_open: false,
    },
    ...overrides,
  };
}

const COURSE: EnrolledCourse = {
  courseId: 'course-v1:Uber+Safety',
  title: 'Road safety fundamentals',
  imageUrl: null, courseStart: null, courseEnd: null, isActive: true,
};

const BADGE_PAGE_EMPTY = { count: 0, next: null, previous: null, results: [] };
const BADGE_PAGE_ONE = {
  count: 1, next: null, previous: null,
  results: [{
    id: 'award-1', awarded_at: '2026-11-01T00:00:00Z', seen: false,
    badge: { uuid: 'b-1', title: 'Road ready', description: 'Done.', image_url: null },
    source: { type: 'course' as const, course_id: 'course-v1:Uber+Safety', display_name: 'Road safety' },
  }],
};
const BADGE_PAGE_TWO = { ...BADGE_PAGE_ONE, count: 2 };

// ── Helpers ────────────────────────────────────────────────

const makeQC = () => new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderProgress = (qc = makeQC()) => render(
  <QueryClientProvider client={qc}><LearningProgress /></QueryClientProvider>,
);

const switchToBadgesTab = () => {
  fireEvent.click(screen.getByRole('tab', { name: /badges/i }));
};

// ── Tests ──────────────────────────────────────────────────

describe('BadgesTab inside LearningProgress', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockUseBadges.mockReturnValue({ data: BADGE_PAGE_EMPTY });
    mockUseCurriculums.mockReturnValue({ data: [] });
    // stub catalog for the parent query
    const catalogMod = jest.requireMock('../api/catalog') as { getEnrolledCourses: jest.Mock };
    catalogMod.getEnrolledCourses.mockResolvedValue([]);
  });

  it('shows total badge count of 0 in hero (BT-HERO-COUNT)', async () => {
    renderProgress();
    switchToBadgesTab();
    await waitFor(() => {
      const hero = screen.getByText('0');
      expect(hero).toBeInTheDocument();
    });
    expect(screen.getByText('badges earned')).toBeInTheDocument();
  });

  it('shows "badge earned" (singular) when count is 1 (BT-HERO-SINGULAR)', async () => {
    mockUseBadges.mockReturnValue({ data: BADGE_PAGE_ONE });
    renderProgress();
    switchToBadgesTab();
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('badge earned')).toBeInTheDocument();
    });
  });

  it('shows "badges earned" (plural) when count is 2 (BT-HERO-PLURAL)', async () => {
    mockUseBadges.mockReturnValue({ data: BADGE_PAGE_TWO });
    renderProgress();
    switchToBadgesTab();
    await waitFor(() => {
      expect(screen.getByText('badges earned')).toBeInTheDocument();
    });
  });

  it('renders "Learning paths" section when curriculums provided (BT-PATHS-SHOWN)', async () => {
    mockUseCurriculums.mockReturnValue({ data: [makeCurriculum()] });
    renderProgress();
    switchToBadgesTab();
    await waitFor(() => {
      expect(screen.getByText('Learning paths')).toBeInTheDocument();
      expect(screen.getByText('New driver onboarding')).toBeInTheDocument();
    });
  });

  it('hides "Learning paths" section when curriculums is empty (BT-PATHS-HIDDEN)', async () => {
    mockUseCurriculums.mockReturnValue({ data: [] });
    renderProgress();
    switchToBadgesTab();
    await waitFor(() => {
      expect(screen.queryByText('Learning paths')).not.toBeInTheDocument();
    });
  });

  it('renders "Courses" section when enrolled courses exist (BT-COURSES-SHOWN)', async () => {
    const catalogMod = jest.requireMock('../api/catalog') as { getEnrolledCourses: jest.Mock };
    catalogMod.getEnrolledCourses.mockResolvedValue([COURSE]);
    renderProgress();
    switchToBadgesTab();
    await waitFor(() => {
      expect(screen.getByText('Courses')).toBeInTheDocument();
    });
  });

  it('hides "Courses" section when no enrolled courses (BT-COURSES-HIDDEN)', async () => {
    const catalogMod = jest.requireMock('../api/catalog') as { getEnrolledCourses: jest.Mock };
    catalogMod.getEnrolledCourses.mockResolvedValue([]);
    renderProgress();
    switchToBadgesTab();
    await waitFor(() => {
      expect(screen.queryByText('Courses')).not.toBeInTheDocument();
    });
  });

  it('opens the detail sheet when a path badge item is tapped (BT-SHEET-OPENS)', async () => {
    mockUseCurriculums.mockReturnValue({ data: [makeCurriculum()] });
    renderProgress();
    switchToBadgesTab();
    await waitFor(() => screen.getByText('New driver onboarding'));
    fireEvent.click(screen.getByRole('button', { name: /new driver onboarding/i }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Path badge')).toBeInTheDocument();
    });
  });

  it('closes the sheet when backdrop is clicked (BT-SHEET-CLOSES)', async () => {
    mockUseCurriculums.mockReturnValue({ data: [makeCurriculum()] });
    const { container } = renderProgress();
    switchToBadgesTab();
    await waitFor(() => screen.getByText('New driver onboarding'));
    fireEvent.click(screen.getByRole('button', { name: /new driver onboarding/i }));
    await waitFor(() => screen.getByRole('dialog'));
    const backdrop = container.querySelector('.bds-backdrop')!;
    fireEvent.click(backdrop);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('shows "New" chip on unseen badge award (BT-NEW-CHIP)', async () => {
    const catalogMod = jest.requireMock('../api/catalog') as { getEnrolledCourses: jest.Mock };
    catalogMod.getEnrolledCourses.mockResolvedValue([COURSE]);
    mockUseBadges.mockReturnValue({ data: BADGE_PAGE_ONE }); // seen: false
    renderProgress();
    switchToBadgesTab();
    await waitFor(() => {
      expect(screen.getByText('New')).toBeInTheDocument();
    });
  });
});
