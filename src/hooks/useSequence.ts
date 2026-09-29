import { useQuery } from '@tanstack/react-query';
import { getSequenceMetadata, type SequenceData, type SequenceUnit } from '../api/courseware';
import { qk } from '../api/queries';

interface UseSequenceResult {
  sequence: SequenceData | undefined;
  units: SequenceUnit[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

export function useSequence(sequenceId: string): UseSequenceResult {
  const {
    data, isLoading, isError, error,
  } = useQuery<
  { sequence: SequenceData; units: SequenceUnit[] },
  Error
  >({
    queryKey: qk.sequence(sequenceId),
    queryFn: () => getSequenceMetadata(sequenceId),
    enabled: Boolean(sequenceId),
    staleTime: 5 * 60_000,
  });

  return {
    sequence: data?.sequence,
    units: data?.units ?? [],
    isLoading,
    isError,
    error: error ?? null,
  };
}
