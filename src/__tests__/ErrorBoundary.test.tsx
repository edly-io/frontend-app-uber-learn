/**
 * Tests for ErrorBoundary component.
 *
 * AC coverage:
 *   EB-PASS:     renders children when no error is thrown
 *   EB-CATCH:    renders default fallback when child throws
 *   EB-CUSTOM:   renders custom fallback prop when provided and child throws
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';

// Suppress console.error for throw tests so Jest output stays clean
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  (console.error as jest.Mock).mockRestore();
});

const ThrowingChild = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) { throw new Error('Test error'); }
  return <div>Child content</div>;
};

describe('ErrorBoundary', () => {
  it('EB-PASS: renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('EB-CATCH: renders default fallback when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
  });

  it('EB-CUSTOM: renders custom fallback prop when provided and child throws', () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowingChild shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Custom fallback')).toBeInTheDocument();
    expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument();
  });
});
