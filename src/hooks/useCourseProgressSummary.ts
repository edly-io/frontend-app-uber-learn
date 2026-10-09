import { useQuery } from '@tanstack/react-query';
import { getCourseProgressSummary, type CourseProgressSummary } from '../api/catalog';
import { qk } from '../api/queries';

export type { CourseProgressSummary };

export const useCourseProgressSummary = (courseId: string) => useQuery<CourseProgressSummary, Error>({
  queryKey: qk.courseProgress(courseId),
  queryFn: () => getCourseProgressSummary(courseId),
  staleTime: 2 * 60_000,
  retry: 1,
});
