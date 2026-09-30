/**
 * Component tests for RetryOverlay.
 *
 * AC coverage:
 *   - RTO-COOLDOWN-01: cooldown state shows countdown timer
 *   - RTO-COOLDOWN-02: countdown decrements each second
 *   - RTO-COOLDOWN-03: zero countdown says "You can try again now"
 *   - RTO-ALREADY-PASSED-01: already_passed shows informational message
 *   - RTO-FINAL-01: final_not_passed shows appropriate message
 *   - RTO-RETENTION-01: retention_locked shows formatted unlock date
 *   - RTO-CLOSE-01: onClose called when button is clicked
 *   - RTO-A11Y-01: dialog role and aria-modal present
 */
import React from 'react';
import {
  render, screen, act, fireEvent,
} from '@testing-library/react';
import { RetryOverlay } from '../components/retry-overlay/RetryOverlay';

const onClose = jest.fn();

beforeEach(() => {
  onClose.mockClear();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RetryOverlay', () => {
  describe('RTO-A11Y-01: accessibility', () => {
    it('has role=dialog and aria-modal=true', () => {
      render(
        <RetryOverlay
          blockedReason="cooldown"
          retryAfterSeconds={60}
          unlocksAt={null}
          onClose={onClose}
        />,
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });
  });

  describe('RTO-COOLDOWN: cooldown state', () => {
    it('RTO-COOLDOWN-01: shows formatted countdown timer', () => {
      render(
        <RetryOverlay
          blockedReason="cooldown"
          retryAfterSeconds={330}
          unlocksAt={null}
          onClose={onClose}
        />,
      );

      // 330 seconds = 5:30
      expect(screen.getByText('5:30')).toBeInTheDocument();
    });

    it('RTO-COOLDOWN-02: countdown decrements each second', () => {
      render(
        <RetryOverlay
          blockedReason="cooldown"
          retryAfterSeconds={62}
          unlocksAt={null}
          onClose={onClose}
        />,
      );

      // Initial: 1:02
      expect(screen.getByText('1:02')).toBeInTheDocument();

      act(() => { jest.advanceTimersByTime(1000); });
      expect(screen.getByText('1:01')).toBeInTheDocument();

      act(() => { jest.advanceTimersByTime(1000); });
      expect(screen.getByText('1:00')).toBeInTheDocument();
    });

    it('RTO-COOLDOWN-03: shows "try again" message when timer reaches zero', () => {
      render(
        <RetryOverlay
          blockedReason="cooldown"
          retryAfterSeconds={2}
          unlocksAt={null}
          onClose={onClose}
        />,
      );

      act(() => { jest.advanceTimersByTime(3000); });

      expect(screen.getByText('0:00')).toBeInTheDocument();
      expect(screen.getByText(/try this assessment again now/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });

    it('RTO-CLOSE-01 (cooldown): calls onClose when "Got it" is clicked', () => {
      render(
        <RetryOverlay
          blockedReason="cooldown"
          retryAfterSeconds={60}
          unlocksAt={null}
          onClose={onClose}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /got it/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('RTO-ALREADY-PASSED-01: already_passed state', () => {
    it('shows "Already completed" message', () => {
      render(
        <RetryOverlay
          blockedReason="already_passed"
          retryAfterSeconds={0}
          unlocksAt={null}
          onClose={onClose}
        />,
      );

      expect(screen.getByText(/already completed/i)).toBeInTheDocument();
      expect(screen.getByText(/already passed/i)).toBeInTheDocument();
    });

    it('calls onClose when Close is clicked', () => {
      render(
        <RetryOverlay
          blockedReason="already_passed"
          retryAfterSeconds={0}
          unlocksAt={null}
          onClose={onClose}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /close/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('RTO-FINAL-01: final_not_passed state', () => {
    it('shows message about passing final assessment first', () => {
      render(
        <RetryOverlay
          blockedReason="final_not_passed"
          retryAfterSeconds={0}
          unlocksAt={null}
          onClose={onClose}
        />,
      );

      expect(screen.getByText(/not unlocked/i)).toBeInTheDocument();
      expect(screen.getByText(/final assessment/i)).toBeInTheDocument();
    });

    it('calls onClose when Close is clicked', () => {
      render(
        <RetryOverlay
          blockedReason="final_not_passed"
          retryAfterSeconds={0}
          unlocksAt={null}
          onClose={onClose}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /close/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('RTO-RETENTION-01: retention_locked state', () => {
    it('shows unlock date when unlocksAt is provided', () => {
      render(
        <RetryOverlay
          blockedReason="retention_locked"
          retryAfterSeconds={0}
          unlocksAt="2024-06-15T00:00:00Z"
          onClose={onClose}
        />,
      );

      expect(screen.getByText(/unlocks soon/i)).toBeInTheDocument();
      // Match either "June 15" (en-US) or "15 June" (en-GB / other locales)
      expect(screen.getByText(/june.*15|15.*june/i)).toBeInTheDocument();
    });

    it('handles null unlocksAt gracefully', () => {
      render(
        <RetryOverlay
          blockedReason="retention_locked"
          retryAfterSeconds={0}
          unlocksAt={null}
          onClose={onClose}
        />,
      );

      expect(screen.getByText(/a future date/i)).toBeInTheDocument();
    });

    it('calls onClose when Close is clicked', () => {
      render(
        <RetryOverlay
          blockedReason="retention_locked"
          retryAfterSeconds={0}
          unlocksAt={null}
          onClose={onClose}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /close/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
