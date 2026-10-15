/**
 * Unit tests for SearchPage.
 *
 * AC coverage:
 *   - SP-FOCUS: input auto-focuses on mount
 *   - SP-PRE-TOPICS: topic chips NOT shown
 *   - SP-PRE-NO-RECENTS: "Recent" section absent when localStorage empty
 *   - SP-RECENT-SHOWN: recent search saved to localStorage after submit
 *   - SP-RECENT-REMOVE: clicking remove dismisses a recent search
 *   - SP-RESULTS: submitting shows matching courses from backend
 *   - SP-RESULT-NAV: clicking a course result navigates to /course/:id
 *   - SP-LP-RESULTS: submitting shows matching learning paths from backend
 *   - SP-LP-RESULT-NAV: clicking a learning path result navigates to /learning-path/:uuid
 *   - SP-LP-SECTION: "Learning paths" section shown before "Courses"
 *   - SP-NO-RESULTS: zero-match search shows no-results message
 *   - SP-CLEAR: pressing the clear button resets query and results
 *   - SP-TOPIC-CLICK: topic chip click disabled (chips commented out)
 *   - SP-ENTER: pressing Enter submits the query
 *   - SP-BACK: back button calls navigate(-1)
 */
import React from 'react';
import {
  render, screen, fireEvent, waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SearchPage } from '../pages/SearchPage';
import * as curriculumApi from '../api/curriculum';

// ── Mocks ──────────────────────────────────────────────────

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({
    key: 'test-key',
    pathname: '/',
    search: '',
    hash: '',
    state: null,
  }),
}));

jest.mock('../api/curriculum');

// ── Test data ──────────────────────────────────────────────

const CURRICULUM_MILESTONES = {
  complete: { reached_at: null, badge: null },
  retained: { reached_at: null, badge: null },
} as const;

const CURRICULUM_KC = {
  course_id: 'course-v1:Uber+KC',
  display_name: null,
  exists: false,
  unlocks_at: null,
  is_open: false,
} as const;

const CURRICULUM_SAFETY: curriculumApi.LearnerCurriculum = {
  uuid: 'path-1',
  title: 'Driver safety program',
  description: 'Complete safety curriculum',
  image_url: null,
  assigned_at: '2024-01-01T00:00:00Z',
  courses_total: 3,
  courses_finished: 1,
  courses: [],
  milestones: CURRICULUM_MILESTONES,
  knowledge_check: CURRICULUM_KC,
};

const COURSE_SAFETY: curriculumApi.SearchCourseResult = {
  course_id: 'course-v1:Uber+Safety',
  display_name: 'Road safety fundamentals',
  org: 'Uber',
  image_url: null,
};

const COURSE_REGIONAL: curriculumApi.SearchCourseResult = {
  course_id: 'course-v1:Uber+Driving',
  display_name: 'Regional safety training',
  org: 'Uber',
  image_url: null,
};

const COURSE_TEEN: curriculumApi.SearchCourseResult = {
  course_id: 'course-v1:Uber+Teen',
  display_name: 'Teen rides',
  org: 'Uber',
  image_url: null,
};

const EMPTY_RESPONSE: curriculumApi.SearchResponse = {
  query: 'zzznomatch',
  curriculums: [],
  courses: [],
};

// ── Helpers ────────────────────────────────────────────────

const makeQC = () => new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderPage = (qc = makeQC()) => render(
  <QueryClientProvider client={qc}><SearchPage /></QueryClientProvider>,
);

const STORAGE_KEY = 'uber-learn-recent-searches';

// ── Tests ──────────────────────────────────────────────────

