/**
 * Assessment type detection.
 *
 * The Uber Learn XBlocks emit a `uber_learn_assessments` field in the
 * plugin.completed postMessage payload when an activity contains graded
 * or ungraded assessments. This module normalises that field so the UI
 * can react without parsing raw postMessage data.
 */

export type AssessmentType = 'graded' | 'ungraded' | 'none';

export interface AssessmentMeta {
  type: AssessmentType;
  /** Total number of questions in the assessment. 0 for non-assessment units. */
  questionCount: number;
  /** Score expressed as a fraction 0–1, or null if not yet submitted. */
  score: number | null;
}

/**
 * Parses the `uber_learn_assessments` payload from a postMessage event.
 *
 * @param payload - The raw postMessage payload object (may be undefined/null).
 * @returns Normalised AssessmentMeta.
 */
export function detectAssessmentMeta(
  payload: Record<string, unknown> | null | undefined,
): AssessmentMeta {
  if (!payload || typeof payload !== 'object') {
    return { type: 'none', questionCount: 0, score: null };
  }

  const assessments = payload.uber_learn_assessments;

  if (!assessments || !Array.isArray(assessments) || assessments.length === 0) {
    return { type: 'none', questionCount: 0, score: null };
  }

  const isGraded = (assessments as Array<Record<string, unknown>>).some(
    (a) => a.graded === true,
  );

  const questionCount = (assessments as Array<Record<string, unknown>>).reduce(
    (sum, a) => sum + (typeof a.question_count === 'number' ? a.question_count : 0),
    0,
  );

  const rawScore = (payload.score ?? null) as number | null;
  const score = typeof rawScore === 'number' ? rawScore : null;

  return {
    type: isGraded ? 'graded' : 'ungraded',
    questionCount,
    score,
  };
}
