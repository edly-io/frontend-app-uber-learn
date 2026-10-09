import { useQuery } from '@tanstack/react-query';
import { getLeaderboard, type LeaderboardData } from '../api/gamification';
import { qk } from '../api/queries';

export type { LeaderboardData };

export const useLeaderboard = () => useQuery<LeaderboardData, Error>({
  queryKey: qk.leaderboard(),
  queryFn: getLeaderboard,
  staleTime: 60_000,
  retry: 1,
});
