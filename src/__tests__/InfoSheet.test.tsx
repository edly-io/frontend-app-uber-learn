/**
 * Tests for InfoSheet component.
 *
 * AC coverage:
 *   IS-NULL:        returns null when data is null
 *   IS-RENDERS:     renders title, bullet items, and Done button when data is provided
 *   IS-BACKDROP:    onClose fires when backdrop is clicked
 *   IS-DONE-BTN:    onClose fires when Done button is clicked
 *   IS-ARIA:        dialog role and aria-modal are present when open
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { InfoSheet } from '../components/ui/InfoSheet';

// useFocusTrap manages focus and Escape — stub it for unit tests
jest.mock('../hooks/useFocusTrap', () => ({
  useFocusTrap: jest.fn(),
}));

const DATA = {
  title: 'Why this matters',
  bullets: ['Keeps you safe', 'Required by law', 'Reduces accidents'],
};

describe('InfoSheet', () => {
  it('IS-NULL: returns null when data is null', () => {
    const { container } = render(<InfoSheet data={null} onClose={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('IS-RENDERS: renders title and all bullet items when data is provided', () => {
    render(<InfoSheet data={DATA} onClose={jest.fn()} />);
    expect(screen.getByRole('heading', { name: 'Why this matters' })).toBeInTheDocument();
    expect(screen.getByText('Keeps you safe')).toBeInTheDocument();
    expect(screen.getByText('Required by law')).toBeInTheDocument();
    expect(screen.getByText('Reduces accidents')).toBeInTheDocument();
  });

  it('IS-DONE-BTN: onClose fires when Done button is clicked', () => {
    const onClose = jest.fn();
    render(<InfoSheet data={DATA} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /done/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('IS-BACKDROP: onClose fires when backdrop overlay is clicked', () => {
    const onClose = jest.fn();
    render(<InfoSheet data={DATA} onClose={onClose} />);
    // The backdrop div has aria-hidden="true" so query by class
    const backdrop = document.querySelector('.bds-backdrop') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('IS-ARIA: dialog has role="dialog" and aria-modal="true"', () => {
    render(<InfoSheet data={DATA} onClose={jest.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
