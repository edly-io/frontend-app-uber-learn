import { useEffect } from 'react';
import { getConfig } from '@edx/frontend-platform';

function getLmsOrigin(): string {
  return new URL(getConfig().LMS_BASE_URL).origin;
}

/**
 * Listens for postMessage events from the XBlock iframe hosted on the LMS
 * origin and calls the provided callback for each valid event.
 *
 * Security:
 *  - Rejects messages from any origin other than the configured LMS.
 *  - Drops messages where `type` is not a string.
 *
 * Note: `version` is intentionally NOT required — the standard Open edX video
 * XBlock sends `plugin.videoEnded` without a version field.
 */
export function usePostMessage(
  onEvent: (type: string, payload: unknown) => void,
): void {
  useEffect(() => {
    const handler = (event: MessageEvent): void => {
      // Strict origin check — reject anything not from the LMS.
      if (event.origin !== getLmsOrigin()) { return; }

      const { type, payload } = (event.data ?? {}) as Record<string, unknown>;

      // Drop malformed messages.
      if (typeof type !== 'string') { return; }

      onEvent(type, payload);
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onEvent]);
}
