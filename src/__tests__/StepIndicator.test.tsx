import React from 'react';
import { render, screen } from '@testing-library/react';
import { StepIndicator } from '../components/step-indicator/StepIndicator';

describe('StepIndicator', () => {
  it('renders an accessible label describing the current step', () => {
    render(<StepIndicator current={1} total={5} />);
    expect(screen.getByLabelText('Step 2 of 5')).toBeInTheDocument();
  });

  it('renders a progress fill bar for the current step', () => {
    const { container } = render(<StepIndicator current={0} total={3} />);
    // Progress bar: single fill div with aria-hidden, width reflects step 1/3
    const fill = container.querySelectorAll('[aria-hidden="true"]');
    expect(fill).toHaveLength(1);
    expect((fill[0] as HTMLElement).style.width).toBe('33%');
  });
});
