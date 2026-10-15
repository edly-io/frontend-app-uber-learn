/**
 * Unit tests for useOffline hook.
 *
 * AC coverage:
 *   UO-INIT-ONLINE:   starts false when navigator.onLine is true
 *   UO-INIT-OFFLINE:  starts true when navigator.onLine is false
 *   UO-GO-OFFLINE:    transitions to true on 'offline' event
 *   UO-GO-ONLINE:     transitions back to false on 'online' event
 *   UO-CLEANUP:       removes event listeners on unmount
 */
import { renderHook, act } from '@testing-library/react';
import { useOffline } from '../hooks/useOffline';

describe('useOffline', () => {
  const originalOnline = Object.getOwnPropertyDescriptor(navigator, 'onLine');

  function setNavigatorOnline(value: boolean) {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value });
  }

  afterEach(() => {
    if (originalOnline) {
      Object.defineProperty(navigator, 'onLine', originalOnline);
    }
  });

  it('UO-INIT-ONLINE: returns false when navigator.onLine is true', () => {
    setNavigatorOnline(true);
    const { result } = renderHook(() => useOffline());
    expect(result.current).toBe(false);
  });

  it('UO-INIT-OFFLINE: returns true when navigator.onLine is false', () => {
    setNavigatorOnline(false);
    const { result } = renderHook(() => useOffline());
    expect(result.current).toBe(true);
  });

  it('UO-GO-OFFLINE: transitions to true on offline event', () => {
    setNavigatorOnline(true);
    const { result } = renderHook(() => useOffline());
    expect(result.current).toBe(false);

    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(result.current).toBe(true);
  });

  it('UO-GO-ONLINE: transitions back to false on online event', () => {
    setNavigatorOnline(false);
    const { result } = renderHook(() => useOffline());
    expect(result.current).toBe(true);

    act(() => { window.dispatchEvent(new Event('online')); });
    expect(result.current).toBe(false);
  });

  it('UO-CLEANUP: removes listeners on unmount so no state updates fire', () => {
    setNavigatorOnline(true);
    const { result, unmount } = renderHook(() => useOffline());
    unmount();

    // Dispatching after unmount should not throw or update state.
    expect(() => {
      act(() => { window.dispatchEvent(new Event('offline')); });
    }).not.toThrow();
    // result.current is captured at unmount — it should still be false (no update happened).
    expect(result.current).toBe(false);
  });
});
