import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { getConfig } from '@edx/frontend-platform';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A group the learner belongs to that offers the course. */
export interface OptionalCourseGroup {
  slug: string;
  title: string;
}

/** One course from GET /api/uber/optional-courses/v1/courses/. */
export interface OptionalCourse {
  course_id: string;
  display_name: string;
  short_description: string;
  image_url: string | null;
  is_enrolled: boolean;
  groups: OptionalCourseGroup[];
}

/** Reasons the LMS refuses an optional-course enrollment; anything else is 'unknown'. */
export type OptionalEnrollErrorCode = 'not_optional_for_learner' | 'enrollment_not_allowed' | 'unknown';

function lmsBase(): string {
  return getConfig().LMS_BASE_URL as string;
}

/**
 * The optional courses offered to the learner by their groups. Empty when the
 * learner is in no group.
 */
export async function getOptionalCourses(): Promise<OptionalCourse[]> {
  const { data } = await getAuthenticatedHttpClient().get(
    `${lmsBase()}/api/uber/optional-courses/v1/courses/`,
  );
  return (data as { results?: OptionalCourse[] } | null)?.results ?? [];
}

/**
 * Enrolls the learner in one of their optional courses. The LMS answers 200
 * when they are already enrolled too. The authenticated client adds the CSRF
 * token to the POST.
 */
export async function enrollInOptionalCourse(courseId: string): Promise<void> {
  await getAuthenticatedHttpClient().post(
    `${lmsBase()}/api/uber/optional-courses/v1/courses/enroll/`,
    { course_id: courseId },
  );
}

/** The LMS `error_code` of a failed enrollment, read through the axios error. */
export function optionalEnrollErrorCode(error: unknown): OptionalEnrollErrorCode {
  const data = (error as { response?: { data?: unknown } } | null)?.response?.data;
  const code = data && typeof data === 'object' ? (data as Record<string, unknown>).error_code : null;
  if (code === 'not_optional_for_learner' || code === 'enrollment_not_allowed') {
    return code;
  }
  return 'unknown';
}
