import React from 'react';

interface LoadingSkeletonProps {
  className?: string;
}

const styles = `
  @keyframes skel-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.55; }
  }
  .skel-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    overflow: hidden;
    background: var(--u-background-primary);
  }
  .skel-bone {
    background: var(--u-background-secondary);
    border-radius: 6px;
    flex-shrink: 0;
    animation: skel-pulse 1.6s ease-in-out infinite;
  }
  .skel-art { height: 140px; width: 100%; border-radius: 16px; }
  .skel-kicker { height: 12px; width: 96px; }
  .skel-h1 { height: 28px; width: 300px; border-radius: 8px; max-width: 100%; }
  .skel-h2 { height: 28px; width: 220px; border-radius: 8px; max-width: 100%; }
  .skel-b1 { height: 14px; width: 340px; border-radius: 7px; max-width: 100%; }
  .skel-b2 { height: 14px; width: 280px; border-radius: 7px; max-width: 100%; }
  .skel-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding-top: 8px;
    flex-shrink: 0;
  }
  .skel-circle {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--u-background-secondary);
    flex-shrink: 0;
    animation: skel-pulse 1.6s ease-in-out infinite;
  }
  .skel-row-lines {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .skel-line-long { height: 12px; width: 200px; max-width: 100%; }
  .skel-line-short { height: 12px; width: 120px; max-width: 100%; }
`;

const RowBone = () => (
  <div className="skel-row">
    <div className="skel-circle" aria-hidden="true" />
    <div className="skel-row-lines">
      <div className="skel-bone skel-line-long" aria-hidden="true" />
      <div className="skel-bone skel-line-short" aria-hidden="true" />
    </div>
  </div>
);

export const LoadingSkeleton = ({ className }: LoadingSkeletonProps) => (
  <div className={`skel-content${className ? ` ${className}` : ''}`} aria-busy="true" aria-label="Loading…">
    <style>{styles}</style>
    <div className="skel-bone skel-art" aria-hidden="true" />
    <div className="skel-bone skel-kicker" aria-hidden="true" />
    <div className="skel-bone skel-h1" aria-hidden="true" />
    <div className="skel-bone skel-h2" aria-hidden="true" />
    <div className="skel-bone skel-b1" aria-hidden="true" />
    <div className="skel-bone skel-b2" aria-hidden="true" />
    <RowBone />
    <RowBone />
    <RowBone />
  </div>
);
