/**
 * Tests for NotEnrolledPage.
 *
 * AC coverage:
 *   NEP-RENDERS:   page renders heading and body text
 *   NEP-CLOSE-CB:  "Close" button calls onClose callback when provided
 *   NEP-CLOSE-NAV: "Close" button navigates to "/" when no onClose prop
 *   NEP-BACK-CB:   back arrow calls onClose callback when provided
 *   NEP-BACK-NAV:  back arrow navigates to "/" when no onClose prop
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotEnrolledPage } from '../pages/NotEnrolledPage';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

beforeEach(() => { mockNavigate.mockClear(); });

describe('NotEnrolledPage', () => {
  it('NEP-RENDERS: renders heading and body text', () => {
    render(<NotEnrolledPage />);
    expect(screen.getByText(/We can't open this/i)).toBeInTheDocument();
    expect(screen.getByText(/doesn't work with your account/i)).toBeInTheDocument();
  });

  it('NEP-CLOSE-CB: Close button calls onClose when provided', () => {
    const onClose = jest.fn();
    render(<NotEnrolledPage onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('NEP-CLOSE-NAV: Close button navigates to "/" when no onClose', () => {
    render(<NotEnrolledPage />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('NEP-BACK-CB: back arrow calls onClose when provided', () => {
    const onClose = jest.fn();
    render(<NotEnrolledPage onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /go back/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('NEP-BACK-NAV: back arrow navigates to "/" when no onClose', () => {
    render(<NotEnrolledPage />);
    fireEvent.click(screen.getByRole('button', { name: /go back/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
