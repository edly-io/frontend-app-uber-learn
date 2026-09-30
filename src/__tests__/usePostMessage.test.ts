/**
 * Tests for usePostMessage origin validation and message filtering.
 */
import { renderHook, act } from '@testing-library/react';
import { mergeConfig } from '@edx/frontend-platform';
import { usePostMessage } from '../hooks/usePostMessage';

beforeEach(() => {
  mergeConfig({ LMS_BASE_URL: 'https://learn.uber.com' });
});

function dispatchMessage(
  origin: string,
  data: unknown,
): void {
  act(() => {
    const event = new MessageEvent('message', { origin, data });
    window.dispatchEvent(event);
  });
}

describe('usePostMessage', () => {
  it('calls onEvent for valid versioned messages from LMS origin', () => {
    const onEvent = jest.fn();
    renderHook(() => usePostMessage(onEvent));

    dispatchMessage('https://learn.uber.com', {
      type: 'plugin.completed',
      payload: { correct: true },
      version: 1,
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith('plugin.completed', { correct: true });
  });

  it('rejects messages from a different origin', () => {
    const onEvent = jest.fn();
    renderHook(() => usePostMessage(onEvent));

    dispatchMessage('https://evil.example.com', {
      type: 'plugin.completed',
      payload: {},
      version: 1,
    });

    expect(onEvent).not.toHaveBeenCalled();
  });

  it('rejects messages from a subdomain of the LMS origin', () => {
    const onEvent = jest.fn();
    renderHook(() => usePostMessage(onEvent));

    dispatchMessage('https://sub.learn.uber.com', {
      type: 'plugin.completed',
      payload: {},
      version: 1,
    });

    expect(onEvent).not.toHaveBeenCalled();
  });

  it('drops messages without a version field', () => {
    const onEvent = jest.fn();
    renderHook(() => usePostMessage(onEvent));

    dispatchMessage('https://learn.uber.com', {
      type: 'plugin.completed',
      payload: {},
      // version intentionally omitted
    });

    expect(onEvent).not.toHaveBeenCalled();
  });

  it('drops messages where type is not a string', () => {
    const onEvent = jest.fn();
    renderHook(() => usePostMessage(onEvent));

    dispatchMessage('https://learn.uber.com', {
      type: 42,
      payload: {},
      version: 1,
    });

    expect(onEvent).not.toHaveBeenCalled();
  });

  it('drops messages where data is null', () => {
    const onEvent = jest.fn();
    renderHook(() => usePostMessage(onEvent));

    dispatchMessage('https://learn.uber.com', null);

    expect(onEvent).not.toHaveBeenCalled();
  });

  it('removes the event listener on unmount', () => {
    const onEvent = jest.fn();
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => usePostMessage(onEvent));
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });

  it('handles plugin.resize events from LMS origin', () => {
    const onEvent = jest.fn();
    renderHook(() => usePostMessage(onEvent));

    dispatchMessage('https://learn.uber.com', {
      type: 'plugin.resize',
      payload: { height: 600 },
      version: 1,
    });

    expect(onEvent).toHaveBeenCalledWith('plugin.resize', { height: 600 });
  });
});
