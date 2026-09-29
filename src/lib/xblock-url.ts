import { getConfig } from '@edx/frontend-platform';

/**
 * Builds the URL for an XBlock iframe source.
 * The iframe is served from the LMS domain, not the MFE domain.
 *
 * @param usageKey - The XBlock usage key (e.g. block-v1:Org+Course+Run+type@html+block@abc123)
 * @returns Fully-qualified URL for the XBlock iframe src attribute
 */
export function buildXBlockUrl(usageKey: string): string {
  const lmsBase = getConfig().LMS_BASE_URL;
  return `${lmsBase}/xblock/${usageKey}`;
}
