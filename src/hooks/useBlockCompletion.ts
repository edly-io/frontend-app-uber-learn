import { useQuery } from '@tanstack/react-query';
import { getBlockCompletion } from '../api/progress';
import { qk } from '../api/queries';

/**
 * Polls get_completion every 3 seconds for interactive units (problem/graded XBlocks).
 * Mirrors frontend-app-learning's useCheckBlockCompletion pattern but uses polling
 * instead of an on-navigate mutation, since we have no plugin.completed postMessage.
 *
 * Polling stops as soon as the server returns complete:true; the cached true value
 * persists for the lifetime of this unit visit.
 */
export function useBlockCompletion(
  courseId: string,
  sequenceId: string,
  unitId: string | null,
  enabled: boolean,
): boolean {
  const { data } = useQuery({
    queryKey: qk.blockCompletion(courseId, sequenceId, unitId),
    queryFn: () => getBlockCompletion(courseId, sequenceId, unitId!),
    enabled: enabled && unitId !== null,
    refetchInterval: (query) => (query.state.data === true ? false : 3_000),
    refetchOnWindowFocus: false,
  });
  return data === true;
}
