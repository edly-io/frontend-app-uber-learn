/**
 * useAssessmentMeta
 *
 * Reads assessment state directly from the GET /api/uber_learn/v1/progress/{course_key}
 * response. The backend returns full AssessmentState objects under:
 *   assessments.baseline
 *   assessments.final
 *   assessments.retention
 *
 * No separate API call is needed — the data is co-located with overall progress.
 */

import { useProgress, type UberLearnProgress } from './useProgress';

export type { AssessmentEntry, AssessmentState } from '../api/progress';

export interface AssessmentMetaResult {
  baseline: UberLearnProgress['assessments']['baseline'];
  final: UberLearnProgress['assessments']['final'];
  retention: UberLearnProgress['assessments']['retention'];
  isLoading: boolean;
  isError: boolean;
}

/**
 * Returns the three assessment states (baseline, final, retention) for the given
 * course by reading them from the shared progress query result.
 *
 * Accepts `courseId` as the single parameter. Internally reuses the `useProgress`
 * query so no extra network request is made when both hooks are used together.
 */
export const useAssessmentMeta = (courseId: string): AssessmentMetaResult => {
  const { data, isLoading, isError } = useProgress(courseId);

  return {
    baseline: data?.assessments.baseline ?? null,
    final: data?.assessments.final ?? null,
    retention: data?.assessments.retention ?? null,
    isLoading,
    isError,
  };
};
