import React, { useCallback, useEffect, useRef } from 'react';
import { getConfig } from '@edx/frontend-platform';
import { usePostMessage } from '../../hooks/usePostMessage';
import { buildXBlockUrl } from '../../lib/xblock-url';
import './content-iframe.css';

function getLmsOrigin(): string {
  return new URL(getConfig().LMS_BASE_URL).origin;
}

interface ContentIFrameProps {
  usageKey: string;
  onCompleted: (correct: boolean | null) => void;
  onLoad?: () => void;
  /**
   * Called once, when the unit's content has been rendered inside the iframe.
   *
   * The LMS (courseware-chromeless.html) posts an unversioned `plugin.resize` as soon as the
   * unit's DOM is built. That is usually well before the iframe's `load` event, which also waits
   * for subresources such as a video's first frame.
   */
  onContentReady?: () => void;
}

export const ContentIFrame = ({
  usageKey, onCompleted, onLoad, onContentReady,
}: ContentIFrameProps) => {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!onContentReady) { return undefined; }
    let fired = false;
    const handler = (event: MessageEvent): void => {
      // Only this unit's iframe, from the LMS origin. plugin.resize has no `version`, so
      // usePostMessage drops it.
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
        default:
          break;
      }
    },
    [onCompleted],
  );

  usePostMessage(handleEvent);

  return (
    <div className="content-iframe-wrapper">
      <iframe
        ref={frameRef}
        className="content-iframe-frame"
        src={buildXBlockUrl(usageKey)}
        title="Course activity"
        allow="autoplay; fullscreen"
        data-usage-key={usageKey}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        onLoad={onLoad}
      />
    </div>
  );
};
