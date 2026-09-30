import { useQuery } from '@tanstack/react-query';
import { getCourseOutline, type CourseOutline } from '../api/courseware';
import { qk } from '../api/queries';

export function useCourseOutline(courseId: string) {
  return useQuery<CourseOutline, Error>({
    queryKey: qk.outline(courseId),
    queryFn: () => getCourseOutline(courseId),
    enabled: Boolean(courseId),
    staleTime: 5 * 60_000,
  });
}
