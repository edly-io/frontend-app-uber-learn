import React from 'react';

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
      aria-label={`Step ${current + 1} of ${total}`}
      style={{
        padding: '4px 16px',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          height: '4px',
          borderRadius: '2px',
          background: 'var(--u-background-state-disabled)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            background: 'var(--u-background-accent)',
            borderRadius: '2px',
            transition: 'width var(--u-duration-normal) var(--u-ease-out)',
          }}
        />
      </div>
    </div>
  );
};
