import { useQuery } from '@tanstack/react-query';
import { getUberLearnProgress, type UberLearnProgress } from '../api/progress';
import { qk } from '../api/queries';

export type { UberLearnProgress };

/**
 * Fetches Uber Learn course progress from the dedicated Progress API.
 *
 * Endpoint: GET /api/uber_learn/v1/progress/{course_key}
 *
 * Returns:
 *  - fraction / completedActivities / totalActivities for the progress bar
 *  - assessments.{baseline,final,retention} for useAssessmentMeta
 */
export const useProgress = (courseId: string) => useQuery<UberLearnProgress, Error>({
  queryKey: qk.progress(courseId),
  queryFn: () => getUberLearnProgress(courseId),
  enabled: Boolean(courseId),
  staleTime: 0,
  retry: 1,
});
