import { useQuery, type Query } from '@tanstack/react-query';
import { getLessonResults, type LessonResults } from '../api/gamification';
import { qk } from '../api/queries';

export type { LessonResults };

// Points rows are written by Celery award tasks queued after the completion/score commits
// (uber_features.gamification.signals), so the first read can miss the last step's points.
// Re-read a few times so the page settles on the full total instead of freezing on a partial one.
export const LESSON_RESULTS_REFETCH_INTERVAL_MS = 1500;
export const LESSON_RESULTS_MAX_READS = 4;

const settleInterval = (query: Query<LessonResults, Error>): number | false => {
  // Count only successful reads toward the settlement budget — transient network errors
  // (handled by retry:1) should not prematurely stop polling and leave the page empty.
  const { dataUpdateCount } = query.state;
  return dataUpdateCount < LESSON_RESULTS_MAX_READS
    ? LESSON_RESULTS_REFETCH_INTERVAL_MS
    : false;
};

/**
 * Results of a lesson for the current run. Providing `since` scopes the result
 * to this run only (one cache entry per run, so repeat completions don't get
 * the first run's cached data). Without `since` the query returns all-time data.
 */
export const useLessonResults = (sequenceId: string | undefined, since?: string | null) => useQuery<
LessonResults, Error
>({
  queryKey: qk.lessonResults(sequenceId ?? '', since ?? undefined),
  queryFn: () => getLessonResults(sequenceId!, since ?? undefined),
  enabled: Boolean(sequenceId),
  staleTime: Infinity,
  refetchInterval: settleInterval,
  retry: 1,
});
