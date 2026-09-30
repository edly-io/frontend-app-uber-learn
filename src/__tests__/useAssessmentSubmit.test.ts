/**
 * Tests for useAssessmentSubmit hook.
 *
 * AC coverage:
 *   - SUBMIT-IDEMPOTENCY-01: idempotency key is stable across network retries (submit() reuses key)
 *   - SUBMIT-IDEMPOTENCY-02: idempotency key is refreshed after resetResult()
 *   - SUBMIT-STATE-01: isSubmitting toggles correctly during submission
 *   - SUBMIT-SUCCESS-01: result is populated and progress cache is invalidated on success
 *   - SUBMIT-COOLDOWN-01: CooldownError surfaces as error state
 *   - SUBMIT-ALREADY-PASSED-01: AlreadyPassedError surfaces as error state
 *   - SUBMIT-NETWORK-01: generic errors surface as error state
 *   - SUBMIT-RESET-01: resetResult clears result and error, generates new idempotency key
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAssessmentSubmit } from '../hooks/useAssessmentSubmit';
import * as progressApi from '../api/progress';
import { CooldownError, AlreadyPassedError } from '../api/progress';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Auto-mock the async functions while preserving real Error sub-classes.
// jest.mock() with a full auto-mock replaces classes with mock constructors
// that lose prototype inheritance, causing `instanceof CooldownError` to fail.
jest.mock('../api/progress', () => ({
  ...jest.requireActual('../api/progress'),
  submitAssessment: jest.fn(),
  recordActivity: jest.fn(),
  getUberLearnProgress: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client }, children)
  );
  return { wrapper: Wrapper, client };
};

const COURSE_ID = 'course-v1:Uber+L2024';

const MOCK_RESULT: progressApi.AssessmentResponse = {
  assessmentType: 'final',
  replayed: false,
  attempt: {
    attemptNumber: 1,
    correctCount: 8,
    totalCount: 10,
    passed: true,
    submittedAt: '2024-01-01T12:00:00Z',
    questionResults: [],
  },
  badgesAwardedNow: [{ badgeType: 'thorough', awardedAt: '2024-01-01T12:00:00Z' }],
  courseComplete: false,
  serverTime: '2024-01-01T12:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  // Stub crypto.randomUUID for determinism
  let callCount = 0;
  const uuids = ['uuid-A', 'uuid-B', 'uuid-C'];
  jest.spyOn(crypto, 'randomUUID').mockImplementation(() => uuids[callCount++ % uuids.length] as `${string}-${string}-${string}-${string}-${string}`);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAssessmentSubmit', () => {
  describe('SUBMIT-IDEMPOTENCY-01: idempotency key is stable across retries', () => {
    it('calls submitAssessment with the same key on consecutive submit() calls before reset', async () => {
      jest.mocked(progressApi.submitAssessment).mockRejectedValueOnce(new Error('Network error'));
      jest.mocked(progressApi.submitAssessment).mockResolvedValueOnce(MOCK_RESULT);

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useAssessmentSubmit(), { wrapper });

      // First call (fails)
      await act(async () => {
        await result.current.submit(COURSE_ID, 'final');
      });

      // Second call (succeeds) — should use the same idempotency key
      await act(async () => {
        await result.current.submit(COURSE_ID, 'final');
      });

      const { calls } = jest.mocked(progressApi.submitAssessment).mock;
      // Both calls should share the same idempotency key (uuid-A)
      expect(calls[0][2]).toBe('uuid-A');
      expect(calls[1][2]).toBe('uuid-A');
    });
  });

  describe('SUBMIT-IDEMPOTENCY-02: resetResult generates a new key', () => {
    it('uses a different idempotency key after resetResult()', async () => {
      jest.mocked(progressApi.submitAssessment).mockResolvedValue(MOCK_RESULT);

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useAssessmentSubmit(), { wrapper });

      // First submit
      await act(async () => {
        await result.current.submit(COURSE_ID, 'final');
      });
      const firstKey = jest.mocked(progressApi.submitAssessment).mock.calls[0][2];

      // Reset + second submit
      act(() => { result.current.resetResult(); });

      await act(async () => {
        await result.current.submit(COURSE_ID, 'final');
      });
      const secondKey = jest.mocked(progressApi.submitAssessment).mock.calls[1][2];

      expect(firstKey).not.toBe(secondKey);
    });
  });

  describe('SUBMIT-STATE-01: isSubmitting toggles correctly', () => {
    it('is false initially, true while pending, false after success', async () => {
      let resolveFn!: (val: progressApi.AssessmentResponse) => void;
      const pending = new Promise<progressApi.AssessmentResponse>((resolve) => { resolveFn = resolve; });
      jest.mocked(progressApi.submitAssessment).mockReturnValue(pending);

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useAssessmentSubmit(), { wrapper });

      expect(result.current.isSubmitting).toBe(false);

      // Start submit but don't await
      act(() => { result.current.submit(COURSE_ID, 'final'); });

      await waitFor(() => expect(result.current.isSubmitting).toBe(true));

      // Resolve the promise
      act(() => { resolveFn(MOCK_RESULT); });

      await waitFor(() => expect(result.current.isSubmitting).toBe(false));
    });
  });

  describe('SUBMIT-SUCCESS-01: result is set and progress cache is invalidated', () => {
    it('sets result and invalidates progress queries on success', async () => {
      jest.mocked(progressApi.submitAssessment).mockResolvedValue(MOCK_RESULT);

      const { wrapper, client } = makeWrapper();
      const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

      const { result } = renderHook(() => useAssessmentSubmit(), { wrapper });

      await act(async () => {
        await result.current.submit(COURSE_ID, 'final');
      });

      expect(result.current.result).toEqual(MOCK_RESULT);
      expect(result.current.error).toBeNull();
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['progress', COURSE_ID] }),
      );
    });
  });

  describe('SUBMIT-COOLDOWN-01: CooldownError surfaces as error state', () => {
    it('sets error to CooldownError on 429', async () => {
      const cooldownErr = new CooldownError(120);
      jest.mocked(progressApi.submitAssessment).mockRejectedValue(cooldownErr);

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useAssessmentSubmit(), { wrapper });

      await act(async () => {
        await result.current.submit(COURSE_ID, 'final');
      });

      expect(result.current.error).toBeInstanceOf(CooldownError);
      expect((result.current.error as CooldownError).retryAfterSeconds).toBe(120);
      expect(result.current.result).toBeNull();
    });
  });

  describe('SUBMIT-ALREADY-PASSED-01: AlreadyPassedError surfaces as error state', () => {
    it('sets error to AlreadyPassedError on 409', async () => {
      jest.mocked(progressApi.submitAssessment).mockRejectedValue(new AlreadyPassedError());

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useAssessmentSubmit(), { wrapper });

      await act(async () => {
        await result.current.submit(COURSE_ID, 'final');
      });

      expect(result.current.error).toBeInstanceOf(AlreadyPassedError);
      expect(result.current.result).toBeNull();
    });
  });

  describe('SUBMIT-NETWORK-01: generic errors surface as error state', () => {
    it('sets error for unexpected failures', async () => {
      jest.mocked(progressApi.submitAssessment).mockRejectedValue(new Error('Network failure'));

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useAssessmentSubmit(), { wrapper });

      await act(async () => {
        await result.current.submit(COURSE_ID, 'final');
      });

      expect(result.current.error?.message).toBe('Network failure');
      expect(result.current.result).toBeNull();
    });
  });

  describe('SUBMIT-RESET-01: resetResult clears state', () => {
    it('clears result and error after resetResult()', async () => {
      jest.mocked(progressApi.submitAssessment).mockResolvedValue(MOCK_RESULT);

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useAssessmentSubmit(), { wrapper });

      await act(async () => {
        await result.current.submit(COURSE_ID, 'final');
      });

      expect(result.current.result).not.toBeNull();

      act(() => { result.current.resetResult(); });

      expect(result.current.result).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });
});
