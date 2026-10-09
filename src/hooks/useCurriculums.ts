import { useQuery } from '@tanstack/react-query';
import { getLearnerCurriculums, type LearnerCurriculum } from '../api/curriculum';
import { qk } from '../api/queries';

export type { LearnerCurriculum };

export const useCurriculums = () => useQuery<LearnerCurriculum[], Error>({
  queryKey: qk.curriculums(),
  queryFn: getLearnerCurriculums,
  staleTime: 60_000,
  retry: 1,
});
