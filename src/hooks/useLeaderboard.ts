import { useQuery } from '@tanstack/react-query';
import { getLeaderboard, type LeaderboardData } from '../api/gamification';
import { qk } from '../api/queries';

export type { LeaderboardData };

export const useLeaderboard = (above: number, below: number) => useQuery<LeaderboardData, Error>({
  queryKey: qk.leaderboard(above, below),
  queryFn: () => getLeaderboard(above, below),
  staleTime: 60_000,
  retry: 1,
});
