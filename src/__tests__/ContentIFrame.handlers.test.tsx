/**
 * Tests for ContentIFrame plugin-message event handlers.
 *
 * The handleEvent switch inside ContentIFrame processes postMessage events from
 * the LMS iframe. Each case adds a branch; these were at 0% coverage.
 *
 * AC coverage:
 *   CIF-COMPLETED-CORRECT:   plugin.completed with correct=true calls onCompleted(true)
 *   CIF-COMPLETED-WRONG:     plugin.completed with correct=false calls onCompleted(false)
 *   CIF-COMPLETED-NO-BOOL:   plugin.completed without a boolean correct calls onCompleted(null)
 *   CIF-VIDEO-ENDED:         plugin.videoEnded calls onCompleted(null)
 *   CIF-TRANSCRIPT-VALID:    plugin.openTranscript with valid usageId calls onTranscriptRequest
 *   CIF-TRANSCRIPT-EMPTY:    plugin.openTranscript with empty usageId does NOT call onTranscriptRequest
 *   CIF-TRANSCRIPT-NONE:     plugin.openTranscript when no onTranscriptRequest prop is noop
 */
import React from 'react';
import { render, act } from '@testing-library/react';
import { mergeConfig } from '@edx/frontend-platform';
import { ContentIFrame } from '../components/content-iframe/ContentIFrame';

const LMS_ORIGIN = 'https://learn.uber.com';
const USAGE_KEY = 'block-v1:Org+C+R+type@html+block@h1';

beforeEach(() => {
  mergeConfig({ LMS_BASE_URL: LMS_ORIGIN });
});

function renderFrame(props: Partial<React.ComponentProps<typeof ContentIFrame>> = {}) {
  const utils = render(<ContentIFrame usageKey={USAGE_KEY} {...props} />);
  const frame = utils.container.querySelector<HTMLIFrameElement>('iframe')!;
  return { frame };
}

function dispatchPlugin(frame: HTMLIFrameElement, type: string, payload: Record<string, unknown>) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: LMS_ORIGIN,
        source: frame.contentWindow,
        data: { type, payload, version: 1 },
      }),
    );
  });
}

describe('ContentIFrame plugin-message handlers', () => {
  it('CIF-COMPLETED-CORRECT: plugin.completed with correct=true calls onCompleted(true)', () => {
    const onCompleted = jest.fn();
    const { frame } = renderFrame({ onCompleted });
    dispatchPlugin(frame, 'plugin.completed', { correct: true });
    expect(onCompleted).toHaveBeenCalledWith(true);
  });

  it('CIF-COMPLETED-WRONG: plugin.completed with correct=false calls onCompleted(false)', () => {
    const onCompleted = jest.fn();
    const { frame } = renderFrame({ onCompleted });
    dispatchPlugin(frame, 'plugin.completed', { correct: false });
    expect(onCompleted).toHaveBeenCalledWith(false);
  });

  it('CIF-COMPLETED-NO-BOOL: plugin.completed without boolean correct calls onCompleted(null)', () => {
    const onCompleted = jest.fn();
    const { frame } = renderFrame({ onCompleted });
    dispatchPlugin(frame, 'plugin.completed', { correct: 'yes' }); // string, not boolean
    expect(onCompleted).toHaveBeenCalledWith(null);
  });

  it('CIF-VIDEO-ENDED: plugin.videoEnded calls onCompleted(null)', () => {
    const onCompleted = jest.fn();
    const { frame } = renderFrame({ onCompleted });
    dispatchPlugin(frame, 'plugin.videoEnded', {});
    expect(onCompleted).toHaveBeenCalledWith(null);
  });

  it('CIF-TRANSCRIPT-VALID: plugin.openTranscript calls onTranscriptRequest with the usageId', () => {
    const onTranscriptRequest = jest.fn();
    const { frame } = renderFrame({ onTranscriptRequest });
    dispatchPlugin(frame, 'plugin.openTranscript', { usageId: 'block-v1:unit-123' });
    expect(onTranscriptRequest).toHaveBeenCalledWith('block-v1:unit-123');
  });

  it('CIF-TRANSCRIPT-EMPTY: plugin.openTranscript with empty string does NOT call onTranscriptRequest', () => {
    const onTranscriptRequest = jest.fn();
    const { frame } = renderFrame({ onTranscriptRequest });
    dispatchPlugin(frame, 'plugin.openTranscript', { usageId: '' });
    expect(onTranscriptRequest).not.toHaveBeenCalled();
  });

  it('CIF-TRANSCRIPT-NONE: plugin.openTranscript without onTranscriptRequest prop is a noop', () => {
    const { frame } = renderFrame(); // no onTranscriptRequest
    // Should not throw
    expect(() => {
      dispatchPlugin(frame, 'plugin.openTranscript', { usageId: 'block-v1:unit-123' });
    }).not.toThrow();
  });
});
