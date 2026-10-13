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

jest.mock('../lib/launch', () => ({
  ...jest.requireActual('../lib/launch'),
  // jsdom cannot reload; record the URL the reload would load instead.
  reloadPage: jest.fn(() => window.location.href),
}));

const LAUNCH = 'external_id=test-learner-0001&course_id=course-v1%3AUber%2BDRV101%2B2026_Q4'
  + '&expires=1791547200&nonce=n0nce-test-vector-0001&sig=DaKexTWl64m1_Y_NvCTFYbyLf6McI5jT-ARahux_Zuc';
const NEXT_LAUNCH = 'external_id=test-learner-0001&course_id=course-v1%3AUber%2BDRV101%2B2026_Q4'
  + '&expires=1791547500&nonce=n0nce-test-vector-0002&sig=another-signature';

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
  reloadPage: jest.Mock;
}

/** Window listeners added by each boot, removed after every test. */
const windowListeners: Array<Parameters<typeof window.removeEventListener>> = [];

function boot(url: string): Booted {
  window.history.replaceState(null, '', url);
  let booted: Booted | undefined;
  // Each isolated registry loads frontend-platform again, which warns that
  // PubSub is already loaded and about the router basename. Neither matters.
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const addListener = jest.spyOn(window, 'addEventListener');

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
      reloadPage: jest.requireMock<{ reloadPage: jest.Mock }>('../lib/launch').reloadPage,
    };
  });

  windowListeners.push(
    ...addListener.mock.calls.map(([type, listener]) => [type, listener] as [string, EventListener]),
  );
  addListener.mockRestore();
  warn.mockRestore();
  return booted as Booted;
}

/**
 * Navigates the document to another fragment, as opening a new launch link in
 * the same tab does, and resolves once its hashchange event has been handled.
 */
function navigateToFragment(fragment: string): Promise<Event> {
  const handled = new Promise<Event>((resolve) => {
    window.addEventListener('hashchange', resolve, { once: true });
  });
  window.location.hash = fragment;
  return handled;
}

afterEach(() => {
  windowListeners.splice(0).forEach((args) => window.removeEventListener(...args));
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

describe('index.jsx: a new launch link opened in the same tab', () => {
  it.each([
    ['after a launch', `/uber-learn/launch#${LAUNCH}`],
    ['after an incomplete link', '/uber-learn/launch'],
  ])('reloads the page on the new URL (%s)', async (_label, url) => {
    const { reloadPage } = boot(url);
    expect(window.location.href).toBe(`${window.location.origin}/uber-learn/launch`);

    // Only the fragment changes, so the browser does not load the page again.
    await navigateToFragment(NEXT_LAUNCH);

    expect(reloadPage).toHaveBeenCalledTimes(1);
    // The reload loads the new link, so the boot code can read and strip it.
    expect(reloadPage.mock.results[0].value).toBe(`${window.location.origin}/uber-learn/launch#${NEXT_LAUNCH}`);
  });

  it('sends the new string and strips it from the URL once the page has reloaded', async () => {
    const first = boot(`/uber-learn/launch#${LAUNCH}`);
    await navigateToFragment(NEXT_LAUNCH);

    const reloaded = boot(first.reloadPage.mock.results[0].value);

    expect(reloaded.page.type).toBe(reloaded.LaunchPage);
    expect(reloaded.page.props.launch).toBe(NEXT_LAUNCH);
    expect(reloaded.hrefAtInitialize).toBe(`${window.location.origin}/uber-learn/launch`);
    expect(window.location.hash).toBe('');
  });

  it('does not reload because of its own stripping', async () => {
    const { reloadPage } = boot(`/uber-learn/launch#${LAUNCH}`);
    // hashchange is dispatched in a later task; give it the chance to run.
    await new Promise((resolve) => { setTimeout(resolve, 0); });

    expect(window.location.hash).toBe('');
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it('does not reload other pages when their fragment changes', async () => {
    const { reloadPage } = boot('/uber-learn/library');

    await navigateToFragment('section-2');

    expect(window.location.hash).toBe('#section-2');
    expect(reloadPage).not.toHaveBeenCalled();
  });
});
