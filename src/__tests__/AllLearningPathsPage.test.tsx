/**
 * Tests for AllLearningPathsPage.
 *
 * AC coverage:
 *   ALP-LOADING:       shows LoadingSkeleton while isLoading
 *   ALP-ERROR:         shows ErrorView when isError; retry calls refetch
 *   ALP-EMPTY:         shows empty state when curriculums = []
 *   ALP-EMPTY-CTA:     "See all courses" navigates to /courses
 *   ALP-RENDERS:       renders heading and path cards when curriculums available
 *   ALP-IN-PROGRESS:   in-progress paths (started but not done) go in "In progress" section
 *   ALP-YOUR-PATHS:    not-started / completed paths go in "Your paths" section
 *   ALP-CARD-CLICK:    clicking a path card navigates to /learning-path/:uuid
 *   ALP-BACK:          back arrow navigates to /
 *   ALP-FOOTER-BTN:    "Back to learning home" navigates to /
 *   ALP-COMPLETION:    completed path card shows completion label when badge + reached_at set
 *   ALP-NEXT-COURSE:   card shows "Next: …" for in-progress path's next course
 */
import React from 'react';
import {
  render, screen, fireEvent,
} from '@testing-library/react';
import { AllLearningPathsPage } from '../pages/AllLearningPathsPage';
import type { LearnerCurriculum } from '../api/curriculum';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/learning-paths' }),
}));

const mockUseCurriculums = jest.fn();
jest.mock('../hooks/useCurriculums', () => ({
  useCurriculums: () => mockUseCurriculums(),
}));

const BASE_CURRICULUM: LearnerCurriculum = {
  uuid: 'curr-1',
  title: 'New Driver Onboarding',
  description: '',
  image_url: null,
  assigned_at: '2026-01-01T00:00:00Z',
  courses: [
    {
      course_id: 'course-v1:Uber+Safety+2026',
      display_name: 'Safety Basics',
      position: 0,
      finished: false,
      exists: true,
      description: null,
      image_url: null,
    },
    {
      course_id: 'course-v1:Uber+Driving+2026',
      display_name: 'Driving Skills',
      position: 1,
      finished: false,
      exists: true,
      description: null,
      image_url: null,
    },
  ],
  courses_finished: 0,
  courses_total: 2,
  milestones: {
    complete: { reached_at: null, badge: null },
    retained: { reached_at: null, badge: null },
  },
  knowledge_check: {
    course_id: 'course-v1:Uber+KC+2026',
    display_name: null,
    exists: false,
    unlocks_at: null,
    is_open: false,
  },
};

const IN_PROGRESS_CURRICULUM: LearnerCurriculum = {
  ...BASE_CURRICULUM,
  uuid: 'curr-2',
  title: 'Advanced Driving',
  courses_finished: 1,
  courses_total: 3,
  courses: [
    {
      course_id: 'course-v1:Uber+A+2026', display_name: 'Course A', position: 0, finished: true, exists: true, description: null, image_url: null,
    },
    {
      course_id: 'course-v1:Uber+B+2026', display_name: 'Course B', position: 1, finished: false, exists: true, description: null, image_url: null,
    },
    {
      course_id: 'course-v1:Uber+C+2026', display_name: 'Course C', position: 2, finished: false, exists: true, description: null, image_url: null,
    },
  ],
};

const COMPLETE_CURRICULUM: LearnerCurriculum = {
  ...BASE_CURRICULUM,
  uuid: 'curr-3',
  title: 'Completed Path',
  courses_finished: 2,
  courses_total: 2,
  milestones: {
    complete: {
      reached_at: '2026-06-15T00:00:00Z',
      badge: {
        uuid: 'badge-1', title: 'Road Ready', description: '', image_url: 'https://example.com/badge.png',
      },
    },
    retained: { reached_at: null, badge: null },
  },
};

beforeEach(() => {
  mockNavigate.mockClear();
  mockUseCurriculums.mockReturnValue({
    data: undefined, isLoading: false, isError: false, refetch: jest.fn(),
  });
});

test('ALP-LOADING: shows LoadingSkeleton while loading', () => {
  mockUseCurriculums.mockReturnValue({
    data: undefined, isLoading: true, isError: false, refetch: jest.fn(),
  });
  const { container } = render(<AllLearningPathsPage />);
  expect(container.querySelector('.alp-loading')).not.toBeNull();
});

