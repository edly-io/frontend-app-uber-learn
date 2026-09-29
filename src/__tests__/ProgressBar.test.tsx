import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from '../components/progress-bar/ProgressBar';

describe('ProgressBar', () => {
  it('renders a progressbar role element', () => {
    render(<ProgressBar fraction={0.5} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('sets aria-valuenow based on fraction', () => {
    render(<ProgressBar fraction={0.75} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75');
  });

  it('clamps fraction to 0 minimum', () => {
    render(<ProgressBar fraction={-0.5} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('clamps fraction to 100 maximum', () => {
    render(<ProgressBar fraction={1.5} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('uses the provided label', () => {
    render(<ProgressBar fraction={0.3} label="My progress" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-label', 'My progress');
  });

  it('has correct min/max attributes', () => {
    render(<ProgressBar fraction={0} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });
});
