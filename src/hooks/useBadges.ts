import { useQuery } from '@tanstack/react-query';
import { getLearnerBadges, type BadgesResponse } from '../api/curriculum';
import { qk } from '../api/queries';

export type { BadgesResponse };

export const useBadges = (unseen = false) => useQuery<BadgesResponse, Error>({
  queryKey: qk.badges(unseen),
  queryFn: () => getLearnerBadges(unseen),
  staleTime: 60_000,
  retry: 1,
});
