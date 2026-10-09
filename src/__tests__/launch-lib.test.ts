/**
 * Tests for the signed-launch URL helpers in src/lib/launch.ts.
 */
import { mergeConfig } from '@edx/frontend-platform';
import {
  LAUNCH_PARAMS_MAX,
  appBasePath,
  coursePathFor,
  isLaunchPath,
  takeLaunchParams,
} from '../lib/launch';

const LAUNCH_STRING = 'external_id=test-learner-0001&course_id=course-v1%3AUber%2BDRV101%2B2026_Q4'
  + '&expires=1791547200&nonce=n0nce-test-vector-0001&sig=DaKexTWl64m1_Y_NvCTFYbyLf6McI5jT-ARahux_Zuc';

beforeEach(() => {
  mergeConfig({ PUBLIC_PATH: '/uber-learn/' });
});

afterEach(() => {
  jest.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('appBasePath', () => {
  it.each([
    ['/uber-learn/', '/uber-learn/'],
    ['/uber-learn', '/uber-learn/'],
    ['uber-learn/', '/uber-learn/'],
    ['/', '/'],
    ['', '/'],
  ])('normalises %p to %p', (publicPath, expected) => {
    expect(appBasePath(publicPath)).toBe(expected);
  });

  it('defaults to the configured PUBLIC_PATH', () => {
    expect(appBasePath()).toBe('/uber-learn/');
  });
});

describe('isLaunchPath', () => {
  it.each([
    ['/uber-learn/launch', true],
    ['/uber-learn/launch/', true],
    ['/uber-learn/launcher', false],
    ['/uber-learn/launch/x', false],
    ['/uber-learn/course/x/launch', false],
    ['/uber-learn/', false],
    ['/launch', false],
    ['/uber-learn/Launch', false],
  ])('%p -> %p with the configured PUBLIC_PATH', (pathname, expected) => {
    expect(isLaunchPath(pathname)).toBe(expected);
  });

  it('matches /launch when the public path is /', () => {
    expect(isLaunchPath('/launch', '/')).toBe(true);
    expect(isLaunchPath('/launch/', '/')).toBe(true);
    expect(isLaunchPath('/uber-learn/launch', '/')).toBe(false);
  });

  it('accepts a public path without a trailing slash', () => {
    expect(isLaunchPath('/uber-learn/launch', '/uber-learn')).toBe(true);
  });
});

describe('takeLaunchParams', () => {
  it('returns the fragment and strips it from the address bar and history', () => {
    window.history.pushState({ key: 'k' }, '', `/uber-learn/launch#${LAUNCH_STRING}`);
    const replaceState = jest.spyOn(window.history, 'replaceState');

    expect(takeLaunchParams()).toBe(LAUNCH_STRING);

    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenCalledWith({ key: 'k' }, '', '/uber-learn/launch');
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('');
    expect(window.location.pathname).toBe('/uber-learn/launch');
  });

  it('falls back to the query string when the fragment is empty', () => {
    window.history.pushState(null, '', `/uber-learn/launch?${LAUNCH_STRING}`);

    expect(takeLaunchParams()).toBe(LAUNCH_STRING);
    expect(window.location.search).toBe('');
    expect(window.location.href).toBe(`${window.location.origin}/uber-learn/launch`);
  });

  it('prefers the fragment when both are present, and strips both', () => {
    window.history.pushState(null, '', '/uber-learn/launch?from=query#from=hash');

    expect(takeLaunchParams()).toBe('from=hash');
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
  });

  it('returns the string as is, without decoding or parsing it', () => {
    window.history.pushState(null, '', '/uber-learn/launch#a=%2B&a=+&b');

    expect(takeLaunchParams()).toBe('a=%2B&a=+&b');
  });

  it('returns null, and still strips the URL, when there are no parameters', () => {
    window.history.pushState(null, '', '/uber-learn/launch');
    const replaceState = jest.spyOn(window.history, 'replaceState');

    expect(takeLaunchParams()).toBeNull();
    expect(replaceState).toHaveBeenCalledWith(null, '', '/uber-learn/launch');
  });

  it('returns null for a bare "#" or "?"', () => {
    window.history.pushState(null, '', '/uber-learn/launch?#');

    expect(takeLaunchParams()).toBeNull();
  });

  it('accepts LAUNCH_PARAMS_MAX characters and rejects one more', () => {
    const longest = 'x'.repeat(LAUNCH_PARAMS_MAX);
    window.history.pushState(null, '', `/uber-learn/launch#${longest}`);
    expect(takeLaunchParams()).toBe(longest);

    window.history.pushState(null, '', `/uber-learn/launch#${longest}x`);
    expect(takeLaunchParams()).toBeNull();
    expect(window.location.hash).toBe('');
  });

  it('never writes the parameters to storage', () => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    const localSet = jest.spyOn(Storage.prototype, 'setItem');
    window.history.pushState(null, '', `/uber-learn/launch#${LAUNCH_STRING}`);

    takeLaunchParams();

    expect(localSet).not.toHaveBeenCalled();
    expect(window.localStorage).toHaveLength(0);
    expect(window.sessionStorage).toHaveLength(0);
  });
});

describe('coursePathFor', () => {
  it('builds the course overview path for a course-v1 key', () => {
    expect(coursePathFor('course-v1:Uber+DRV101+2026_Q4'))
      .toBe('/uber-learn/course/course-v1:Uber+DRV101+2026_Q4');
  });

  it('uses the given public path', () => {
    expect(coursePathFor('course-v1:Uber+DRV101+2026_Q4', '/'))
      .toBe('/course/course-v1:Uber+DRV101+2026_Q4');
  });

  it.each([
    'https://evil.example',
    '//evil',
    '/course-v1:Uber+DRV101+2026_Q4',
    'course-v1:a/b',
    'course-v1:a#b',
    'course-v1:a?b',
    'course-v1:a%2Fb',
    'course-v1:a b',
    'course-v1:',
    'library-v1:Uber+LIB',
    // eslint-disable-next-line no-script-url
    'javascript:alert(1)',
    '',
  ])('rejects %p', (courseId) => {
    expect(coursePathFor(courseId)).toBeNull();
  });

  it.each([
    [null],
    [undefined],
    [42],
    [{ toString: () => 'course-v1:Uber+DRV101+2026_Q4' }],
    [['course-v1:Uber+DRV101+2026_Q4']],
  ])('rejects the non-string %p', (courseId) => {
    expect(coursePathFor(courseId)).toBeNull();
  });
});
