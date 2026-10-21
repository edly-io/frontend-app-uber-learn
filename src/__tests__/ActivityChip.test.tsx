import React from 'react';
import { render, screen } from '@testing-library/react';
import { ActivityChip, getChipType } from '../components/activity-chip/ActivityChip';

describe('getChipType', () => {
  it('returns practice for contentType problem', () => {
    expect(getChipType('problem', false)).toBe('practice');
  });

  it('returns practice for graded custom XBlock', () => {
    expect(getChipType('other', true)).toBe('practice');
  });

  it('returns learn for non-graded other content', () => {
    expect(getChipType('other', false)).toBe('learn');
  });

  it('returns watch for video content type', () => {
    expect(getChipType('video', false)).toBe('watch');
  });
});

describe('ActivityChip', () => {
  it('renders Learn chip with correct label', () => {
    render(<ActivityChip type="learn" />);
    expect(screen.getByText('Learn')).toBeInTheDocument();
  });

  it('renders Practice chip with correct label', () => {
    render(<ActivityChip type="practice" />);
    expect(screen.getByText('Practice')).toBeInTheDocument();
  });

  it('applies learn modifier class for learn type', () => {
    const { container } = render(<ActivityChip type="learn" />);
    expect(container.firstChild).toHaveClass('activity-chip--learn');
  });

  it('applies practice modifier class for practice type', () => {
    const { container } = render(<ActivityChip type="practice" />);
    expect(container.firstChild).toHaveClass('activity-chip--practice');
  });

  it('renders Watch chip with correct label', () => {
    render(<ActivityChip type="watch" />);
    expect(screen.getByText('Watch')).toBeInTheDocument();
  });

  it('applies watch modifier class for watch type', () => {
    const { container } = render(<ActivityChip type="watch" />);
    expect(container.firstChild).toHaveClass('activity-chip--watch');
  });
});
