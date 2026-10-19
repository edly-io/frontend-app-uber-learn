import { useState, useEffect } from 'react';
import {
  buildTranscriptUrl,
  fetchTranscriptText,
  getPreferredLangs,
  TranscriptFetchError,
} from '../api/transcript';

export type TranscriptStatus = 'idle' | 'loading' | 'success' | 'error';

export interface TranscriptState {
  paragraphs: string[];
  status: TranscriptStatus;
}

const IDLE: TranscriptState = { paragraphs: [], status: 'idle' };

const FETCH_TIMEOUT_MS = 10_000;

/**
 * Fetches and parses the transcript for a video XBlock.
 *
 * Tries the user's browser language first, then falls back to English on 404.
 * Any other failure (network error, 5xx, timeout) goes straight to error state
 * without a fallback attempt.
 *
 * `usageId` is the video block's full usage key.
 * `courseId` is the course run key.
 */
export function useTranscript(usageId: string | null, courseId: string): TranscriptState {
  const [state, setState] = useState<TranscriptState>(IDLE);

  useEffect(() => {
    if (!usageId || !courseId) {
      setState(IDLE);
      return undefined;
    }

    let cancelled = false;
    let currentController: AbortController | null = null;
    setState({ paragraphs: [], status: 'loading' });

    (async () => {
      try {
        const langs = getPreferredLangs();
        let paragraphs: string[] = [];

        for (const lang of langs) {
          if (cancelled) { break; }
          try {
            const url = buildTranscriptUrl(courseId, usageId, lang);
            const controller = new AbortController();
            currentController = controller;
            const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
            try {
              // Sequential by design: only try fallback after confirming the preferred
              // language is absent (404). eslint-disable-next-line is intentional.
              // eslint-disable-next-line no-await-in-loop
              paragraphs = await fetchTranscriptText(url, controller.signal);
            } finally {
              clearTimeout(timeoutId);
              currentController = null;
            }
            break;
          } catch (err) {
            const isNotFound = err instanceof TranscriptFetchError && err.status === 404;
            const isLastLang = lang === langs[langs.length - 1];
            if (!isNotFound || isLastLang) {
              throw err; // non-404, or last language exhausted
            }
          }
        }

        if (cancelled) { return; }
        setState({
          paragraphs,
          status: paragraphs.length > 0 ? 'success' : 'error',
        });
      } catch {
        if (!cancelled) {
          setState({ paragraphs: [], status: 'error' });
        }
      }
    })();

    return () => {
      cancelled = true;
      currentController?.abort();
    };
  }, [usageId, courseId]);

  return state;
}
