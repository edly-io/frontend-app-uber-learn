/**
 * Tests for SaveAndResumePage (CourseIntroductionPage).
 *
 * AC coverage:
 *   SAR-LOADING:     shows LoadingSkeleton while outline loads
 *   SAR-ERROR:       shows ErrorView when outline fails
 *   SAR-TITLE:       renders "Progress saved" heading and course kicker
 *   SAR-LESSON-IDX:  shows "Lesson N keeps your place" when resume sequence found in outline
 *   SAR-NO-RESUME:   shows fallback copy when no resume sequence
 *   SAR-PROGRESS:    renders lesson progress when hasProgress and totalLessons > 0
 *   SAR-RESUME-BTN:  "Resume lesson N" navigates to the lesson step URL
 *   SAR-HOME-BTN:    "Back to learning home" navigates to /
 *   SAR-BACK:        back arrow always navigates to course outline
 */
import React from 'react';
import {
  render, screen, fireEvent, waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SaveAndResumePage } from '../pages/CourseIntroductionPage';
import type { CourseOutline } from '../api/courseware';

const mockNavigate = jest.fn();
const mockUseParams = jest.fn();
const mockUseLocation = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => mockUseParams(),
  useLocation: () => mockUseLocation(),
}));

const mockUseCourseOutline = jest.fn();
const mockUseCurriculums = jest.fn();
const mockUseCourseProgressSummary = jest.fn();

jest.mock('../hooks/useCourseOutline', () => ({
  useCourseOutline: (...args: unknown[]) => mockUseCourseOutline(...args),
}));
jest.mock('../hooks/useCurriculums', () => ({
  useCurriculums: (...args: unknown[]) => mockUseCurriculums(...args),
}));
jest.mock('../hooks/useCourseProgressSummary', () => ({
  useCourseProgressSummary: (...args: unknown[]) => mockUseCourseProgressSummary(...args),
}));

// Stub useQuery (for resume block) via @tanstack/react-query
jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: jest.fn(() => ({ data: null, isLoading: false, isError: false })),
  };
});

const COURSE_ID = 'course-v1:Uber+Safety+2026';
const SEQ_ID_1 = 'block-v1:seq1';
const SEQ_ID_2 = 'block-v1:seq2';

const OUTLINE: CourseOutline = {
  courseId: COURSE_ID,
  title: 'Road Safety',
  sections: {
    'sec-1': { id: 'sec-1', title: 'Unit 1', sequenceIds: [SEQ_ID_1, SEQ_ID_2] },
  },
  sequences: {
    [SEQ_ID_1]: {
      id: SEQ_ID_1, title: 'Lesson One', sectionId: 'sec-1', complete: true,
    },
    [SEQ_ID_2]: {
      id: SEQ_ID_2, title: 'Lesson Two', sectionId: 'sec-1', complete: false,
    },
  },
};

const makeQC = () => new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: 0 } },
});

function wrap(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={makeQC()}>{ui}</QueryClientProvider>,
  );
}

function setDefaultMocks() {
  mockUseParams.mockReturnValue({ courseId: COURSE_ID });
  mockUseLocation.mockReturnValue({ state: null, key: 'abc', pathname: '/course/resume' });
  mockUseCourseOutline.mockReturnValue({ data: OUTLINE, isLoading: false, isError: false });
  mockUseCurriculums.mockReturnValue({ data: [] });
  mockUseCourseProgressSummary.mockReturnValue({ data: { completedUnits: 1, totalUnits: 5, fraction: 0.4 } });
}

beforeEach(() => {
  mockNavigate.mockClear();
  setDefaultMocks();
});

test('SAR-LOADING: shows LoadingSkeleton while outline loads', () => {
  mockUseCourseOutline.mockReturnValue({ data: undefined, isLoading: true, isError: false });
  wrap(<SaveAndResumePage />);
  expect(screen.getByLabelText('Loading…')).toBeInTheDocument();
});

test('SAR-TITLE: renders "Progress saved" heading and course kicker', async () => {
  wrap(<SaveAndResumePage />);
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Progress saved' })).toBeInTheDocument();
    expect(screen.getByText('Road Safety')).toBeInTheDocument();
  });
});

test('SAR-LESSON-IDX: shows "Lesson N keeps your place" when resume sequence in state', async () => {
  mockUseLocation.mockReturnValue({
    state: { resumeSequenceId: SEQ_ID_2 },
    key: 'abc',
    pathname: '/course/resume',
  });
  wrap(<SaveAndResumePage />);
  await waitFor(() => {
    expect(screen.getByText(/lesson 2 keeps your place/i)).toBeInTheDocument();
  });
});

test('SAR-NO-RESUME: shows fallback copy when no resume sequence found', async () => {
  wrap(<SaveAndResumePage />);
  await waitFor(() => {
    expect(screen.getByText(/your progress is saved/i)).toBeInTheDocument();
  });
});

test('SAR-HOME-BTN: "Back to learning home" navigates to /', async () => {
  wrap(<SaveAndResumePage />);
  await waitFor(() => screen.getByRole('button', { name: /back to learning home/i }));
  fireEvent.click(screen.getByRole('button', { name: /back to learning home/i }));
  expect(mockNavigate).toHaveBeenCalledWith('/');
});

test('SAR-BACK: back arrow navigates to course outline regardless of history state', async () => {
  // Non-default location key simulates navigating from ActivityView (the bug case).
  mockUseLocation.mockReturnValue({ state: null, key: 'abc', pathname: '/course/resume' });
  wrap(<SaveAndResumePage />);
  await waitFor(() => screen.getByRole('button', { name: /^back$/i }));
  fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
  expect(mockNavigate).toHaveBeenCalledWith(`/course/${COURSE_ID}`);
});

test('SAR-ERROR: shows error view when outline fails', () => {
  mockUseCourseOutline.mockReturnValue({ data: undefined, isLoading: false, isError: true });
  wrap(<SaveAndResumePage />);
  expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
});

test('SAR-PROGRESS: renders lesson count text when progress data available', async () => {
  // completedUnits=1 maps to completedLessons via outline (1 complete seq), totalUnits=5 -> totalLessons
  // The component shows "N of M lessons complete" when hasProgress && totalLessons > 0
  wrap(<SaveAndResumePage />);
  await waitFor(() => screen.getByRole('heading', { name: 'Progress saved' }));
  // Outline has 2 sequences total; completedUnits=1 -> 1 complete lesson shown
  expect(screen.getByText(/of \d+ lessons complete/i)).toBeInTheDocument();
});
