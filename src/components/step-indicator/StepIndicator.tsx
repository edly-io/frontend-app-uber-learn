import React from 'react';
import './step-indicator.scss';

interface StepIndicatorProps {
  /** 0-based current step index */
  current: number;
  /** Total number of steps */
  total: number;
}

export const StepIndicator = ({ current, total }: StepIndicatorProps) => {
  const pct = total > 0 ? Math.round(((current + 1) / total) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={current + 1}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Step ${current + 1} of ${total}`}
      className="step-indicator"
    >
      <div className="step-indicator__track">
        <div
          aria-hidden="true"
          className="step-indicator__fill"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};