describe('SearchPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    localStorage.clear();
    (curriculumApi.searchLearnerContent as jest.Mock).mockResolvedValue({
      query: '',
      curriculums: [],
      courses: [],
    });
  });

  it('auto-focuses the search input on mount (SP-FOCUS)', async () => {
    renderPage();
    await waitFor(() => {
      expect(document.activeElement?.tagName).toBe('INPUT');
    });
  });

  it('search input has correct placeholder and aria-label (SP-PLACEHOLDER)', () => {
    renderPage();
    const input = screen.getByRole('searchbox');
    expect(input).toHaveAttribute('placeholder', 'Search paths and courses');
    expect(input).toHaveAttribute('aria-label', 'Search paths and courses');
  });

  it('does NOT show topic chips before any search (SP-PRE-TOPICS)', () => {
    renderPage();
    expect(screen.queryByRole('button', { name: 'Safety' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Driving' })).not.toBeInTheDocument();
  });

  it('hides "Recent" section when localStorage is empty (SP-PRE-NO-RECENTS)', () => {
    renderPage();
    expect(screen.queryByText('Recent')).not.toBeInTheDocument();
  });

  it('saves recent search to localStorage after submitting (SP-RECENT-SHOWN)', async () => {
    renderPage();
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'safety' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[];
      expect(saved).toContain('safety');
    });
  });

  it('removes a recent search on dismiss click (SP-RECENT-REMOVE)', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['teen rides', 'boundaries']));
    renderPage();
    const removeBtn = screen.getByRole('button', { name: /remove teen rides/i });
    fireEvent.click(removeBtn);
    expect(screen.queryByText('teen rides')).not.toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[];
    expect(saved).not.toContain('teen rides');
  });

  it('shows matching courses returned by the backend (SP-RESULTS)', async () => {
    (curriculumApi.searchLearnerContent as jest.Mock).mockResolvedValue({
      query: 'safety',
      curriculums: [],
      courses: [COURSE_SAFETY, COURSE_REGIONAL],
    });
    renderPage();
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'safety' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText('Road safety fundamentals')).toBeInTheDocument();
      expect(screen.getByText('Regional safety training')).toBeInTheDocument();
    });
    expect(screen.queryByText('Teen rides')).not.toBeInTheDocument();
  });

  it('navigates to course page when a course result is clicked (SP-RESULT-NAV)', async () => {
    (curriculumApi.searchLearnerContent as jest.Mock).mockResolvedValue({
      query: 'safety',
      curriculums: [],
      courses: [COURSE_SAFETY],
    });
    renderPage();
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'safety' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => screen.getByText('Road safety fundamentals'));
    fireEvent.click(screen.getByRole('button', { name: /road safety fundamentals/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/course/course-v1:Uber+Safety');
  });

  it('shows matching learning paths in "Learning paths" section (SP-LP-RESULTS)', async () => {
    (curriculumApi.searchLearnerContent as jest.Mock).mockResolvedValue({
      query: 'safety',
      curriculums: [CURRICULUM_SAFETY],
      courses: [],
    });
    renderPage();
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'safety' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText('Driver safety program')).toBeInTheDocument();
      expect(screen.getByText('Learning paths')).toBeInTheDocument();
    });
  });

  it('navigates to learning path page when a curriculum result is clicked (SP-LP-RESULT-NAV)', async () => {
    (curriculumApi.searchLearnerContent as jest.Mock).mockResolvedValue({
      query: 'safety',
      curriculums: [CURRICULUM_SAFETY],
      courses: [],
    });
    renderPage();
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'safety' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => screen.getByText('Driver safety program'));
    fireEvent.click(screen.getByRole('button', { name: /driver safety program/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/learning-path/path-1');
  });

  it('"Learning paths" section appears before "Courses" section (SP-LP-SECTION)', async () => {
    (curriculumApi.searchLearnerContent as jest.Mock).mockResolvedValue({
      query: 'safety',
      curriculums: [CURRICULUM_SAFETY],
      courses: [COURSE_SAFETY],
    });
    renderPage();
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'safety' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText('Learning paths')).toBeInTheDocument();
      expect(screen.getByText('Courses')).toBeInTheDocument();
    });
    const headings = screen.getAllByRole('heading', { level: 2 });
    const sectionHeadings = headings.filter(
      (h) => h.textContent === 'Learning paths' || h.textContent === 'Courses',
    );
    expect(sectionHeadings[0]).toHaveTextContent('Learning paths');
    expect(sectionHeadings[1]).toHaveTextContent('Courses');
  });

  it('shows no-results message when backend returns empty (SP-NO-RESULTS)', async () => {
    (curriculumApi.searchLearnerContent as jest.Mock).mockResolvedValue(EMPTY_RESPONSE);
    renderPage();
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'zzznomatch' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText(/no results for/i)).toBeInTheDocument();
    });
  });

  it('clears query and results on clear button click (SP-CLEAR)', async () => {
    (curriculumApi.searchLearnerContent as jest.Mock).mockResolvedValue({
      query: 'safety',
      curriculums: [],
      courses: [COURSE_SAFETY],
    });
    renderPage();
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'safety' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => screen.getByText('Road safety fundamentals'));
    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(screen.queryByText('Road safety fundamentals')).not.toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('does NOT render topic chip buttons (SP-TOPIC-CLICK)', () => {
    renderPage();
    expect(screen.queryByRole('button', { name: 'Safety' })).not.toBeInTheDocument();
  });

  it('submits on Enter key press (SP-ENTER)', async () => {
    (curriculumApi.searchLearnerContent as jest.Mock).mockResolvedValue({
      query: 'teen',
      curriculums: [],
      courses: [COURSE_TEEN],
    });
    renderPage();
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'teen' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText('Teen rides')).toBeInTheDocument();
    });
  });

  it('back button calls navigate(-1) (SP-BACK)', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /go back/i }));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
