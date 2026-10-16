import React from 'react';
import './loading-skeleton.scss';

interface LoadingSkeletonProps {
  className?: string;
  variant?: 'page' | 'card';
}

const LessonRow = () => (
  <div className="skel-row">
    <div className="skel-circle" aria-hidden="true" />
    <div className="skel-row-lines">
      <div className="skel-bone skel-line-title" aria-hidden="true" />
      <div className="skel-bone skel-line-sub" aria-hidden="true" />
    </div>
  </div>
);

export const LoadingSkeleton = ({ className, variant = 'page' }: LoadingSkeletonProps) => {
  if (variant === 'card') {
    return (
      <div
        className={`skel-content skel-content--card${className ? ` ${className}` : ''}`}
        role="status"
        aria-busy="true"
        aria-label="Loading…"
      >
        <div className="skel-bone skel-card-title" aria-hidden="true" />
        <div className="skel-bone skel-card-sub" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className={`skel-content${className ? ` ${className}` : ''}`} role="status" aria-busy="true" aria-label="Loading…">
      <div className="skel-bone skel-art" aria-hidden="true" />
      <div className="skel-bone skel-kicker" aria-hidden="true" />
      <div className="skel-bone skel-h1" aria-hidden="true" />
      <div className="skel-bone skel-h1b" aria-hidden="true" />
      <div className="skel-bone skel-b1" aria-hidden="true" />
      <div className="skel-bone skel-b2" aria-hidden="true" />
      <LessonRow />
      <LessonRow />
      <LessonRow />
    </div>
  );
};
