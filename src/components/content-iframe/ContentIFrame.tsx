import React, { useCallback } from 'react';
import { usePostMessage } from '../../hooks/usePostMessage';
import { buildXBlockUrl } from '../../lib/xblock-url';
import './content-iframe.css';

interface ContentIFrameProps {
  usageKey: string;
  onCompleted: (correct: boolean | null) => void;
  onLoad?: () => void;
}

export const ContentIFrame = ({ usageKey, onCompleted, onLoad }: ContentIFrameProps) => {
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
