/**
 * Unit tests for useTranscript hook.
 *
 * AC coverage:
 *   - UT-IDLE: returns idle state when usageId is null
 *   - UT-LOADING: transitions to loading on open
 *   - UT-SUCCESS: resolves to success with paragraphs
 *   - UT-EMPTY-TRANSCRIPT: resolves to error when transcript has no content
 *   - UT-ERROR: resolves to error on fetch failure
 *   - UT-LANG-PREFERRED: tries the browser language first
 *   - UT-LANG-FALLBACK: falls back to English when preferred lang returns 404
 *   - UT-LANG-NO-FALLBACK-NON-404: does not fall back on non-404 errors
 *   - UT-LANG-EN-ONLY: makes a single request when browser lang is already English
 *   - UT-CANCEL: state is not updated after unmount
 */
import { renderHook, waitFor } from '@testing-library/react';
import { useTranscript } from '../hooks/useTranscript';
import {
  fetchTranscriptText,
  buildTranscriptUrl,
  getPreferredLangs,
  TranscriptFetchError,
} from '../api/transcript';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../api/transcript', () => {
  const actual = jest.requireActual<typeof import('../api/transcript')>('../api/transcript');
  return {
    ...actual,
    fetchTranscriptText: jest.fn(),
    buildTranscriptUrl: jest.fn(
      (_courseId: string, _videoBlockId: string, lang: string) => `http://lms/${lang}`,
    ),
    getPreferredLangs: jest.fn(),
  };
});

const mockFetch = jest.mocked(fetchTranscriptText);
const mockBuild = jest.mocked(buildTranscriptUrl);
const mockLangs = jest.mocked(getPreferredLangs);

const COURSE = 'course-v1:uber+Demo_2026';
const VIDEO = 'block-v1:uber+Demo_2026+type@video+block@abc';
const PARAGRAPHS = ['Hello.', 'World.'];

beforeEach(() => {
  jest.clearAllMocks();
  mockLangs.mockReturnValue(['en']);
  mockFetch.mockResolvedValue(PARAGRAPHS);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

test('UT-IDLE: returns idle when usageId is null', () => {
  const { result } = renderHook(() => useTranscript(null, COURSE));
  expect(result.current).toEqual({ paragraphs: [], status: 'idle' });
});

test('UT-LOADING: transitions to loading synchronously on open', () => {
  mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
  const { result } = renderHook(() => useTranscript(VIDEO, COURSE));
  expect(result.current.status).toBe('loading');
});

test('UT-SUCCESS: resolves to success with paragraphs', async () => {
  const { result } = renderHook(() => useTranscript(VIDEO, COURSE));
  await waitFor(() => expect(result.current.status).toBe('success'));
  expect(result.current.paragraphs).toEqual(PARAGRAPHS);
});

test('UT-EMPTY-TRANSCRIPT: resolves to error when transcript has no content', async () => {
  mockFetch.mockResolvedValue([]);
  const { result } = renderHook(() => useTranscript(VIDEO, COURSE));
  await waitFor(() => expect(result.current.status).toBe('error'));
});

test('UT-ERROR: resolves to error on fetch failure', async () => {
  mockFetch.mockRejectedValue(new TranscriptFetchError(500));
  const { result } = renderHook(() => useTranscript(VIDEO, COURSE));
  await waitFor(() => expect(result.current.status).toBe('error'));
});

test('UT-LANG-PREFERRED: tries the browser language first', async () => {
  mockLangs.mockReturnValue(['fr', 'en']);
  const { result } = renderHook(() => useTranscript(VIDEO, COURSE));
  await waitFor(() => expect(result.current.status).toBe('success'));
  expect(mockBuild).toHaveBeenCalledWith(COURSE, VIDEO, 'fr');
  expect(mockFetch).toHaveBeenCalledWith('http://lms/fr', expect.anything());
});

test('UT-LANG-FALLBACK: falls back to English when preferred lang returns 404', async () => {
  mockLangs.mockReturnValue(['fr', 'en']);
  mockFetch
    .mockRejectedValueOnce(new TranscriptFetchError(404))
    .mockResolvedValueOnce(PARAGRAPHS);

  const { result } = renderHook(() => useTranscript(VIDEO, COURSE));
  await waitFor(() => expect(result.current.status).toBe('success'));

  expect(mockFetch).toHaveBeenCalledTimes(2);
  expect(mockBuild).toHaveBeenNthCalledWith(1, COURSE, VIDEO, 'fr');
  expect(mockBuild).toHaveBeenNthCalledWith(2, COURSE, VIDEO, 'en');
  expect(result.current.paragraphs).toEqual(PARAGRAPHS);
});

test('UT-LANG-NO-FALLBACK-NON-404: does not fall back on non-404 errors', async () => {
  mockLangs.mockReturnValue(['fr', 'en']);
  mockFetch.mockRejectedValue(new TranscriptFetchError(500));

  const { result } = renderHook(() => useTranscript(VIDEO, COURSE));
  await waitFor(() => expect(result.current.status).toBe('error'));

  expect(mockFetch).toHaveBeenCalledTimes(1);
});

test('UT-LANG-EN-ONLY: makes a single request when browser lang is English', async () => {
  mockLangs.mockReturnValue(['en']);
  const { result } = renderHook(() => useTranscript(VIDEO, COURSE));
  await waitFor(() => expect(result.current.status).toBe('success'));
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

test('UT-CANCEL: state is not updated after unmount', async () => {
  let resolve: (v: string[]) => void;
  mockFetch.mockReturnValue(new Promise((r) => { resolve = r; }));

  const { result, unmount } = renderHook(() => useTranscript(VIDEO, COURSE));
  expect(result.current.status).toBe('loading');

  unmount();
  resolve!(PARAGRAPHS);

  await new Promise((r) => { setTimeout(r, 0); });
  expect(result.current.status).toBe('loading'); // never updated after unmount
});
