import React, { useEffect } from 'react';
import './lesson-complete-overlay.scss';

const AUTO_DISMISS_MS = 2000;

interface LessonCompleteOverlayProps {
  /** Points awarded in the activity that triggered this overlay. null = not applicable. */
  pointsEarned: number | null;
  onDismiss: () => void;
}

/**
 * Brief overlay shown when a learner completes all units in a non-assessment lesson.
 * Auto-dismisses after 2 s. Tap anywhere on the backdrop to dismiss immediately.
 */
export const LessonCompleteOverlay = ({
  pointsEarned,
  onDismiss,
}: LessonCompleteOverlayProps) => {
  useEffect(() => {
    const timerId = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timerId);
  }, [onDismiss]);

  return (
    /* eslint-disable-next-line jsx-a11y/click-events-have-key-events,
                                jsx-a11y/no-static-element-interactions,
                                jsx-a11y/no-noninteractive-element-interactions */
    <div
      className="lco-backdrop"
      onClick={onDismiss}
      role="status"
      aria-live="polite"
      aria-label="Lesson complete"
    >
      <div className="lco-card">
        <div className="lco-icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path
              d="M6 14L11 19L22 8"
              stroke="var(--u-mastery)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="lco-heading">Lesson complete!</h2>
        {pointsEarned !== null && (
          <p className="lco-points">
            +
            {pointsEarned}
            {' '}
            points earned
          </p>
        )}
      </div>
    </div>
  );
};
