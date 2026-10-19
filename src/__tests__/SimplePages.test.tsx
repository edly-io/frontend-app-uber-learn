/**
 * Tests for simple wrapper page components:
 *   - CourseNotAvailablePage
 *   - NoRequiredCoursesPage
 *   - SessionEndedView
 *   - UnsupportedVersionView
 *   - NotEnrolledPage
 *
 * AC coverage:
 *   CNAP-RENDERS:     renders "This course isn't available" title
 *   CNAP-ACTION:      "Go to Learning home" button navigates to /
 *   NRCP-RENDERS:     renders "No courses yet" title
 *   SEV-RENDERS:      renders "Your session has ended" title (dark theme)
 *   SEV-CLOSE:        onClose callback fires when "Close" is clicked
 *   UVV-RENDERS:      renders unsupported version message
 *   NEP-RENDERS:      renders "We can't open this" title
 *   NEP-BACK-DEFAULT: back button navigates to / when no onClose prop
 *   NEP-BACK-CUSTOM:  back button calls onClose prop when provided
 *   NEP-CLOSE-BTN:    "Close" footer button uses same handleClose
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CourseNotAvailablePage } from '../pages/CourseNotAvailablePage';
import { NoRequiredCoursesPage } from '../pages/NoRequiredCoursesPage';
import { SessionEndedView } from '../components/ui/SessionEndedView';
import { UnsupportedVersionView } from '../components/ui/UnsupportedVersionView';
import { NotEnrolledPage } from '../pages/NotEnrolledPage';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

beforeEach(() => {
  mockNavigate.mockClear();
});

// ── CourseNotAvailablePage ────────────────────────────────────────────────────

describe('CourseNotAvailablePage', () => {
  it('CNAP-RENDERS: renders title', () => {
    render(<CourseNotAvailablePage />);
    expect(screen.getByText("This course isn't available")).toBeInTheDocument();
  });

  it('CNAP-ACTION: "Go to Learning home" button navigates to /', () => {
    render(<CourseNotAvailablePage />);
    fireEvent.click(screen.getByRole('button', { name: /go to learning home/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});

// ── NoRequiredCoursesPage ─────────────────────────────────────────────────────

describe('NoRequiredCoursesPage', () => {
  it('NRCP-RENDERS: renders "No courses yet" title', () => {
    render(<NoRequiredCoursesPage />);
    expect(screen.getByText('No courses yet')).toBeInTheDocument();
  });
});

// ── SessionEndedView ──────────────────────────────────────────────────────────

describe('SessionEndedView', () => {
  it('SEV-RENDERS: renders "Your session has ended" title', () => {
    render(<SessionEndedView onClose={jest.fn()} />);
    expect(screen.getByText('Your session has ended')).toBeInTheDocument();
  });

  it('SEV-CLOSE: onClose fires when "Close" button is clicked', () => {
    const onClose = jest.fn();
    render(<SessionEndedView onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ── UnsupportedVersionView ────────────────────────────────────────────────────

describe('UnsupportedVersionView', () => {
  it('UVV-RENDERS: renders unsupported version heading', () => {
    render(<UnsupportedVersionView onClose={jest.fn()} />);
    expect(screen.getByRole('heading')).toBeInTheDocument();
  });

  it('UVV-CLOSE: onClose fires when "Close" button is clicked', () => {
    const onClose = jest.fn();
    render(<UnsupportedVersionView onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ── NotEnrolledPage ───────────────────────────────────────────────────────────

describe('NotEnrolledPage', () => {
  it('NEP-RENDERS: renders "We can\'t open this" heading', () => {
    render(<NotEnrolledPage />);
    expect(screen.getByRole('heading', { name: /we can't open this/i })).toBeInTheDocument();
  });

  it('NEP-BACK-DEFAULT: back button navigates to / when no onClose prop', () => {
    render(<NotEnrolledPage />);
    fireEvent.click(screen.getByRole('button', { name: /go back/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('NEP-BACK-CUSTOM: back button calls onClose when provided', () => {
    const onClose = jest.fn();
    render(<NotEnrolledPage onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /go back/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('NEP-CLOSE-BTN: "Close" footer button uses same handleClose', () => {
    const onClose = jest.fn();
    render(<NotEnrolledPage onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
