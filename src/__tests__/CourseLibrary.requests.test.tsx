/**
 * The All courses page must read the whole list in ONE request, whatever the number of courses:
 * no per-course outline or progress call (it used to issue 1 + 2N).
 *
 * Strategy: mock the authenticated HTTP client (not the API module) and count the calls.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CourseLibrary } from '../pages/CourseLibrary';

const LMS = 'http://lms.test';
const mockGet = jest.fn();

jest.mock('@edx/frontend-platform', () => ({
  getConfig: () => ({ LMS_BASE_URL: 'http://lms.test' }),
}));
jest.mock('@edx/frontend-platform/auth', () => ({
  getAuthenticatedHttpClient: () => ({ get: mockGet }),
  getAuthenticatedUser: () => ({ username: 'driver' }),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../hooks/useCurriculums', () => ({
  useCurriculums: () => ({ data: [] }),
}));

const row = (n: number) => ({
  course_id: `course-v1:uber+C${n}+2026`,
  title: `Course ${n}`,
  image_url: null,
  start: null,
  end: null,
  lesson_count: 3,
  completed_lessons: 1,
  progress: 0.3,
  next_lesson: { sequence_key: `block-v1:seq${n}`, title: `Lesson ${n}` },
  status: 'in_progress',
  curriculum: null,
  last_activity: null,
  points: 10,
});

const makeQC = () => new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: 0 } },
});

beforeEach(() => {
  mockGet.mockReset();
  mockNavigate.mockClear();
});

it('issues one request for five courses and no per-course call', async () => {
  mockGet.mockResolvedValue({ data: [1, 2, 3, 4, 5].map(row) });

  render(
    <QueryClientProvider client={makeQC()}>
      <CourseLibrary />
    </QueryClientProvider>,
  );

  await waitFor(() => expect(screen.getByText('Course 1')).toBeInTheDocument());
  expect(screen.getByText('Course 5')).toBeInTheDocument();

  expect(mockGet).toHaveBeenCalledTimes(1);
  expect(mockGet).toHaveBeenCalledWith(`${LMS}/api/uber/learn/v1/courses/`);
});
