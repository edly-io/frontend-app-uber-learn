import { mergeConfig } from '@edx/frontend-platform';
import { buildXBlockUrl } from '../lib/xblock-url';

describe('buildXBlockUrl', () => {
  beforeEach(() => {
    mergeConfig({ LMS_BASE_URL: 'https://learn.uber.com' });
  });

  it('builds the correct XBlock URL from a usage key', () => {
    const usageKey = 'block-v1:Uber+Course1+Run1+type@html+block@abc123';
    const result = buildXBlockUrl(usageKey);
    expect(result).toBe(`https://learn.uber.com/xblock/${usageKey}`);
  });

  it('does not double-slash if LMS_BASE_URL has no trailing slash', () => {
    mergeConfig({ LMS_BASE_URL: 'https://learn.uber.com' });
    const url = buildXBlockUrl('block-v1:Org+C+R+type@problem+block@xyz');
    expect(url).not.toMatch(/\/\/xblock/);
  });

  it('returns a URL starting with the LMS base URL', () => {
    const url = buildXBlockUrl('block-v1:X+Y+Z+type@video+block@vid1');
    expect(url.startsWith('https://learn.uber.com')).toBe(true);
  });
});
