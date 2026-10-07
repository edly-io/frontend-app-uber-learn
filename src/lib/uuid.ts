/**
 * crypto.randomUUID() requires a secure context (HTTPS).
 * In local HTTP dev, fall back to a Math.random-based UUID v4.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // RFC 4122 v4 fallback for non-secure contexts (dev over HTTP). The bit operations set the
  // version and variant fields, so no-bitwise doesn't apply.
  /* eslint-disable no-bitwise */
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
  /* eslint-enable no-bitwise */
}
