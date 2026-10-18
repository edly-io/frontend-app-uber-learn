import React from 'react';
import './progress-bar.scss';

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
      className="progress-bar"
    >
      <div
        className="progress-bar__fill"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};
