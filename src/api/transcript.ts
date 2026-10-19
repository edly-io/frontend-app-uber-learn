import { getConfig } from '@edx/frontend-platform';

export class TranscriptFetchError extends Error {
  constructor(public readonly status: number) {
    super(`Transcript fetch failed: ${status}`);
    this.name = 'TranscriptFetchError';
  }
}

/**
 * Returns languages to try in priority order: browser base language first,
 * then 'en' as fallback. Deduplicates when the browser language is already 'en'.
 *
 * Accepts an optional override so tests can inject a specific language without
 * touching navigator.language.
 */
export function getPreferredLangs(browserLang?: string): string[] {
  const raw = browserLang ?? (typeof navigator !== 'undefined' ? navigator.language : 'en') ?? 'en';
  const base = raw.split('-')[0].toLowerCase() || 'en';
  return base !== 'en' ? [base, 'en'] : ['en'];
}

/**
 * Builds the no-auth URL for downloading a video block's SRT transcript.
 *
 * Works without any upfront API call — the video block's usage key and course
 * ID are enough to construct the edx-platform handler URL directly.
 */
export function buildTranscriptUrl(
  courseId: string,
  videoBlockId: string,
  lang = 'en',
): string {
  return `${getConfig().LMS_BASE_URL}/courses/${courseId}/xblock/${videoBlockId}/handler_noauth/transcript/download?lang=${encodeURIComponent(lang)}`;
}

/**
 * Strips SRT cue numbers and timestamp lines, returning one string per
 * non-empty caption block. Adjacent lines within a block are joined with a space.
 *
 * The cue-number filter only removes a digit-only line when it is the FIRST line
 * of a block, so numeric text content (e.g. "42") is preserved.
 *
 * Also handles plain-text transcript format (no cue numbers or timing lines).
 */
export function parseSrtToParagraphs(srt: string): string[] {
  return srt
    .split(/\r?\n\r?\n+/)
    .map((block) =>
      block
        .split(/\r?\n/)
        .filter((line, lineIdx) => !(lineIdx === 0 && /^\d+$/.test(line.trim())))
        .filter((line) => !/\d{1,2}:\d{2}.*-->/.test(line))
        .join(' ')
        .trim(),
    )
    .filter(Boolean);
}

/**
 * Downloads and parses the transcript at `url`.
 * Throws TranscriptFetchError (with status) on non-ok responses so callers
 * can distinguish 404 (language not available) from other failures.
 */
export async function fetchTranscriptText(url: string, signal?: AbortSignal): Promise<string[]> {
  const resp = await fetch(url, { credentials: 'include', signal });
  if (!resp.ok) {
    throw new TranscriptFetchError(resp.status);
  }
  const text = await resp.text();
  return parseSrtToParagraphs(text);
}
