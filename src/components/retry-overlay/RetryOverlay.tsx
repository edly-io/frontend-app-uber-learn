import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import './retry-overlay.css';

type BlockedReason = 'cooldown' | 'already_passed' | 'final_not_passed' | 'retention_locked';

interface RetryOverlayProps {
  blockedReason: BlockedReason;
  /** Seconds until the cooldown expires. Only meaningful for blockedReason='cooldown'. */
  retryAfterSeconds: number;
  /** ISO string for when a retention assessment unlocks. Used for retention_locked. */
  unlocksAt: string | null;
  onClose: () => void;
}

function formatSeconds(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatUnlockDate(isoDate: string | null): string {
  if (!isoDate) { return 'a future date'; }
  try {
    return new Date(isoDate).toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

const LockIcon = () => (
  <div className="rto-icon" aria-hidden="true">
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="5" y="13" width="18" height="12" rx="2" stroke="var(--u-content-secondary)" strokeWidth="2" />
      <path
        d="M9 13V9a5 5 0 0 1 10 0v4"
        stroke="var(--u-content-secondary)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="14" cy="19" r="1.5" fill="var(--u-content-secondary)" />
    </svg>
  </div>
);

/**
 * Bottom-sheet overlay shown when a learner tries to enter an assessment
 * sequence where `can_attempt === false`.
 *
 * States:
 *  - cooldown: countdown timer, "Come back in X:XX"
 *  - already_passed: informational, close only
 *  - final_not_passed: must pass the final first
 *  - retention_locked: shows unlock date
 */
export const RetryOverlay = ({
  blockedReason,
  retryAfterSeconds,
  unlocksAt,
  onClose,
}: RetryOverlayProps) => {
  const [secondsLeft, setSecondsLeft] = useState(retryAfterSeconds);

  // Countdown timer for cooldown state
  useEffect(() => {
    if (blockedReason !== 'cooldown') { return undefined; }
    if (secondsLeft <= 0) { return undefined; }

    const intervalId = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [blockedReason, secondsLeft]);

  // Reset countdown when retryAfterSeconds prop changes
  useEffect(() => {
    setSecondsLeft(retryAfterSeconds);
  }, [retryAfterSeconds]);

  return (
    <div
      className="rto-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rto-heading"
    >
      <div className="rto-sheet">
        <LockIcon />

        {blockedReason === 'cooldown' && (
          <>
            <h2 id="rto-heading" className="rto-heading">Come back soon</h2>
            <div
              className="rto-countdown"
              aria-live="off"
              aria-label={`Time remaining: ${formatSeconds(secondsLeft)}`}
            >
              {formatSeconds(secondsLeft)}
            </div>
            <p className="rto-sub">
              {secondsLeft > 0
                ? 'This assessment has a cooldown period. Try again when the timer reaches zero.'
                : 'You can try this assessment again now.'}
            </p>
            <Button fullWidth onClick={onClose}>
              {secondsLeft > 0 ? 'Got it' : 'Close'}
            </Button>
          </>
        )}

        {blockedReason === 'already_passed' && (
          <>
            <h2 id="rto-heading" className="rto-heading">Already completed</h2>
            <p className="rto-sub">You&apos;ve already passed this assessment.</p>
            <Button fullWidth onClick={onClose}>Close</Button>
          </>
        )}

        {blockedReason === 'final_not_passed' && (
          <>
            <h2 id="rto-heading" className="rto-heading">Not unlocked yet</h2>
            <p className="rto-sub">
              Complete and pass the final assessment before taking the retention check.
            </p>
            <Button fullWidth onClick={onClose}>Close</Button>
          </>
        )}

        {blockedReason === 'retention_locked' && (
          <>
            <h2 id="rto-heading" className="rto-heading">Unlocks soon</h2>
            <p className="rto-sub">
              Your retention assessment will be available on:
            </p>
            <p className="rto-unlock-date">{formatUnlockDate(unlocksAt)}</p>
            <Button fullWidth onClick={onClose}>Close</Button>
          </>
        )}
      </div>
    </div>
  );
};
