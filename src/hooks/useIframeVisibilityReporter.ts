import { useCallback, useEffect, type RefObject } from 'react';
import { getLmsOrigin } from '../lib/lms';

/**
 * How often the iframe's visibility is re-sent to the LMS. The unit iframe scrolls
 * internally (see content-iframe.scss), and the parent cannot observe scrolling inside a
 * cross-origin frame. Periodic reports let the LMS re-check which blocks are on screen as
 * the learner scrolls.
 */
export const VISIBILITY_REPORT_INTERVAL_MS = 1_000;

/** Minimum gap between reports triggered by parent scroll/resize events. */
const SCROLL_THROTTLE_MS = 100;

export const UNIT_VISIBILITY_MESSAGE = 'unit.visibilityStatus';

/**
 * Sends `unit.visibilityStatus` to the LMS unit iframe, mirroring frontend-app-learning's
 * useIFrameBehavior.
 *
 * Why this is required: when the LMS vertical runs inside an iframe, its complete-on-view
 * tracker (lms/static/completion/js/ViewedEvent.js) does not watch the DOM. It only reacts to
 * these messages from the parent. Without them, HTML (and other complete-on-view) blocks are
 * never marked complete via publish_completion, so the sequence's get_completion handler
 * returns {"complete": false} for any unit that contains them.
 *
 * Returns a callback to send a report right away, e.g. from the iframe's onLoad.
 */
export function useIframeVisibilityReporter(
  frameRef: RefObject<HTMLIFrameElement | null>,
): () => void {
  const report = useCallback(() => {
    const frame = frameRef.current;
    const target = frame?.contentWindow;
    if (!frame || !target) { return; }
    const rect = frame.getBoundingClientRect();
    // targetOrigin is the LMS origin, so the browser drops the message if the frame has
    // navigated somewhere else (or is still about:blank).
    target.postMessage(
      {
        type: UNIT_VISIBILITY_MESSAGE,
        data: { topPosition: rect.top, viewportHeight: window.innerHeight },
      },
      getLmsOrigin(),
    );
  }, [frameRef]);

  useEffect(() => {
    let lastEventReportAt = -Infinity;
    const onScrollOrResize = (): void => {
      const now = Date.now();
      if (now - lastEventReportAt < SCROLL_THROTTLE_MS) { return; }
      lastEventReportAt = now;
      report();
    };

    const intervalId = window.setInterval(report, VISIBILITY_REPORT_INTERVAL_MS);
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [report]);

  return report;
}
