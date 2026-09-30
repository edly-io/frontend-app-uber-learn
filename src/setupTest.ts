// eslint-disable-next-line import/no-extraneous-dependencies
import '@testing-library/jest-dom';
import { configure as configureAuth, MockAuthService } from '@edx/frontend-platform/auth';
import { configure as configureLogging } from '@edx/frontend-platform/logging';
import { getConfig, mergeConfig } from '@edx/frontend-platform';

class MockLoggingService {
  // eslint-disable-next-line no-console
  logInfo = jest.fn((msg: string) => console.log(msg));

  // eslint-disable-next-line no-console
  logError = jest.fn((msg: string) => console.log(msg));
}

// Seed config from env — intentional use of `any` to avoid @types/node
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const envVars: Record<string, string | undefined> = (globalThis as any).process?.env ?? {};
mergeConfig({
  ...envVars,
  LMS_BASE_URL: envVars.LMS_BASE_URL ?? 'http://localhost:18000',
});

export const initializeMockApp = () => {
  const loggingService = configureLogging(MockLoggingService, { config: getConfig() });
  const authService = configureAuth(MockAuthService, {
    config: getConfig(),
    loggingService,
  });
  return { loggingService, authService };
};

// Suppress noisy deprecation warnings from third-party libs.
const originalError = console.error; // eslint-disable-line no-console
beforeAll(() => {
  // eslint-disable-next-line no-console
  console.error = (...args: unknown[]) => {
    const msg = String(args[0] ?? '');
    if (
      msg.includes('forwardRef render functions do not support propTypes or defaultProps')
      || msg.includes('Support for defaultProps will be removed from function components')
    ) {
      return;
    }
    originalError(...args);
  };
});
afterAll(() => {
  // eslint-disable-next-line no-console
  console.error = originalError;
});

(window.scrollTo as jest.Mock) = jest.fn();

// Polyfill crypto.randomUUID for jsdom test environments.
// jsdom does not expose crypto.randomUUID even though Node 24 has it.
// jest.spyOn requires the property to exist before it can be stubbed.
if (typeof crypto.randomUUID !== 'function') {
  Object.defineProperty(crypto, 'randomUUID', {
    value: (): `${string}-${string}-${string}-${string}-${string}` => {
      const hex = () => Math.floor(Math.random() * 16).toString(16);
      const seg = (n: number) => Array.from({ length: n }, hex).join('');
      return `${seg(8)}-${seg(4)}-4${seg(3)}-${['8', '9', 'a', 'b'][Math.floor(Math.random() * 4)]}${seg(3)}-${seg(12)}` as `${string}-${string}-${string}-${string}-${string}`;
    },
    writable: true,
    configurable: true,
  });
}
