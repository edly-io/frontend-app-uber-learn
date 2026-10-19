/**
 * Tests for LearningPathView page.
 *
 * AC coverage:
 *   LPV-LOADING:    shows LoadingSkeleton while curricula load
 *   LPV-ERROR:      shows error view with retry when curricula fail
 *   LPV-NOT-FOUND:  shows error view when curriculumId doesn't match any curriculum
 *   LPV-RENDERS:    renders curriculum title, course list, and CTA
 *   LPV-CTA-START:  "Start first course" CTA when no courses finished
 *   LPV-CTA-CONTINUE: "Continue" CTA when some courses finished
 *   LPV-CTA-HOME:   "Back to home" CTA when path is complete (no check)
 *   LPV-CTA-CHECK:  "Start check" CTA when check is open
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { LearnerCurriculum } from '../api/curriculum';
import { LearningPathView } from '../pages/LearningPathView';

// ── Router + hook mocks ──────────────────────────────────────

const mockNavigate = jest.fn();
const mockParams = { curriculumId: 'curr-abc' };

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
  useLocation: () => ({ state: null, pathname: '/learning-path/curr-abc' }),
}));

const mockUseCurriculums = jest.fn();
jest.mock('../hooks/useCurriculums', () => ({
  useCurriculums: () => mockUseCurriculums(),
}));

// useQueries (for outline fetches) — default to empty results
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueries: () => [],
}));

// ── Fixtures ─────────────────────────────────────────────────

const COURSE_A = {
  course_id: 'course-v1:Uber+A+2026',
  display_name: 'Course A',
  exists: true,
  position: 0,
  finished: false,
  description: null,
  image_url: null,
};

const COURSE_B = {
  course_id: 'course-v1:Uber+B+2026',
  display_name: 'Course B',
  exists: true,
  position: 1,
  finished: false,
  description: null,
  image_url: null,
};

function makeCurriculum(overrides: Partial<LearnerCurriculum> = {}): LearnerCurriculum {
  return {
    uuid: 'curr-abc',
    title: 'New Driver Onboarding',
    description: '',
    image_url: null,
    assigned_at: '2026-01-01T00:00:00Z',
    courses: [COURSE_A, COURSE_B],
    courses_finished: 0,
    courses_total: 2,
    milestones: {
      complete: { reached_at: null, badge: null },
      retained: { reached_at: null, badge: null },
    },
    knowledge_check: {
      course_id: 'course-v1:Uber+KC+2026',
      display_name: 'Knowledge check',
      exists: true,
      unlocks_at: null,
      is_open: false,
    },
    ...overrides,
  };
}

// ── Render helper ─────────────────────────────────────────────

const makeQC = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

function wrap(ui: React.ReactElement) {
  return render(<QueryClientProvider client={makeQC()}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mockNavigate.mockClear();
  mockUseCurriculums.mockReturnValue({ data: [makeCurriculum()], isLoading: false, isError: false });
});

// ── Tests ─────────────────────────────────────────────────────

describe('LearningPathView', () => {
  it('LPV-LOADING: shows LoadingSkeleton while curricula load', () => {
    mockUseCurriculums.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    wrap(<LearningPathView />);
    expect(screen.getByLabelText('Loading…')).toBeInTheDocument();
  });

  it('LPV-ERROR: shows error view with retry when curricula fail', () => {
    mockUseCurriculums.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: jest.fn() });
    wrap(<LearningPathView />);
    expect(screen.getByText(/could not load learning path/i)).toBeInTheDocument();
  });

  it('LPV-NOT-FOUND: shows error view when curriculumId has no match', () => {
    mockUseCurriculums.mockReturnValue({ data: [], isLoading: false, isError: false });
    wrap(<LearningPathView />);
    expect(screen.getByText(/learning path not found/i)).toBeInTheDocument();
  });

  it('LPV-RENDERS: renders curriculum title and course names', () => {
    wrap(<LearningPathView />);
    expect(screen.getByText('New Driver Onboarding')).toBeInTheDocument();
    expect(screen.getByText('Course A')).toBeInTheDocument();
    expect(screen.getByText('Course B')).toBeInTheDocument();
  });

  it('LPV-CTA-START: shows start CTA when no courses finished', () => {
    wrap(<LearningPathView />);
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();
  });

  it('LPV-CTA-CONTINUE: shows continue CTA when some courses are finished', () => {
    mockUseCurriculums.mockReturnValue({
      data: [makeCurriculum({ courses_finished: 1, courses: [{ ...COURSE_A, finished: true }, COURSE_B] })],
      isLoading: false,
      isError: false,
    });
    wrap(<LearningPathView />);
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  it('LPV-CTA-HOME: shows back-to-home CTA when path complete and retained', () => {
    mockUseCurriculums.mockReturnValue({
      data: [makeCurriculum({
        courses_finished: 2,
        courses: [{ ...COURSE_A, finished: true }, { ...COURSE_B, finished: true }],
        milestones: {
          complete: { reached_at: '2026-01-10T00:00:00Z', badge: null },
          retained: { reached_at: '2026-02-10T00:00:00Z', badge: null },
        },
      })],
      isLoading: false,
      isError: false,
    });
    wrap(<LearningPathView />);
    const btn = screen.getByRole('button', { name: /back to learning home/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('LPV-CTA-CHECK: shows start check CTA when check is open', () => {
    mockUseCurriculums.mockReturnValue({
      data: [makeCurriculum({
        courses_finished: 2,
        courses: [{ ...COURSE_A, finished: true }, { ...COURSE_B, finished: true }],
        milestones: {
          complete: { reached_at: '2026-01-10T00:00:00Z', badge: null },
          retained: { reached_at: null, badge: null },
        },
        knowledge_check: {
          course_id: 'course-v1:Uber+KC+2026',
          display_name: 'Knowledge check',
          exists: true,
          unlocks_at: null,
          is_open: true,
        },
      })],
      isLoading: false,
      isError: false,
    });
    wrap(<LearningPathView />);
    expect(screen.getByRole('button', { name: /knowledge check/i })).toBeInTheDocument();
  });
});
