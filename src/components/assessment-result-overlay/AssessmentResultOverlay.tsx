import React from 'react';
import type { AssessmentAttempt } from '../../api/progress';
import { Button } from '../ui/Button';
import './assessment-result-overlay.scss';

export type OverlayAssessmentType = 'baseline' | 'final' | 'retention' | 'already_passed' | 'assessment_incomplete' | 'submission_error';

interface AssessmentResultOverlayProps {
  assessmentType: OverlayAssessmentType;
  attempt: AssessmentAttempt | null;
  badgesAwardedNow: Array<{ badgeType: string; awardedAt: string }>;
  onClose: () => void;
}

function formatScore(correct: number, total: number): string {
  if (total === 0) { return '—'; }
  return `${correct} / ${total}`;
}

const PassIcon = () => (
  <div className="aro-icon aro-icon--pass" aria-hidden="true">
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path
        d="M8 16L13 21L24 10"
        stroke="var(--u-mastery)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </div>
);

const FailIcon = () => (
  <div className="aro-icon aro-icon--fail" aria-hidden="true">
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path
        d="M10 10L22 22M22 10L10 22"
        stroke="var(--u-content-secondary)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  </div>
);

const BaselineIcon = () => (
  <div className="aro-icon aro-icon--baseline" aria-hidden="true">
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="8" stroke="#276ef1" strokeWidth="2.5" />
      <path d="M16 11V16L19 19" stroke="#276ef1" strokeWidth="2" strokeLinecap="round" />
    </svg>
  </div>
);

/**
 * Bottom-sheet overlay displayed after an assessment submission resolves.
 *
 * States:
 *  - baseline: show score, no pass/fail concept, "Continue" button
 *  - final/retention pass: show score, "You passed!", badges if any, close
 *  - final/retention fail: show score, "Try again" button
 *  - already_passed (409): informational message, close button only
 */
export const AssessmentResultOverlay = ({
  assessmentType,
  attempt,
  badgesAwardedNow,
  onClose,
}: AssessmentResultOverlayProps) => {
  const isBaseline = assessmentType === 'baseline';
  const isAlreadyPassed = assessmentType === 'already_passed';
  const isIncomplete = assessmentType === 'assessment_incomplete';
  const isSubmissionError = assessmentType === 'submission_error';
  const isPassed = attempt?.passed === true;
  const isFailed = attempt?.passed === false;

  const scoreText = attempt
    ? formatScore(attempt.correctCount, attempt.totalCount)
    : '—';

  return (
    <div
      className="aro-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="aro-heading"
    >
      <div className="aro-sheet">

        {isAlreadyPassed && (
          <>
            <PassIcon />
            <h2 id="aro-heading" className="aro-heading">Already completed</h2>
            <p className="aro-sub">You&apos;ve already completed this assessment.</p>
            <div className="aro-actions">
              <Button fullWidth onClick={onClose}>Close</Button>
            </div>
          </>
        )}

        {isBaseline && !isAlreadyPassed && (
          <>
            <BaselineIcon />
            <h2 id="aro-heading" className="aro-heading">Baseline complete</h2>
            <div className="aro-score" aria-label={`Score: ${scoreText}`}>{scoreText}</div>
            <p className="aro-sub">This score helps personalise your learning path.</p>
            <div className="aro-actions">
              <Button fullWidth onClick={onClose}>Continue</Button>
            </div>
          </>
        )}

        {!isBaseline && !isAlreadyPassed && isPassed && (
          <>
            <PassIcon />
            <h2 id="aro-heading" className="aro-heading">You passed!</h2>
            <div className="aro-score" aria-label={`Score: ${scoreText}`}>{scoreText}</div>
            {badgesAwardedNow.length > 0 && (
              <div className="aro-badges" aria-label="Badges earned">
                {badgesAwardedNow.map((badge) => (
                  <span key={badge.badgeType} className="aro-badge-pill">
                    <span aria-hidden="true">🏅</span>
                    {badge.badgeType}
                  </span>
                ))}
              </div>
            )}
            <div className="aro-actions">
              <Button fullWidth onClick={onClose}>Continue</Button>
            </div>
          </>
        )}

        {!isBaseline && !isAlreadyPassed && isFailed && (
          <>
            <FailIcon />
            <h2 id="aro-heading" className="aro-heading">Keep going</h2>
            <div className="aro-score" aria-label={`Score: ${scoreText}`}>{scoreText}</div>
            <p className="aro-sub">Review the material and try again when you&apos;re ready.</p>
            <div className="aro-actions">
              <Button fullWidth onClick={onClose}>Try again</Button>
            </div>
          </>
        )}

        {isIncomplete && (
          <>
            <FailIcon />
            <h2 id="aro-heading" className="aro-heading">Answer all questions</h2>
            <p className="aro-sub">Complete every question before submitting.</p>
            <div className="aro-actions">
              <Button fullWidth onClick={onClose}>Go back</Button>
            </div>
          </>
        )}

        {isSubmissionError && (
          <>
            <FailIcon />
            <h2 id="aro-heading" className="aro-heading">Submission failed</h2>
            <p className="aro-sub">Something went wrong. Please try again.</p>
            <div className="aro-actions">
              <Button fullWidth onClick={onClose}>Try again</Button>
            </div>
          </>
        )}

      </div>
    </div>
  );
};
