import React, { useCallback, useEffect } from 'react';
import { usePostMessage } from '../../hooks/usePostMessage';
import { buildXBlockUrl } from '../../lib/xblock-url';
import './content-iframe.scss';

interface ContentIFrameProps {
  usageKey: string;
  onCompleted: (correct: boolean | null) => void;
  onLoad?: () => void;
  onVideoError?: () => void;
}

export const ContentIFrame = React.forwardRef<HTMLIFrameElement, ContentIFrameProps>(
  ({
    usageKey, onCompleted, onLoad, onVideoError,
  }, ref) => {
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
          case 'plugin.videoError':
            onVideoError?.();
            break;
          default:
            break;
        }
      },
      [onCompleted, onVideoError],
    );

    usePostMessage(handleEvent);

    // YouTube sends {"event": "onStateChange", "info": 0} (info=0 means ended)
    // directly to window when the player is embedded. This catches video-end
    // events on HTTP dev environments where the Open edX XBlock bridge may not
    // fire plugin.videoEnded because the YouTube JS API is unreliable over HTTP.
    useEffect(() => {
      const ytHandler = (event: MessageEvent): void => {
        if (event.origin !== 'https://www.youtube.com') { return; }
        try {
          const data = typeof event.data === 'string'
            ? JSON.parse(event.data) as Record<string, unknown>
            : event.data as Record<string, unknown>;
          if (data?.event === 'onStateChange' && data?.info === 0) {
            onCompleted(null);
          }
        } catch { /* malformed message — ignore */ }
      };
      window.addEventListener('message', ytHandler);
      return () => window.removeEventListener('message', ytHandler);
    }, [onCompleted]);

    return (
      <div className="content-iframe-wrapper">
        <iframe
          ref={ref}
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
  },
);

ContentIFrame.displayName = 'ContentIFrame';
