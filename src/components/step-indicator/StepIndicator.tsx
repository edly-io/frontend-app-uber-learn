import React from 'react';

interface StepIndicatorProps {
  /** 0-based current step index */
  current: number;
  /** Total number of steps */
  total: number;
}

export const StepIndicator = ({ current, total }: StepIndicatorProps) => (
  <div
    aria-label={`Step ${current + 1} of ${total}`}
    style={{
      display: 'flex',
      gap: '4px',
      padding: '0 var(--u-page-gutter) 0.5rem',
    }}
  >
    {Array.from({ length: total }, (_, i) => (
      <div
        key={i}
        aria-hidden="true"
        style={{
          flex: 1,
          height: '4px',
          borderRadius: '2px',
          background: i <= current
            ? 'var(--u-background-accent)'
            : 'var(--u-background-state-disabled)',
          transition: 'background var(--u-duration-normal) var(--u-ease-out)',
        }}
      />
    ))}
  </div>
);
