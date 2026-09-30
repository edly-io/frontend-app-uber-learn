/**
 * Component tests for AssessmentResultOverlay.
 *
 * AC coverage:
 *   - ARO-BASELINE-01: baseline mode shows score without pass/fail label
 *   - ARO-BASELINE-02: baseline mode shows "Continue" button
 *   - ARO-PASS-01: passed mode shows "You passed!" heading
 *   - ARO-PASS-02: passed mode shows score
 *   - ARO-PASS-03: passed mode with badges shows badge pills
 *   - ARO-PASS-04: passed mode without badges shows no badge pills
 *   - ARO-FAIL-01: failed mode shows "Keep going" / "Try again" button
 *   - ARO-FAIL-02: failed mode shows score
 *   - ARO-ALREADY-PASSED-01: already_passed mode shows "Already completed" message
 *   - ARO-CLOSE-01: onClose called when action button is clicked
 *   - ARO-A11Y-01: dialog role and aria-modal are present
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  AssessmentResultOverlay,
} from '../components/assessment-result-overlay/AssessmentResultOverlay';
import type { AssessmentAttempt } from '../api/progress';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const PASS_ATTEMPT: AssessmentAttempt = {
  attemptNumber: 1,
  correctCount: 8,
  totalCount: 10,
  passed: true,
  submittedAt: '2024-01-01T12:00:00Z',
  questionResults: [],
};

const FAIL_ATTEMPT: AssessmentAttempt = {
  ...PASS_ATTEMPT,
  correctCount: 4,
  passed: false,
};

const BASELINE_ATTEMPT: AssessmentAttempt = {
  ...PASS_ATTEMPT,
  passed: null,
};

const BADGES = [
  { badgeType: 'thorough', awardedAt: '2024-01-01T12:00:00Z' },
];

const onClose = jest.fn();

beforeEach(() => {
  onClose.mockClear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AssessmentResultOverlay', () => {
  describe('dialog accessibility', () => {
    it('ARO-A11Y-01: has role=dialog and aria-modal=true', () => {
      render(
        <AssessmentResultOverlay
          assessmentType="final"
          attempt={PASS_ATTEMPT}
          badgesAwardedNow={[]}
          onClose={onClose}
        />,
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });
  });

  describe('ARO-BASELINE: baseline mode', () => {
    it('ARO-BASELINE-01: shows score without pass/fail text', () => {
      render(
        <AssessmentResultOverlay
          assessmentType="baseline"
          attempt={BASELINE_ATTEMPT}
          badgesAwardedNow={[]}
          onClose={onClose}
        />,
      );

      // Score displayed — BASELINE_ATTEMPT spreads PASS_ATTEMPT (correctCount: 8, totalCount: 10)
      expect(screen.getByText('8 / 10')).toBeInTheDocument();
      // No "You passed!" or "Keep going"
      expect(screen.queryByText(/you passed/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/keep going/i)).not.toBeInTheDocument();
    });

    it('ARO-BASELINE-02: shows "Continue" button', () => {
      render(
        <AssessmentResultOverlay
          assessmentType="baseline"
          attempt={BASELINE_ATTEMPT}
          badgesAwardedNow={[]}
          onClose={onClose}
        />,
      );

      expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
    });

    it('ARO-CLOSE-01 (baseline): calls onClose when Continue is clicked', () => {
      render(
        <AssessmentResultOverlay
          assessmentType="baseline"
          attempt={BASELINE_ATTEMPT}
          badgesAwardedNow={[]}
          onClose={onClose}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('ARO-PASS: passed mode (final/retention)', () => {
    it('ARO-PASS-01: shows "You passed!" heading', () => {
      render(
        <AssessmentResultOverlay
          assessmentType="final"
          attempt={PASS_ATTEMPT}
          badgesAwardedNow={[]}
          onClose={onClose}
        />,
      );

      expect(screen.getByText(/you passed/i)).toBeInTheDocument();
    });

    it('ARO-PASS-02: shows formatted score', () => {
      render(
        <AssessmentResultOverlay
          assessmentType="final"
          attempt={PASS_ATTEMPT}
          badgesAwardedNow={[]}
          onClose={onClose}
        />,
      );

      expect(screen.getByText('8 / 10')).toBeInTheDocument();
    });

    it('ARO-PASS-03: shows badge pills when badges are awarded', () => {
      render(
        <AssessmentResultOverlay
          assessmentType="final"
          attempt={PASS_ATTEMPT}
          badgesAwardedNow={BADGES}
          onClose={onClose}
        />,
      );

      expect(screen.getByText('thorough')).toBeInTheDocument();
    });

    it('ARO-PASS-04: no badge pills when no badges awarded', () => {
      render(
        <AssessmentResultOverlay
          assessmentType="final"
          attempt={PASS_ATTEMPT}
          badgesAwardedNow={[]}
          onClose={onClose}
        />,
      );

      // aria-label "Badges earned" should not be present
      expect(screen.queryByLabelText(/badges earned/i)).not.toBeInTheDocument();
    });

    it('ARO-CLOSE-01 (pass): calls onClose when Continue is clicked', () => {
      render(
        <AssessmentResultOverlay
          assessmentType="final"
          attempt={PASS_ATTEMPT}
          badgesAwardedNow={[]}
          onClose={onClose}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('ARO-FAIL: failed mode', () => {
    it('ARO-FAIL-01: shows "Keep going" heading and "Try again" button', () => {
      render(
        <AssessmentResultOverlay
          assessmentType="final"
          attempt={FAIL_ATTEMPT}
          badgesAwardedNow={[]}
          onClose={onClose}
        />,
      );

      expect(screen.getByText(/keep going/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('ARO-FAIL-02: shows score', () => {
      render(
        <AssessmentResultOverlay
          assessmentType="final"
          attempt={FAIL_ATTEMPT}
          badgesAwardedNow={[]}
          onClose={onClose}
        />,
      );

      expect(screen.getByText('4 / 10')).toBeInTheDocument();
    });

    it('ARO-CLOSE-01 (fail): calls onClose when "Try again" is clicked', () => {
      render(
        <AssessmentResultOverlay
          assessmentType="final"
          attempt={FAIL_ATTEMPT}
          badgesAwardedNow={[]}
          onClose={onClose}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /try again/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('ARO-ALREADY-PASSED: already_passed mode', () => {
    it('ARO-ALREADY-PASSED-01: shows "Already completed" message', () => {
      render(
        <AssessmentResultOverlay
          assessmentType="already_passed"
          attempt={null}
          badgesAwardedNow={[]}
          onClose={onClose}
        />,
      );

      // Use role query to disambiguate the heading from the paragraph below it
      expect(screen.getByRole('heading', { name: /already completed/i })).toBeInTheDocument();
    });

    it('shows a Close button in already_passed mode', () => {
      render(
        <AssessmentResultOverlay
          assessmentType="already_passed"
          attempt={null}
          badgesAwardedNow={[]}
          onClose={onClose}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /close/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('score formatting edge cases', () => {
    it('shows — when attempt is null (already_passed with no attempt data)', () => {
      render(
        <AssessmentResultOverlay
          assessmentType="baseline"
          attempt={null}
          badgesAwardedNow={[]}
          onClose={onClose}
        />,
      );

      // Should render "—" as score when no attempt
      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });
});