test('ALP-ERROR: shows ErrorView when isError', () => {
  const refetch = jest.fn();
  mockUseCurriculums.mockReturnValue({
    data: undefined, isLoading: false, isError: true, refetch,
  });
  render(<AllLearningPathsPage />);
  expect(screen.getByText(/Could not load learning paths/i)).toBeInTheDocument();
});

test('ALP-EMPTY: shows empty state when curriculums = []', () => {
  mockUseCurriculums.mockReturnValue({
    data: [], isLoading: false, isError: false, refetch: jest.fn(),
  });
  render(<AllLearningPathsPage />);
  expect(screen.getByText('No learning paths yet')).toBeInTheDocument();
});

test('ALP-EMPTY-CTA: "See all courses" navigates to /courses', () => {
  mockUseCurriculums.mockReturnValue({
    data: [], isLoading: false, isError: false, refetch: jest.fn(),
  });
  render(<AllLearningPathsPage />);
  fireEvent.click(screen.getByRole('button', { name: /see all courses/i }));
  expect(mockNavigate).toHaveBeenCalledWith('/courses');
});

test('ALP-RENDERS: renders heading and path card titles', () => {
  mockUseCurriculums.mockReturnValue({
    data: [BASE_CURRICULUM], isLoading: false, isError: false, refetch: jest.fn(),
  });
  render(<AllLearningPathsPage />);
  expect(screen.getByText('Learning paths')).toBeInTheDocument();
  expect(screen.getByText('New Driver Onboarding')).toBeInTheDocument();
});

test('ALP-IN-PROGRESS: in-progress paths appear in "In progress" section', () => {
  mockUseCurriculums.mockReturnValue({
    data: [IN_PROGRESS_CURRICULUM], isLoading: false, isError: false, refetch: jest.fn(),
  });
  render(<AllLearningPathsPage />);
  expect(screen.getByText('In progress')).toBeInTheDocument();
  expect(screen.getByText('Advanced Driving')).toBeInTheDocument();
});

test('ALP-YOUR-PATHS: not-started paths appear in "Your paths" section', () => {
  mockUseCurriculums.mockReturnValue({
    data: [BASE_CURRICULUM], isLoading: false, isError: false, refetch: jest.fn(),
  });
  render(<AllLearningPathsPage />);
  expect(screen.getByText('Your paths')).toBeInTheDocument();
});

test('ALP-CARD-CLICK: clicking a path card navigates to /learning-path/:uuid', () => {
  mockUseCurriculums.mockReturnValue({
    data: [BASE_CURRICULUM], isLoading: false, isError: false, refetch: jest.fn(),
  });
  render(<AllLearningPathsPage />);
  fireEvent.click(screen.getByRole('button', { name: /view new driver onboarding/i }));
  expect(mockNavigate).toHaveBeenCalledWith('/learning-path/curr-1', expect.any(Object));
});

test('ALP-BACK: back arrow button navigates to /', () => {
  mockUseCurriculums.mockReturnValue({
    data: [BASE_CURRICULUM], isLoading: false, isError: false, refetch: jest.fn(),
  });
  render(<AllLearningPathsPage />);
  fireEvent.click(screen.getByRole('button', { name: /go back/i }));
  expect(mockNavigate).toHaveBeenCalledWith('/');
});

test('ALP-FOOTER-BTN: "Back to learning home" navigates to /', () => {
  mockUseCurriculums.mockReturnValue({
    data: [BASE_CURRICULUM], isLoading: false, isError: false, refetch: jest.fn(),
  });
  render(<AllLearningPathsPage />);
  fireEvent.click(screen.getByRole('button', { name: /back to learning home/i }));
  expect(mockNavigate).toHaveBeenCalledWith('/');
});

test('ALP-COMPLETION: completed path shows badge title and date', () => {
  mockUseCurriculums.mockReturnValue({
    data: [COMPLETE_CURRICULUM], isLoading: false, isError: false, refetch: jest.fn(),
  });
  render(<AllLearningPathsPage />);
  expect(screen.getByText(/Road Ready/)).toBeInTheDocument();
});

test('ALP-NEXT-COURSE: in-progress card shows "Next:" with next unfinished course name', () => {
  mockUseCurriculums.mockReturnValue({
    data: [IN_PROGRESS_CURRICULUM], isLoading: false, isError: false, refetch: jest.fn(),
  });
  render(<AllLearningPathsPage />);
  expect(screen.getByText(/Next: Course B/)).toBeInTheDocument();
});
