import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { NavHeader } from '../components/nav-header/NavHeader';

describe('NavHeader', () => {
  it('renders the title as an h1', () => {
    render(<NavHeader title="Driver Safety 101" onBack={jest.fn()} />);
    expect(screen.getByRole('heading', { level: 1, name: /driver safety 101/i })).toBeInTheDocument();
  });

  it('renders a back button with accessible label', () => {
    render(<NavHeader title="Lesson 1" onBack={jest.fn()} />);
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
  });

  it('calls onBack when the back button is clicked', () => {
    const onBack = jest.fn();
    render(<NavHeader title="Lesson 1" onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /go back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders inside a header landmark', () => {
    render(<NavHeader title="Test" onBack={jest.fn()} />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });
});
