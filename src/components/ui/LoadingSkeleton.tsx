import React from 'react';

interface LoadingSkeletonProps {
  className?: string;
}

const styles = `
  @keyframes uber-spin {
    to { transform: rotate(360deg); }
  }
  .uber-page-loader {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px;
    background: var(--u-background-primary);
    min-height: 200px;
  }
  .uber-spinner {
    width: 36px;
    height: 36px;
    border: 2.5px solid var(--u-border-opaque);
    border-top-color: var(--u-content-primary);
    border-radius: 50%;
    animation: uber-spin 0.75s linear infinite;
    flex-shrink: 0;
  }
`;

export const LoadingSkeleton = ({ className }: LoadingSkeletonProps) => (
  <div className={`uber-page-loader${className ? ` ${className}` : ''}`} aria-busy="true" aria-label="Loading…">
    <style>{styles}</style>
    <div className="uber-spinner" aria-hidden="true" />
  </div>
);
