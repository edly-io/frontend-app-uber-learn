/**
 * Tests for the footer actions of SystemStateView (and ErrorView, which wraps it).
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SystemStateView } from '../components/ui/SystemStateView';
import { ErrorView } from '../components/ui/ErrorView';

function footerButtons(): Array<[string, string]> {
  return Array.from(document.querySelectorAll('.ss-footer > button'))
    .map((button) => [button.textContent ?? '', button.className]);
}

describe('SystemStateView footer', () => {
  it('has no footer without actions', () => {
    render(<SystemStateView art="art.svg" title="Title" message="Message" />);

    expect(document.querySelector('.ss-footer')).toBeNull();
  });

  it('shows the main action alone', () => {
    const onAction = jest.fn();
    render(<SystemStateView art="art.svg" title="Title" message="Message" buttonLabel="Close" onAction={onAction} />);

    expect(footerButtons()).toEqual([['Close', 'ss-footer__btn']]);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('shows the secondary action under the main one', () => {
    const onAction = jest.fn();
    const onSecondaryAction = jest.fn();
    render(
      <SystemStateView
        art="art.svg"
        title="Title"
        message="Message"
        buttonLabel="Try again"
        onAction={onAction}
        secondaryLabel="Go home"
        onSecondaryAction={onSecondaryAction}
      />,
    );

    expect(footerButtons()).toEqual([
      ['Try again', 'ss-footer__btn'],
      ['Go home', 'ss-footer__secondary'],
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Go home' }));
    expect(onSecondaryAction).toHaveBeenCalledTimes(1);
    expect(onAction).not.toHaveBeenCalled();
  });

  it('ignores a label without a handler', () => {
    render(<SystemStateView art="art.svg" title="Title" message="Message" buttonLabel="Close" secondaryLabel="Go home" />);

    expect(document.querySelector('.ss-footer')).toBeNull();
  });
});

describe('ErrorView footer', () => {
  it('keeps "Try again" as the onRetry action', () => {
    const onRetry = jest.fn();
    render(<ErrorView onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('passes the secondary action through', () => {
    const onSecondaryAction = jest.fn();
    render(<ErrorView onRetry={jest.fn()} secondaryLabel="Go home" onSecondaryAction={onSecondaryAction} />);

    expect(footerButtons()).toEqual([
      ['Try again', 'ss-footer__btn'],
      ['Go home', 'ss-footer__secondary'],
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Go home' }));
    expect(onSecondaryAction).toHaveBeenCalledTimes(1);
  });
});
