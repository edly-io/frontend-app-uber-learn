import { useQuery } from '@tanstack/react-query';
import { getLearnCourses, type LearnCourse, type LearnCourseStatus } from '../api/learn';
import { qk } from '../api/queries';

export type { LearnCourse, LearnCourseStatus };

/** The learner's courses with progress, fetched in a single request for every course. */
export const useLearnCourses = () => useQuery<LearnCourse[], Error>({
  queryKey: qk.learnCourses(),
  queryFn: getLearnCourses,
  staleTime: 5 * 60_000,
});
