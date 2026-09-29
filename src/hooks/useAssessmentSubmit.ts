/**
 * useAssessmentSubmit
 *
 * Manages the lifecycle of a POST /assessment submission:
 *  - Idempotency key is stored in a ref so network retries reuse the same key.
 *  - The key is refreshed only when resetResult() is called (user acknowledged
 *    previous result and is starting a genuinely new attempt).
 *  - On success, invalidates the progress query cache so GET /progress refetches.
 */

import {
  useState, useRef, useCallback,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  submitAssessment, type AssessmentResponse,
} from '../api/progress';
import { qk } from '../api/queries';
import { generateUUID } from '../lib/uuid';

export type AssessmentType = 'baseline' | 'final' | 'retention';

export interface UseAssessmentSubmitResult {
  submit: (courseId: string, assessmentType: AssessmentType) => Promise<void>;
  isSubmitting: boolean;
  result: AssessmentResponse | null;
  error: Error | null;
  resetResult: () => void;
}

export function useAssessmentSubmit(): UseAssessmentSubmitResult {
  const queryClient = useQueryClient();
  // Idempotency key: initialized at mount, refreshed only in resetResult.
  // This ensures network retries reuse the same key (idempotent re-submission).
  const idempotencyKeyRef = useRef<string>(generateUUID());

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<AssessmentResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const submit = useCallback(async (courseId: string, assessmentType: AssessmentType) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await submitAssessment(courseId, assessmentType, idempotencyKeyRef.current);
      setResult(response);
      // Invalidate cached progress so the next GET reflects the completed attempt
      queryClient.invalidateQueries({ queryKey: qk.progress(courseId) });
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsSubmitting(false);
    }
  }, [queryClient]);

  const resetResult = useCallback(() => {
    // Generate a new key so the next submit is treated as a fresh attempt by the backend.
    idempotencyKeyRef.current = generateUUID();
    setResult(null);
    setError(null);
  }, []);

  return {
    submit,
    isSubmitting,
    result,
    error,
    resetResult,
  };
}
