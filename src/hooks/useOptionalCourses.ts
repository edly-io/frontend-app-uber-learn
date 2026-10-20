import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { enrollInOptionalCourse, getOptionalCourses, type OptionalCourse } from '../api/optionalCourses';
import { qk } from '../api/queries';

export type { OptionalCourse };

/** The optional courses the learner's groups offer (empty when they are in no group). */
export const useOptionalCourses = () => useQuery<OptionalCourse[], Error>({
  queryKey: qk.optionalCourses(),
  queryFn: getOptionalCourses,
  staleTime: 60_000,
  retry: 1,
});

/**
 * Enrolls the learner in an optional course. On success the enrolled-course list
 * and the optional courses (their `is_enrolled`) are refetched, and the mutation
 * settles only after that: the course overview reads the enrolled-course list,
 * and a stale one would show it the "not enrolled" page.
 */
export const useEnrollOptionalCourse = () => {
  const queryClient = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: enrollInOptionalCourse,
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.learnCourses() }),
      queryClient.invalidateQueries({ queryKey: qk.optionalCourses() }),
    ]),
  });
};
