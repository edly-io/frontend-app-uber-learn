/**
 * API client — wraps @edx/frontend-platform's authenticated HTTP client.
 *
 * Do NOT create a custom axios instance here. The platform already sets up
 * JWT cookie handling and refresh interceptors on the client returned by
 * getAuthenticatedHttpClient().
 */
export { getAuthenticatedHttpClient as apiClient } from '@edx/frontend-platform/auth';
