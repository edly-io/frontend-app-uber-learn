import { getConfig } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { CooldownError, AlreadyPassedError } from './errors';

// Re-export error classes so existing imports from '../api/progress' keep working.
export { CooldownError, AlreadyPassedError };

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

export interface UberLearnProgress {
  completedActivities: number;
  totalActivities: number;
  fraction: number;
  assessments: {
    baseline: AssessmentState | null;
    final: AssessmentState | null;
    retention: AssessmentState | null;
  };
  points: { earned: number | null; possible: number | null };
  streak: { currentDays: number; longestDays: number };
  courseComplete: boolean;
  badges: Array<{ badgeType: string; awardedAt: string }>;
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

function toAssessmentState(raw: Record<string, unknown> | null | undefined): AssessmentState | null {
  if (!raw || typeof raw !== 'object') { return null; }

  const latestRaw = raw.latest_attempt as Record<string, unknown> | null | undefined;
  const latestAttempt = latestRaw
    ? {
      attemptNumber: typeof latestRaw.attempt_number === 'number' ? latestRaw.attempt_number : 0,
      correctCount: typeof latestRaw.correct_count === 'number' ? latestRaw.correct_count : 0,
      totalCount: typeof latestRaw.total_count === 'number' ? latestRaw.total_count : 0,
      passed: latestRaw.passed === true || latestRaw.passed === false ? latestRaw.passed : null,
    }
    : null;

  const rawBlockedReason = raw.blocked_reason as string | null | undefined;
  const validBlockedReasons = ['cooldown', 'already_passed', 'final_not_passed', 'retention_locked'] as const;
  type BlockedReason = typeof validBlockedReasons[number];
  const blockedReason: BlockedReason | null = validBlockedReasons.includes(rawBlockedReason as BlockedReason)
    ? (rawBlockedReason as BlockedReason)
    : null;

  return {
    configured: Boolean(raw.configured),
    usageKey: typeof raw.usage_key === 'string' ? raw.usage_key : null,
    sequenceKey: typeof raw.sequence_key === 'string' ? raw.sequence_key : null,
    firstUnitKey: typeof raw.first_unit_key === 'string' ? raw.first_unit_key : null,
    attemptCount: typeof raw.attempt_count === 'number' ? raw.attempt_count : 0,
    passed: raw.passed === true || raw.passed === false ? raw.passed : null,
    firstPassedAt: typeof raw.first_passed_at === 'string' ? raw.first_passed_at : null,
    canAttempt: Boolean(raw.can_attempt),
    blockedReason,
    retryAfterSeconds: typeof raw.retry_after_seconds === 'number' ? raw.retry_after_seconds : 0,
    nextAttemptAvailableAt: typeof raw.next_attempt_available_at === 'string'
      ? raw.next_attempt_available_at
      : null,
    unlocked: Boolean(raw.unlocked),
    unlocksAt: typeof raw.unlocks_at === 'string' ? raw.unlocks_at : null,
    latestAttempt,
  };
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
      throw new AlreadyPassedError();
    }
    throw err;
  }
};

// ---------------------------------------------------------------------------
// GET — fetch course progress (includes assessment keys)
// ---------------------------------------------------------------------------

/**
 * Fetches progress for a course from the Uber Learn Progress API.
 *
 * Endpoint: GET /api/uber_learn/v1/progress/{course_key}
 *
 * The response includes:
 *  - completed_activities / total_activities: for the progress bar
 *  - assessments.{baseline,final,retention}: full AssessmentState per type
 *  - points, streak, course_complete, badges
 */
export const getUberLearnProgress = async (courseId: string): Promise<UberLearnProgress> => {
  const url = `${getConfig().LMS_BASE_URL}/api/uber_learn/v1/progress/${courseId}`;
  const { data } = await getAuthenticatedHttpClient().get(url);

  const completed = typeof data.completed_activities === 'number' ? data.completed_activities : 0;
  const total = typeof data.total_activities === 'number' ? data.total_activities : 0;
  const assessmentsRaw = (data.assessments ?? {}) as Record<string, Record<string, unknown>>;

  const rawPoints = (data.points ?? {}) as Record<string, unknown>;
  const rawStreak = (data.streak ?? {}) as Record<string, unknown>;
  const rawBadges = Array.isArray(data.badges)
    ? (data.badges as Array<Record<string, unknown>>)
    : [];

  return {
    completedActivities: completed,
    totalActivities: total,
    fraction: total > 0 ? completed / total : 0,
    assessments: {
      baseline: toAssessmentState(assessmentsRaw.baseline),
      final: toAssessmentState(assessmentsRaw.final),
      retention: toAssessmentState(assessmentsRaw.retention),
    },
    points: {
      earned: typeof rawPoints.earned === 'number' ? rawPoints.earned : null,
      possible: typeof rawPoints.possible === 'number' ? rawPoints.possible : null,
    },
    streak: {
      currentDays: typeof rawStreak.current_days === 'number' ? rawStreak.current_days : 0,
      longestDays: typeof rawStreak.longest_days === 'number' ? rawStreak.longest_days : 0,
    },
    courseComplete: Boolean(data.course_complete),
    badges: rawBadges.map((b) => ({
      badgeType: String(b.badge_type ?? ''),
      awardedAt: String(b.awarded_at ?? ''),
    })),
  };
};
