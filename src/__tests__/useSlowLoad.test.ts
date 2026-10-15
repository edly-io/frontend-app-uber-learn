/**
 * Unit tests for useSlowLoad hook.
 *
 * AC coverage:
 *   SL-NOT-LOADING:   returns false immediately when isLoading is false
 *   SL-LOADING-FAST:  returns false while loading if timeout hasn't elapsed
 *   SL-LOADING-SLOW:  returns true after timeout elapses while still loading
 *   SL-RESET:         resets to false when isLoading goes back to false
 *   SL-CUSTOM-TIMEOUT: respects a custom timeoutMs value
 */
import { renderHook, act } from '@testing-library/react';
import { useSlowLoad } from '../hooks/useSlowLoad';

describe('useSlowLoad', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('SL-NOT-LOADING: returns false when not loading', () => {
    const { result } = renderHook(() => useSlowLoad(false));
    expect(result.current).toBe(false);
  });

  it('SL-LOADING-FAST: returns false while loading before timeout', () => {
    const { result } = renderHook(() => useSlowLoad(true, 3000));
    act(() => jest.advanceTimersByTime(2999));
    expect(result.current).toBe(false);
  });

  it('SL-LOADING-SLOW: returns true after timeout elapses while still loading', () => {
    const { result } = renderHook(() => useSlowLoad(true, 3000));
    act(() => jest.advanceTimersByTime(3000));
    expect(result.current).toBe(true);
  });

  it('SL-RESET: resets to false when isLoading becomes false', () => {
    let isLoading = true;
    const { result, rerender } = renderHook(() => useSlowLoad(isLoading, 3000));
    act(() => jest.advanceTimersByTime(3000));
    expect(result.current).toBe(true);

    isLoading = false;
    rerender();
    expect(result.current).toBe(false);
  });

  it('SL-CUSTOM-TIMEOUT: respects a custom timeoutMs', () => {
    const { result } = renderHook(() => useSlowLoad(true, 500));
    act(() => jest.advanceTimersByTime(499));
    expect(result.current).toBe(false);
    act(() => jest.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });
});
