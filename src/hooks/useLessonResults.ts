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
 * Results of one run of a lesson. `since` is optional — omitting it returns all-time
 * results for the sequence. Disabled until `sequenceId` is known.
 */
export const useLessonResults = (sequenceId: string | undefined, since?: string) => useQuery<
LessonResults, Error
>({
  queryKey: qk.lessonResults(sequenceId ?? '', since),
  queryFn: () => getLessonResults(sequenceId!, since),
  enabled: Boolean(sequenceId),
  staleTime: Infinity,
  refetchInterval: settleInterval,
  retry: 1,
});
