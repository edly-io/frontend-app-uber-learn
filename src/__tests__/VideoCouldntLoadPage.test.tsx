/**
 * Tests for VideoCouldntLoadPage.
 *
 * AC coverage:
 *   VCLP-RENDERS:      renders error title and body
 *   VCLP-BACK:         back arrow click navigates to /course/:courseId
 *   VCLP-RETRY:        "Try again" reloads the page
 *   VCLP-CONTINUE-SEQ: "Continue" with sequenceId navigates to lesson step
 *   VCLP-CONTINUE-NO:  "Continue" without sequenceId navigates to course overview
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { VideoCouldntLoadPage } from '../pages/VideoCouldntLoadPage';

const mockNavigate = jest.fn();
const mockUseParams = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => mockUseParams(),
  useLocation: () => ({
    state: null, key: 'test', pathname: '/', search: '', hash: '',
  }),
}));

beforeEach(() => {
  mockNavigate.mockClear();
  mockUseParams.mockReturnValue({ courseId: 'course-v1:Uber+Safety+2026', sequenceId: 'block-v1:seq1' });
});

test('VCLP-RENDERS: renders error title and body text', () => {
  render(<VideoCouldntLoadPage />);
  expect(screen.getByText('This video could not load')).toBeInTheDocument();
  expect(screen.getByText(/Check your connection/i)).toBeInTheDocument();
});

test('VCLP-BACK: back arrow click navigates to course overview', () => {
  render(<VideoCouldntLoadPage />);
  fireEvent.click(screen.getByRole('button', { name: /back/i }));
  expect(mockNavigate).toHaveBeenCalledWith('/course/course-v1:Uber+Safety+2026');
});

test('VCLP-RETRY: "Try again" navigates back to the lesson step', () => {
  render(<VideoCouldntLoadPage />);
  fireEvent.click(screen.getByRole('button', { name: /try again/i }));
  expect(mockNavigate).toHaveBeenCalledWith(
    '/course/course-v1:Uber+Safety+2026/lesson/block-v1:seq1/step/0',
    { replace: true },
  );
});

test('VCLP-CONTINUE-SEQ: "Continue" with sequenceId navigates to lesson step', () => {
  render(<VideoCouldntLoadPage />);
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  expect(mockNavigate).toHaveBeenCalledWith('/course/course-v1:Uber+Safety+2026/lesson/block-v1:seq1/step/0');
});

test('VCLP-CONTINUE-NO: "Continue" without sequenceId navigates to course overview', () => {
  mockUseParams.mockReturnValue({ courseId: 'course-v1:Uber+Safety+2026', sequenceId: '' });
  render(<VideoCouldntLoadPage />);
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  expect(mockNavigate).toHaveBeenCalledWith('/course/course-v1:Uber+Safety+2026');
});
