/**
 * Tests for SessionEndedView, UnsupportedVersionView, CourseNotAvailablePage,
 * and NoRequiredCoursesPage — all thin wrappers around SystemStateView.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionEndedView } from '../components/ui/SessionEndedView';
import { UnsupportedVersionView } from '../components/ui/UnsupportedVersionView';
import { CourseNotAvailablePage } from '../pages/CourseNotAvailablePage';
import { NoRequiredCoursesPage } from '../pages/NoRequiredCoursesPage';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

beforeEach(() => {
  mockNavigate.mockClear();
});

// ── SessionEndedView ──────────────────────────────────────────

describe('SessionEndedView', () => {
  it('SEV-RENDERS: renders title and message', () => {
    render(<SessionEndedView onClose={jest.fn()} />);
    expect(screen.getByText(/your session has ended/i)).toBeInTheDocument();
    expect(screen.getByText(/open learning again/i)).toBeInTheDocument();
  });

  it('SEV-ACTION: calls onClose when button clicked', () => {
    const onClose = jest.fn();
    render(<SessionEndedView onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('SEV-DARK: renders in dark mode (ss-page--dark class present)', () => {
    const { container } = render(<SessionEndedView onClose={jest.fn()} />);
    expect(container.querySelector('.ss-page--dark')).toBeInTheDocument();
  });
});

// ── UnsupportedVersionView ────────────────────────────────────

describe('UnsupportedVersionView', () => {
  it('UVV-RENDERS: renders title and message', () => {
    render(<UnsupportedVersionView onClose={jest.fn()} />);
    expect(screen.getByText(/update the uber app/i)).toBeInTheDocument();
    expect(screen.getByText(/this version can't open learning/i)).toBeInTheDocument();
  });

  it('UVV-ACTION: calls onClose when button clicked', () => {
    const onClose = jest.fn();
    render(<UnsupportedVersionView onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

// ── CourseNotAvailablePage ────────────────────────────────────

describe('CourseNotAvailablePage', () => {
  it('CNA-RENDERS: renders title and message', () => {
    render(<CourseNotAvailablePage />);
    expect(screen.getByText(/this course isn't available/i)).toBeInTheDocument();
    expect(screen.getByText(/your points and badges are safe/i)).toBeInTheDocument();
  });

  it('CNA-ACTION: navigates home when button clicked', () => {
    render(<CourseNotAvailablePage />);
    fireEvent.click(screen.getByRole('button', { name: /go to learning home/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});

// ── NoRequiredCoursesPage ────────────────────────────────────

describe('NoRequiredCoursesPage', () => {
  it('NRC-RENDERS: renders title and message', () => {
    render(<NoRequiredCoursesPage />);
    expect(screen.getByText(/no courses yet/i)).toBeInTheDocument();
    expect(screen.getByText(/courses for the city you drive in/i)).toBeInTheDocument();
  });

  it('NRC-NO-BTN: does not render a footer button', () => {
    render(<NoRequiredCoursesPage />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
