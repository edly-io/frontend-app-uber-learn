import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ButtonDock } from '../components/button-dock/ButtonDock';

describe('ButtonDock', () => {
  it('renders the Continue button', () => {
    render(<ButtonDock onContinue={jest.fn()} />);
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  it('uses a custom label when provided', () => {
    render(<ButtonDock onContinue={jest.fn()} label="Finish" />);
    expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument();
  });

  it('is disabled when disabled=true', () => {
    render(<ButtonDock onContinue={jest.fn()} disabled />);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-disabled', 'true');
  });

  it('is enabled when disabled=false', () => {
    render(<ButtonDock onContinue={jest.fn()} disabled={false} />);
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('calls onContinue when clicked', () => {
    const onContinue = jest.fn();
    render(<ButtonDock onContinue={onContinue} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('does not call onContinue when disabled', () => {
    const onContinue = jest.fn();
    render(<ButtonDock onContinue={onContinue} disabled />);
    // Disabled buttons don't fire click events
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(onContinue).not.toHaveBeenCalled();
  });
});
