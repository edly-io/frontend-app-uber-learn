/**
 * Tests for the boot-time launch decision in src/index.jsx.
 *
 * index.jsx runs at import time, so each case loads it in an isolated module
 * registry with initialize(), subscribe() and createRoot() mocked, then
 * inspects what it asked for and what it would render.
 */
import type { ReactElement } from 'react';

jest.mock('@edx/frontend-platform', () => ({
  ...jest.requireActual('@edx/frontend-platform'),
  // Records the address bar as initialize() saw it.
  initialize: jest.fn(() => ({ hrefAtInitialize: window.location.href })),
  subscribe: jest.fn(),
}));

jest.mock('@edx/frontend-platform/react', () => ({
  AppProvider: () => null,
  ErrorPage: () => null,
}));

jest.mock('react-dom/client', () => ({
  createRoot: jest.fn(() => ({ render: jest.fn() })),
}));

jest.mock('../App', () => ({ App: () => null }));

jest.mock('../pages/LaunchPage', () => ({ LaunchPage: () => null }));

const LAUNCH = 'external_id=test-learner-0001&course_id=course-v1%3AUber%2BDRV101%2B2026_Q4'
  + '&expires=1791547200&nonce=n0nce-test-vector-0001&sig=DaKexTWl64m1_Y_NvCTFYbyLf6McI5jT-ARahux_Zuc';

interface PlatformMock {
  APP_READY: string;
  mergeConfig: (config: Record<string, unknown>) => void;
  initialize: jest.Mock;
  subscribe: jest.Mock;
}

type Element = ReactElement<{ children?: Element; launch?: string | null }>;

interface Booted {
  requireAuthenticatedUser: unknown;
  hrefAtInitialize: string;
  /** The element index.jsx renders inside <StrictMode><AppProvider>. */
  page: Element;
  App: unknown;
  LaunchPage: unknown;
}

function boot(url: string): Booted {
  window.history.replaceState(null, '', url);
  let booted: Booted | undefined;
  // Each isolated registry loads frontend-platform again, which warns that
  // PubSub is already loaded and about the router basename. Neither matters.
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

  jest.isolateModules(() => {
    const platform = jest.requireMock<PlatformMock>('@edx/frontend-platform');
    platform.mergeConfig({ PUBLIC_PATH: '/uber-learn/' });

    // Runs index.jsx; its own imports resolve to the mocks above.
    jest.requireActual('../index');

    const [[options]] = platform.initialize.mock.calls;
    const [, onReady] = platform.subscribe.mock.calls.find(([topic]) => topic === platform.APP_READY);
    document.body.innerHTML = '<div id="root"></div>';
    onReady();

    const { createRoot } = jest.requireMock<{ createRoot: jest.Mock }>('react-dom/client');
    const root = createRoot.mock.results[0].value;
    const strictMode: Element = root.render.mock.calls[0][0];
    const appProvider = strictMode.props.children as Element;

    booted = {
      requireAuthenticatedUser: options.requireAuthenticatedUser,
      hrefAtInitialize: platform.initialize.mock.results[0].value.hrefAtInitialize,
      page: appProvider.props.children as Element,
      App: jest.requireMock<{ App: unknown }>('../App').App,
      LaunchPage: jest.requireMock<{ LaunchPage: unknown }>('../pages/LaunchPage').LaunchPage,
    };
  });

  warn.mockRestore();
  return booted as Booted;
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
  document.body.innerHTML = '';
});

describe('index.jsx boot', () => {
  it.each([
    ['/uber-learn/launch#<launch>', `/uber-learn/launch#${LAUNCH}`],
    ['/uber-learn/launch/#<launch>', `/uber-learn/launch/#${LAUNCH}`],
    ['/uber-learn/launch?<launch>', `/uber-learn/launch?${LAUNCH}`],
  ])('boots %s without requiring a user and renders only the launch page', (_label, url) => {
    const { requireAuthenticatedUser, page, LaunchPage } = boot(url);

    expect(requireAuthenticatedUser).toBe(false);
    expect(page.type).toBe(LaunchPage);
    expect(page.props.launch).toBe(LAUNCH);
  });

  it.each([
    ['fragment', `/uber-learn/launch#${LAUNCH}`],
    ['query string', `/uber-learn/launch?${LAUNCH}`],
  ])('strips the signed parameters (%s) from the URL before initialize() runs', (_label, url) => {
    const { hrefAtInitialize } = boot(url);

    expect(hrefAtInitialize).toBe(`${window.location.origin}/uber-learn/launch`);
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('');
    expect(window.location.pathname).toBe('/uber-learn/launch');
  });

  it('passes null to the launch page when there are no parameters', () => {
    const { requireAuthenticatedUser, page } = boot('/uber-learn/launch');

    expect(requireAuthenticatedUser).toBe(false);
    expect(page.props.launch).toBeNull();
  });

  it.each([
    ['/uber-learn/', '/uber-learn/'],
    ['/uber-learn/library', '/uber-learn/library'],
    ['/uber-learn/course/<id>#<launch>', `/uber-learn/course/course-v1:Uber+DRV101+2026_Q4#${LAUNCH}`],
    ['/uber-learn/launcher#<launch>', `/uber-learn/launcher#${LAUNCH}`],
    ['/uber-learn/course/x/launch#<launch>', `/uber-learn/course/x/launch#${LAUNCH}`],
  ])('keeps %s behind the login and renders the app', (_label, url) => {
    const { requireAuthenticatedUser, page, App } = boot(url);

    expect(requireAuthenticatedUser).toBe(true);
    expect(page.type).toBe(App);
  });

  it('leaves the URL of other pages alone', () => {
    boot('/uber-learn/launcher#keep=me');

    expect(window.location.hash).toBe('#keep=me');
  });
});
