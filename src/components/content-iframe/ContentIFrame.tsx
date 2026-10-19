import React, { useCallback, useEffect, useRef } from 'react';
import { usePostMessage } from '../../hooks/usePostMessage';
import { useIframeVisibilityReporter } from '../../hooks/useIframeVisibilityReporter';
import { getLmsOrigin } from '../../lib/lms';
import { buildXBlockUrl } from '../../lib/xblock-url';
import './content-iframe.scss';

/**
 * Feature policy for the XBlock iframe. Mirrors frontend-app-learning's IFRAME_FEATURE_POLICY,
 * reviewed and approved by the edX Security Working Group (security@edx.org).
 * Wildcards are required because XBlock content (e.g. LTI consumer) may embed external iframes.
 * encrypted-media is required so nested video iframes (YouTube, Vimeo) can use the EME API.
 */
export const IFRAME_FEATURE_POLICY = 'microphone *; camera *; midi *; geolocation *; encrypted-media *; clipboard-write *; autoplay *; fullscreen *';

interface ContentIFrameProps {
  usageKey: string;
  onCompleted?: (correct: boolean | null) => void;
  onLoad?: () => void;
  /**
   * Called once, when the unit's content has been rendered inside the iframe.
   *
   * The LMS (courseware-chromeless.html) posts an unversioned `plugin.resize` as soon as the
   * unit's DOM is built. That is usually well before the iframe's `load` event, which also waits
   * for subresources such as a video's first frame.
   */
  onContentReady?: () => void;
  /** Called when the iframe fails to load (network error or server error response). */
  onError?: () => void;
  /**
   * Called when the XBlock asks the MFE to open the transcript panel.
   * Payload is the block's own usageId (the unit key, not the sequence key).
   * Sent by the video XBlock's "Read the transcript" button via plugin.openTranscript.
   */
  onTranscriptRequest?: (usageId: string) => void;
}

export const ContentIFrame = ({
  usageKey, onCompleted = () => {}, onLoad, onContentReady, onError, onTranscriptRequest,
}: ContentIFrameProps) => {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!onContentReady) { return undefined; }
    let fired = false;
    const handler = (event: MessageEvent): void => {
      // Only this unit's iframe, from the LMS origin. plugin.resize is handled here
      // directly via addEventListener because usePostMessage routes named events
      // to handleEvent (which ignores plugin.resize); this handler fires first.
      if (fired || event.origin !== getLmsOrigin() || event.source !== frameRef.current?.contentWindow) { return; }
      if ((event.data as { type?: unknown } | null)?.type !== 'plugin.resize') { return; }
      fired = true;
      onContentReady();
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onContentReady]);

  const handleEvent = useCallback(
    (type: string, payload: unknown) => {
      const p = payload as Record<string, unknown> | undefined;
      switch (type) {
        case 'plugin.resize':
          // Ignored — the iframe fills the main area via CSS flex; XBlock scrolls internally.
          break;
        case 'plugin.completed': {
          const correct = typeof (p as { correct?: unknown } | undefined)?.correct === 'boolean'
            ? (p as { correct: boolean }).correct
            : null;
          onCompleted(correct);
          break;
        }
        case 'plugin.videoEnded':
          onCompleted(null);
          break;
        case 'plugin.openTranscript': {
          const usageId = (p as { usageId?: unknown } | undefined)?.usageId;
          if (typeof usageId === 'string' && usageId) {
            onTranscriptRequest?.(usageId);
          }
          break;
        }
        default:
          break;
      }
    },
    [onCompleted, onTranscriptRequest],
  );

  usePostMessage(handleEvent, frameRef);

  // Drives LMS complete-on-view for HTML blocks; without it get_completion never turns true.
  const reportVisibility = useIframeVisibilityReporter(frameRef);
  const handleLoad = useCallback(() => {
    reportVisibility();
    onLoad?.();
  }, [reportVisibility, onLoad]);

  return (
    <div className="content-iframe-wrapper">
      <iframe
        ref={frameRef}
        className="content-iframe-frame"
        src={buildXBlockUrl(usageKey)}
        title="Course activity"
        // Restore all permissions needed by XBlock content (downloads, modals, presentation,
        // popups-to-escape-sandbox for OAuth flows) while explicitly omitting
        // allow-top-navigation — without it a bad XBlock cannot navigate the Uber WebView
        // away from the app, which has no URL bar or back button to recover from.
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals allow-presentation"
        allow={IFRAME_FEATURE_POLICY}
        referrerPolicy="origin"
        data-usage-key={usageKey}
        onLoad={handleLoad}
        onError={onError}
      />
    </div>
  );
};
