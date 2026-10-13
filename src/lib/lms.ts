import { getConfig } from '@edx/frontend-platform';

/**
 * Returns the LMS origin (scheme + host) used for postMessage origin checks
 * and XBlock iframe URL construction.
 *
 * Extracted here to avoid duplication across ActivityView, ContentIFrame,
 * and usePostMessage.
 */
export function getLmsOrigin(): string {
  return new URL(getConfig().LMS_BASE_URL).origin;
}
