/**
 * Unit tests for transcript API helpers.
 *
 * AC coverage:
 *   - SRT-BASIC: strips cue numbers and timing lines, returns one entry per block
 *   - SRT-MULTI-LINE: joins multi-line captions within a block into a single string
 *   - SRT-EMPTY-BLOCKS: skips empty blocks between cues
 *   - SRT-PLAIN-TEXT: plain-text format (no cue numbers) passes through
 *   - SRT-EMPTY: empty string returns empty array
 *   - SRT-NUMERIC-TEXT: digit-only text content on a non-first line is preserved
 *   - SRT-ZERO-CUE: SRT starting from cue index 0 parses correctly
 *   - FETCH-OK: fetchTranscriptText fetches and parses a transcript
 *   - FETCH-ERROR: fetchTranscriptText throws TranscriptFetchError with status
 *   - URL-BUILD: buildTranscriptUrl produces a correct handler_noauth URL defaulting to en
 *   - URL-LANG: buildTranscriptUrl encodes the supplied lang param
 *   - LANGS-EN: getPreferredLangs returns ['en'] for an English browser
 *   - LANGS-FOREIGN: getPreferredLangs returns [base, 'en'] for a non-English browser
 *   - LANGS-SUBTAG: getPreferredLangs strips the region subtag (e.g. fr-FR → fr)
 */
import {
  parseSrtToParagraphs,
  fetchTranscriptText,
  buildTranscriptUrl,
  getPreferredLangs,
  TranscriptFetchError,
} from '../api/transcript';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@edx/frontend-platform', () => ({
  getConfig: () => ({ LMS_BASE_URL: 'http://localhost:18000' }),
}));

// ── parseSrtToParagraphs ──────────────────────────────────────────────────────

describe('parseSrtToParagraphs', () => {
  test('SRT-BASIC: strips cue numbers and timing lines', () => {
    const srt = `1\n00:00:00,000 --> 00:00:02,000\nHello world.\n\n2\n00:00:02,000 --> 00:00:04,000\nFoo bar.`;
    expect(parseSrtToParagraphs(srt)).toEqual(['Hello world.', 'Foo bar.']);
  });

  test('SRT-MULTI-LINE: joins multi-line captions within a block', () => {
    const srt = `1\n00:00:00,000 --> 00:00:03,000\nLine one\nLine two`;
    expect(parseSrtToParagraphs(srt)).toEqual(['Line one Line two']);
  });

  test('SRT-EMPTY-BLOCKS: skips empty blocks', () => {
    const srt = `1\n00:00:00,000 --> 00:00:01,000\nA\n\n\n\n2\n00:00:01,000 --> 00:00:02,000\nB`;
    expect(parseSrtToParagraphs(srt)).toEqual(['A', 'B']);
  });

  test('SRT-PLAIN-TEXT: plain text without timing lines passes through', () => {
    const text = 'Hello.\n\nWorld.';
    expect(parseSrtToParagraphs(text)).toEqual(['Hello.', 'World.']);
  });

  test('SRT-EMPTY: empty string returns empty array', () => {
    expect(parseSrtToParagraphs('')).toEqual([]);
  });

  test('SRT-NUMERIC-TEXT: digit-only text content on a non-first line is preserved', () => {
    const srt = `1\n00:00:00,000 --> 00:00:02,000\n42`;
    expect(parseSrtToParagraphs(srt)).toEqual(['42']);
  });

  test('SRT-ZERO-CUE: SRT with cue index starting from 0 parses correctly', () => {
    const srt = `0\n00:00:00,000 --> 00:00:02,500\nFirst line.\n\n1\n00:00:03,000 --> 00:00:06,000\nSecond line.`;
    expect(parseSrtToParagraphs(srt)).toEqual(['First line.', 'Second line.']);
  });
});

// ── fetchTranscriptText ───────────────────────────────────────────────────────

describe('fetchTranscriptText', () => {
  const g = globalThis as typeof globalThis & { fetch: typeof fetch };
  const originalFetch = g.fetch;
  afterEach(() => { g.fetch = originalFetch; });

  test('FETCH-OK: fetches and parses SRT', async () => {
    g.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('1\n00:00:00,000 --> 00:00:01,000\nOK'),
    }) as unknown as typeof fetch;

    const result = await fetchTranscriptText('http://lms/transcript');
    expect(result).toEqual(['OK']);
  });

  test('FETCH-ERROR: throws TranscriptFetchError with correct status', async () => {
    g.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }) as unknown as typeof fetch;

    await expect(fetchTranscriptText('http://lms/transcript'))
      .rejects.toBeInstanceOf(TranscriptFetchError);

    try {
      await fetchTranscriptText('http://lms/transcript');
    } catch (err) {
      expect((err as TranscriptFetchError).status).toBe(404);
    }
  });
});

// ── buildTranscriptUrl ────────────────────────────────────────────────────────

describe('buildTranscriptUrl', () => {
  const COURSE = 'course-v1:uber+Uber+Demo_2026';
  const VIDEO = 'block-v1:uber+Uber+Demo_2026+type@video+block@abc123';

  test('URL-BUILD: produces a handler_noauth URL defaulting to en', () => {
    const url = buildTranscriptUrl(COURSE, VIDEO);
    expect(url).toBe(
      `http://localhost:18000/courses/${COURSE}/xblock/${VIDEO}/handler_noauth/transcript/download?lang=en`,
    );
  });

  test('URL-LANG: uses and percent-encodes the supplied lang param', () => {
    const url = buildTranscriptUrl(COURSE, VIDEO, 'zh-Hans');
    expect(url).toContain('lang=zh-Hans');
  });
});

// ── getPreferredLangs ─────────────────────────────────────────────────────────

describe('getPreferredLangs', () => {
  test('LANGS-EN: returns ["en"] for an English browser', () => {
    expect(getPreferredLangs('en')).toEqual(['en']);
    expect(getPreferredLangs('en-US')).toEqual(['en']);
    expect(getPreferredLangs('en-GB')).toEqual(['en']);
  });

  test('LANGS-FOREIGN: returns [base, "en"] for a non-English browser', () => {
    expect(getPreferredLangs('fr')).toEqual(['fr', 'en']);
    expect(getPreferredLangs('de')).toEqual(['de', 'en']);
  });

  test('LANGS-SUBTAG: strips the region subtag', () => {
    expect(getPreferredLangs('fr-FR')).toEqual(['fr', 'en']);
    expect(getPreferredLangs('zh-Hans')).toEqual(['zh', 'en']);
    expect(getPreferredLangs('pt-BR')).toEqual(['pt', 'en']);
  });
});
