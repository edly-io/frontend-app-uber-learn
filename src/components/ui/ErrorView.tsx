import React from 'react';

interface ErrorViewProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorView = ({
  title = 'Something went wrong',
  message = 'We could not load this content. Please try again.',
  onRetry,
}: ErrorViewProps) => (
  <div
    role="alert"
    style={{
      padding: 'var(--u-page-gutter)',
      textAlign: 'center',
      color: 'var(--u-content-primary)',
    }}
  >
    <h2 style={{ fontFamily: 'var(--u-font-display)', marginBottom: '0.5rem' }}>{title}</h2>
    <p style={{ color: 'var(--u-content-secondary)', marginBottom: '1.5rem' }}>{message}</p>
    {onRetry && (
    <button
      type="button"
      onClick={onRetry}
      style={{
        display: 'inline-block',
        padding: '0 1.5rem',
        height: '52px',
        background: 'var(--u-background-always-dark)',
        color: 'var(--u-content-on-color)',
        border: 'none',
        borderRadius: '8px',
        fontFamily: 'var(--u-font-body)',
        fontWeight: 500,
        fontSize: '16px',
        cursor: 'pointer',
        minWidth: '44px',
      }}
    >
      Try again
    </button>
    )}
  </div>
);
