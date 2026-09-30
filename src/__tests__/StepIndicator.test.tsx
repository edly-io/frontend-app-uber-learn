import React from 'react';
import { render, screen } from '@testing-library/react';
import { StepIndicator } from '../components/step-indicator/StepIndicator';

describe('StepIndicator', () => {
  it('renders an accessible label describing the current step', () => {
    render(<StepIndicator current={1} total={5} />);
    expect(screen.getByLabelText('Step 2 of 5')).toBeInTheDocument();
  });

  it('renders the correct number of step segments', () => {
    const { container } = render(<StepIndicator current={0} total={3} />);
    // Each step segment is a div inside the indicator
    const segments = container.querySelectorAll('[aria-hidden="true"]');
    expect(segments).toHaveLength(3);
  });
});
