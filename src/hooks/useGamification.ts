import { useQuery } from '@tanstack/react-query';
import { getGamificationSummary, type GamificationSummary } from '../api/gamification';
import { qk } from '../api/queries';

export type { GamificationSummary };

export const useGamification = () => useQuery<GamificationSummary, Error>({
  queryKey: qk.gamification(),
  queryFn: getGamificationSummary,
  staleTime: 60_000,
  retry: 1,
});
