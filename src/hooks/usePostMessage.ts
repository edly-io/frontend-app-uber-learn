import { useEffect, type RefObject } from 'react';
import { getLmsOrigin } from '../lib/lms';

/**
 * Listens for postMessage events from the XBlock iframe hosted on the LMS
 * origin and calls the provided callback for each valid event.
 *
 * Security:
 *  - Rejects messages from any origin other than the configured LMS.
 *  - When `expectedSource` is provided, rejects messages whose source window
 *    does not match the referenced iframe — prevents another LMS-origin window
 *    from spoofing plugin.completed for whichever lesson is active.
 *  - Drops messages where `type` is not a string.
 *
 * Note: `version` is intentionally NOT required — the standard Open edX video
 * XBlock sends `plugin.videoEnded` without a version field.
 */
export function usePostMessage(
  onEvent: (type: string, payload: unknown) => void,
  expectedSource?: RefObject<HTMLIFrameElement | null>,
): void {
  useEffect(() => {
    const handler = (event: MessageEvent): void => {
      // Strict origin check — reject anything not from the LMS.
      if (event.origin !== getLmsOrigin()) { return; }

      // Source window check — reject messages from sibling/unrelated LMS frames.
      // Only enforce when both sides are non-null: a null event.source means the
      // environment couldn't set it (programmatic dispatch in tests), and a null
      // expected window means the iframe hasn't mounted yet.
      if (expectedSource !== undefined) {
        const expected = expectedSource.current?.contentWindow;
        if (expected != null && event.source != null && event.source !== expected) { return; }
      }

      const { type, payload } = (event.data ?? {}) as Record<string, unknown>;

      // Drop malformed messages.
      if (typeof type !== 'string') { return; }

      onEvent(type, payload);
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onEvent, expectedSource]);
}
