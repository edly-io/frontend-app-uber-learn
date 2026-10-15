/**
 * Regression tests: ContentIFrame must report its visibility to the LMS iframe.
 *
 * Inside an iframe, the LMS vertical's complete-on-view tracker
 * (lms/static/completion/js/ViewedEvent.js) does not watch the DOM itself. It
 * waits for `unit.visibilityStatus` messages from the parent window. Without
 * them, HTML blocks are never marked complete, so the sequence's get_completion
 * handler keeps returning {"complete": false} for any unit that contains one,
 * and the Continue button stays disabled.
 */
import { render, fireEvent, act } from '@testing-library/react';
import { mergeConfig } from '@edx/frontend-platform';
import { ContentIFrame, IFRAME_FEATURE_POLICY } from '../components/content-iframe/ContentIFrame';

const LMS = 'https://learn.uber.com';
const USAGE_KEY = 'block-v1:Org+C+R+type@vertical+block@v1';

function renderFrame() {
  const utils = render(<ContentIFrame usageKey={USAGE_KEY} />);
  const frame = utils.container.querySelector('iframe') as HTMLIFrameElement;
  const postMessage = jest.spyOn(frame.contentWindow as Window, 'postMessage').mockImplementation(() => {});
  return { ...utils, frame, postMessage };
}

function visibilityCalls(postMessage: jest.SpyInstance) {
  return postMessage.mock.calls.filter(([msg]) => (msg as { type?: string })?.type === 'unit.visibilityStatus');
}

beforeEach(() => {
  jest.useFakeTimers();
  mergeConfig({ LMS_BASE_URL: LMS });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ContentIFrame iframe attributes', () => {
  it('uses the security-reviewed feature policy and a sandbox without allow-top-navigation', () => {
    const { container } = render(<ContentIFrame usageKey={USAGE_KEY} />);
    const frame = container.querySelector('iframe') as HTMLIFrameElement;
    expect(frame.getAttribute('allow')).toBe(IFRAME_FEATURE_POLICY);
    const sandbox = frame.getAttribute('sandbox') ?? '';
    // Must have the permissions XBlocks need
    expect(sandbox).toContain('allow-scripts');
    expect(sandbox).toContain('allow-same-origin');
    expect(sandbox).toContain('allow-forms');
    expect(sandbox).toContain('allow-popups');
    expect(sandbox).toContain('allow-downloads');
    expect(sandbox).toContain('allow-modals');
    // Must NOT allow top-level navigation — WebView has no URL bar or back button
    expect(sandbox).not.toContain('allow-top-navigation');
  });
});

describe('ContentIFrame visibility reporting (complete-on-view)', () => {
  it('posts unit.visibilityStatus to the LMS origin when the iframe loads', () => {
    // Arrange
    const { frame, postMessage } = renderFrame();
    jest.spyOn(frame, 'getBoundingClientRect').mockReturnValue({ top: 64 } as DOMRect);

    // Act
    fireEvent.load(frame);

    // Assert
    const calls = visibilityCalls(postMessage);
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[calls.length - 1]).toEqual([
      { type: 'unit.visibilityStatus', data: { topPosition: 64, viewportHeight: window.innerHeight } },
      LMS,
    ]);
  });

  it('keeps reporting periodically, because the iframe scrolls internally and the parent cannot observe it', () => {
    // Arrange
    const { frame, postMessage } = renderFrame();
    fireEvent.load(frame);
    const afterLoad = visibilityCalls(postMessage).length;

    // Act
    act(() => { jest.advanceTimersByTime(3_000); });

    // Assert
    expect(visibilityCalls(postMessage).length).toBeGreaterThanOrEqual(afterLoad + 3);
  });

  it('reports on parent window scroll and resize', () => {
    // Arrange
    const { frame, postMessage } = renderFrame();
    fireEvent.load(frame);
    const before = visibilityCalls(postMessage).length;

    // Act
    act(() => { window.dispatchEvent(new Event('resize')); });

    // Assert
    expect(visibilityCalls(postMessage).length).toBe(before + 1);
  });

  it('stops reporting after unmount', () => {
    // Arrange
    const { frame, postMessage, unmount } = renderFrame();
    fireEvent.load(frame);
    unmount();
    const before = visibilityCalls(postMessage).length;

    // Act
    act(() => {
      jest.advanceTimersByTime(5_000);
      window.dispatchEvent(new Event('scroll'));
    });

    // Assert
    expect(visibilityCalls(postMessage).length).toBe(before);
  });
});
