import { getConfig } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { CooldownError, AlreadyPassedError, AssessmentIncompleteError } from './errors';

// Re-export error classes so existing imports from '../api/progress' keep working.
export { CooldownError, AlreadyPassedError, AssessmentIncompleteError };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** @deprecated Use AssessmentState for new code. Kept for backward compatibility. */
export interface AssessmentEntry {
  usageKey: string;
  completed: boolean;
  score: number | null;
}

export interface AssessmentState {
  configured: boolean;
  usageKey: string | null;
  sequenceKey: string | null;
  firstUnitKey: string | null;
  attemptCount: number;
  passed: boolean | null;
  firstPassedAt: string | null;
  canAttempt: boolean;
  blockedReason: 'cooldown' | 'already_passed' | 'final_not_passed' | 'retention_locked' | null;
  retryAfterSeconds: number;
  nextAttemptAvailableAt: string | null;
  unlocked: boolean;
  unlocksAt: string | null;
  latestAttempt: {
    attemptNumber: number;
    correctCount: number;
    totalCount: number;
    passed: boolean | null;
  } | null;
}

export interface AssessmentAttempt {
  attemptNumber: number;
  correctCount: number;
  totalCount: number;
  passed: boolean | null;
  submittedAt: string;
  questionResults: Array<{ usageKey: string; correct: boolean }>;
}

export interface AssessmentResponse {
  assessmentType: string;
  replayed: boolean;
  attempt: AssessmentAttempt;
  badgesAwardedNow: Array<{ badgeType: string; awardedAt: string }>;
  courseComplete: boolean;
  serverTime: string;
}

export interface ActivityRecord {
  courseId: string;
  /** The VERTICAL (unit) usageKey — not the sequence, not the problem block. */
  unitId: string;
  /** null when correctness is not applicable (e.g. video, non-graded content). */
  correct: boolean | null;
}


function parseAssessmentResponse(data: Record<string, unknown>): AssessmentResponse {
  const rawAttempt = (data.attempt ?? {}) as Record<string, unknown>;
  const rawResults = Array.isArray(rawAttempt.question_results)
    ? (rawAttempt.question_results as Array<Record<string, unknown>>)
    : [];

  return {
    assessmentType: String(data.assessment_type ?? ''),
    replayed: Boolean(data.replayed),
    attempt: {
      attemptNumber: typeof rawAttempt.attempt_number === 'number' ? rawAttempt.attempt_number : 0,
      correctCount: typeof rawAttempt.correct_count === 'number' ? rawAttempt.correct_count : 0,
      totalCount: typeof rawAttempt.total_count === 'number' ? rawAttempt.total_count : 0,
      passed: rawAttempt.passed === true || rawAttempt.passed === false ? rawAttempt.passed : null,
      submittedAt: typeof rawAttempt.submitted_at === 'string' ? rawAttempt.submitted_at : '',
      questionResults: rawResults.map((r) => ({
        usageKey: String(r.usage_key ?? ''),
        correct: Boolean(r.correct),
      })),
    },
    badgesAwardedNow: Array.isArray(data.badges_awarded_now)
      ? (data.badges_awarded_now as Array<Record<string, unknown>>).map((b) => ({
        badgeType: String(b.badge_type ?? ''),
        awardedAt: String(b.awarded_at ?? ''),
      }))
      : [],
    courseComplete: Boolean(data.course_complete),
    serverTime: String(data.server_time ?? ''),
  };
}

// ---------------------------------------------------------------------------
// POST — record a completed activity
// ---------------------------------------------------------------------------

/**
 * Records that the learner completed an activity unit.
 *
 * Endpoint: POST /api/uber_learn/v1/progress/{course_key}/activity
 * Body:     { activity_key: <verticalUsageKey>, correct: boolean | null }
 *
 * Do NOT use the XBlock block-completion handler for Uber Learn progress.
 */
export const recordActivity = async (record: ActivityRecord): Promise<void> => {
  const { courseId, unitId, correct } = record;
  const url = `${getConfig().LMS_BASE_URL}/api/uber_learn/v1/progress/${courseId}/activity`;
  await getAuthenticatedHttpClient().post(url, {
    activity_key: unitId,
    correct,
  });
};

// ---------------------------------------------------------------------------
// POST — submit assessment
// ---------------------------------------------------------------------------

/**
 * Submits an assessment attempt for the given course.
 *
 * Endpoint: POST /api/uber_learn/v1/progress/{course_key}/assessment
 *
 * @throws CooldownError when the API returns 429 (cooldown active)
 * @throws AlreadyPassedError when the API returns 409 (already_passed)
 */
export const submitAssessment = async (
  courseId: string,
  assessmentType: 'baseline' | 'final' | 'retention',
  idempotencyKey: string,
): Promise<AssessmentResponse> => {
  const url = `${getConfig().LMS_BASE_URL}/api/uber_learn/v1/progress/${courseId}/assessment`;
  try {
    const { data } = await getAuthenticatedHttpClient().post(url, {
      assessment_type: assessmentType,
      idempotency_key: idempotencyKey,
    });
    return parseAssessmentResponse(data as Record<string, unknown>);
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number; data?: Record<string, unknown> } };
    if (axiosErr?.response?.status === 429) {
      const retryAfter = typeof axiosErr.response.data?.retry_after_seconds === 'number'
        ? axiosErr.response.data.retry_after_seconds
        : 0;
      throw new CooldownError(retryAfter);
    }
    if (axiosErr?.response?.status === 409) {
      const errorCode = axiosErr.response?.data?.error_code as string | undefined;
      if (errorCode === 'assessment_incomplete') {
        throw new AssessmentIncompleteError();
      }
      throw new AlreadyPassedError();
    }
    throw err;
  }
};

