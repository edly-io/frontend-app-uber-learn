import { getConfig } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient, getAuthenticatedUser } from '@edx/frontend-platform/auth';

export interface EnrolledCourse {
  courseId: string;
  title: string;
  imageUrl: string | null;
  courseStart: string | null;
  courseEnd: string | null;
  isActive: boolean;
}

interface RawEnrollment {
  // course_id lives INSIDE course_details in the edX enrollment API v1 response.
  // It is NOT present at the top level of each enrollment object.
  is_active: boolean;
  course_details?: {
    course_id?: string;
    course_name?: string;
    course_image_url?: string;
    course_start?: string | null;
    course_end?: string | null;
  };
}

export async function getEnrolledCourses(): Promise<EnrolledCourse[]> {
  const user = getAuthenticatedUser();
  const username = (user as { username?: string } | null)?.username ?? '';
  const url = `${getConfig().LMS_BASE_URL}/api/enrollment/v1/enrollment?username=${encodeURIComponent(username)}&is_active=true`;
  const { data } = await getAuthenticatedHttpClient().get(url);

  const enrollments = Array.isArray(data) ? (data as RawEnrollment[]) : [];

  return enrollments
    .filter((e) => e.is_active && Boolean(e.course_details?.course_id))
    .map((e) => ({
      courseId: e.course_details!.course_id!,
      title: e.course_details?.course_name ?? e.course_details?.course_id ?? '',
      imageUrl: e.course_details?.course_image_url ?? null,
      courseStart: e.course_details?.course_start ?? null,
      courseEnd: e.course_details?.course_end ?? null,
      isActive: e.is_active,
    }));
}
