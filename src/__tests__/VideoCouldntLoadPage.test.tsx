/**
 * Tests for VideoCouldntLoadPage.
 *
 * AC coverage:
 *   VCLP-RENDERS:      renders error title and body
 *   VCLP-BACK:         back arrow click navigates to /course/:courseId
 *   VCLP-RETRY:        "Try again" navigates to the failed step
 *   VCLP-RETRY-IDX:    "Try again" with unitIdx in state navigates to that step
 *   VCLP-CONTINUE-SEQ: "Continue" with sequenceId navigates to next lesson step
 *   VCLP-CONTINUE-IDX:  "Continue" with unitIdx in state navigates to unitIdx+1
 *   VCLP-CONTINUE-LAST: "Continue" when unitIdx is the last unit navigates to course overview
 *   VCLP-CONTINUE-NO:   "Continue" without sequenceId navigates to course overview
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { VideoCouldntLoadPage } from '../pages/VideoCouldntLoadPage';

const mockNavigate = jest.fn();
const mockUseParams = jest.fn();
const mockUseLocation = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => mockUseParams(),
  useLocation: () => mockUseLocation(),
}));

beforeEach(() => {
  mockNavigate.mockClear();
  mockUseLocation.mockReturnValue({
    state: null, key: 'test', pathname: '/', search: '', hash: '',
  });
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

test('VCLP-RETRY: "Try again" navigates back to the lesson step (unitIdx defaults to 0)', () => {
  render(<VideoCouldntLoadPage />);
  fireEvent.click(screen.getByRole('button', { name: /try again/i }));
  expect(mockNavigate).toHaveBeenCalledWith(
    '/course/course-v1:Uber+Safety+2026/lesson/block-v1:seq1/step/0',
    { replace: true },
  );
});

test('VCLP-RETRY-IDX: "Try again" with unitIdx=3 in state navigates to step/3', () => {
  mockUseLocation.mockReturnValue({
    state: { unitIdx: 3 }, key: 'test', pathname: '/', search: '', hash: '',
  });
  render(<VideoCouldntLoadPage />);
  fireEvent.click(screen.getByRole('button', { name: /try again/i }));
  expect(mockNavigate).toHaveBeenCalledWith(
    '/course/course-v1:Uber+Safety+2026/lesson/block-v1:seq1/step/3',
    { replace: true },
  );
});

test('VCLP-CONTINUE-SEQ: "Continue" with sequenceId navigates to next lesson step', () => {
  render(<VideoCouldntLoadPage />);
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  expect(mockNavigate).toHaveBeenCalledWith('/course/course-v1:Uber+Safety+2026/lesson/block-v1:seq1/step/1');
});

test('VCLP-CONTINUE-IDX: "Continue" with unitIdx=3 in state navigates to step/4', () => {
  mockUseLocation.mockReturnValue({
    state: { unitIdx: 3 }, key: 'test', pathname: '/', search: '', hash: '',
  });
  render(<VideoCouldntLoadPage />);
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  expect(mockNavigate).toHaveBeenCalledWith(
    '/course/course-v1:Uber+Safety+2026/lesson/block-v1:seq1/step/4',
  );
});

test('VCLP-CONTINUE-LAST: "Continue" when unitIdx is the last unit navigates to course overview', () => {
  mockUseLocation.mockReturnValue({
    state: { unitIdx: 2, unitCount: 3 }, key: 'test', pathname: '/', search: '', hash: '',
  });
  render(<VideoCouldntLoadPage />);
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  expect(mockNavigate).toHaveBeenCalledWith('/course/course-v1:Uber+Safety+2026');
});

test('VCLP-CONTINUE-NO: "Continue" without sequenceId navigates to course overview', () => {
  mockUseParams.mockReturnValue({ courseId: 'course-v1:Uber+Safety+2026', sequenceId: '' });
  render(<VideoCouldntLoadPage />);
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  expect(mockNavigate).toHaveBeenCalledWith('/course/course-v1:Uber+Safety+2026');
});
