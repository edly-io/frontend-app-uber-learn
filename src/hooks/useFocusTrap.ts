import { useEffect, useRef } from 'react';

/**
 * Focusable element selector covering all interactive roles.
 * Matches the WCAG 2.1 guidance on keyboard-operable content.
 */
const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * useFocusTrap — WCAG 2.1 SC 2.4.3 / SC 2.1.2 focus management for modal dialogs.
 *
 * When `isOpen` becomes true:
 *  - Saves the previously-focused element so focus can be restored on close.
 *  - Moves focus to the first focusable element inside `ref.current`.
 *  - Traps Tab / Shift+Tab cycling within `ref.current`.
 *  - Listens for Escape and calls `onClose`.
 *
 * All listeners are removed and focus is restored when `isOpen` becomes false
 * or the component unmounts.
 *
 * @param ref     - Ref attached to the dialog container element.
 * @param isOpen  - Whether the dialog is currently open.
 * @param onClose - Callback that closes the dialog (e.g. setState(false)).
 *                  Wrap in useCallback when the reference is unstable.
 */
export function useFocusTrap(
  ref: React.RefObject<HTMLElement | null>,
  isOpen: boolean,
  onClose: () => void,
): void {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) { return undefined; }

    const container = ref.current;
    if (!container) { return undefined; }

    // Remember the element that triggered the dialog open so we can return to it.
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const getFocusableElements = (): HTMLElement[] => {
      const selector = FOCUSABLE_SELECTORS;
      return Array.from(container.querySelectorAll<HTMLElement>(selector));
    };

    // Move focus into the dialog on open.
    const initialFocusables = getFocusableElements();
    if (initialFocusables.length > 0) {
      initialFocusables[0].focus();
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      // SC 2.1.2: Escape closes the dialog.
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') { return; }

      const focusableEls = getFocusableElements();
      if (focusableEls.length === 0) { return; }

      const first = focusableEls[0];
      const last = focusableEls[focusableEls.length - 1];

      if (event.shiftKey) {
        // Shift+Tab from the first element wraps to the last.
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        // Tab from the last element wraps to the first.
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // SC 2.4.3: Restore focus to the trigger element on close.
      previousFocusRef.current?.focus();
    };
  // ref is a stable RefObject; onClose callers should wrap with useCallback if needed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onClose]);
}
