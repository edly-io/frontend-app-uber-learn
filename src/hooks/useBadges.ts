import { useQuery } from '@tanstack/react-query';
import { getLearnerBadges, type BadgesPage } from '../api/curriculum';
import { qk } from '../api/queries';

export type { BadgesPage };

export const useBadges = (unseen = false) => useQuery<BadgesPage, Error>({
  queryKey: qk.badges(unseen),
  queryFn: () => getLearnerBadges(unseen),
  staleTime: 60_000,
  retry: 1,
});
