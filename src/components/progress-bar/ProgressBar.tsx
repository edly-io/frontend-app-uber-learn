import React from 'react';

interface ProgressBarProps {
  /** 0–1 fraction completed */
  fraction: number;
  label?: string;
}

export const ProgressBar = ({ fraction, label }: ProgressBarProps) => {
  const pct = Math.min(1, Math.max(0, fraction)) * 100;

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? `Course progress: ${Math.round(pct)}%`}
      style={{
        height: '4px',
        background: 'var(--u-background-state-disabled)',
        borderRadius: '2px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          background: 'var(--u-background-accent)',
          borderRadius: '2px',
          transition: 'width var(--u-duration-normal) var(--u-ease-out)',
        }}
      />
    </div>
  );
};
