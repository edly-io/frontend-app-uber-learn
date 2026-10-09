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

export interface CourseProgressSummary {
  completedUnits: number;
  totalUnits: number;
  fraction: number;
}

interface RawProgressResponse {
  completion_summary?: {
    complete_count?: number;
    incomplete_count?: number;
    locked_count?: number;
  };
}

export async function getCourseProgressSummary(courseId: string): Promise<CourseProgressSummary> {
  const { data } = await getAuthenticatedHttpClient().get<RawProgressResponse>(
    `${getConfig().LMS_BASE_URL}/api/course_home/v1/progress/${courseId}`,
  );
  const s = data.completion_summary ?? {};
  const completed = s.complete_count ?? 0;
  const incomplete = s.incomplete_count ?? 0;
  const locked = s.locked_count ?? 0;
  const total = completed + incomplete + locked;
  return {
    completedUnits: completed,
    totalUnits: total,
    fraction: total > 0 ? completed / total : 0,
  };
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

  const lmsBase = getConfig().LMS_BASE_URL as string;

  const toAbsoluteUrl = (relUrl: string | undefined | null): string | null => {
    if (!relUrl) { return null; }
    return relUrl.startsWith('http') ? relUrl : `${lmsBase}${relUrl}`;
  };

  return enrollments
    .filter((e) => e.is_active && Boolean(e.course_details?.course_id))
    .map((e) => ({
      courseId: e.course_details!.course_id!,
      title: e.course_details?.course_name ?? e.course_details?.course_id ?? '',
      imageUrl: toAbsoluteUrl(e.course_details?.course_image_url),
      courseStart: e.course_details?.course_start ?? null,
      courseEnd: e.course_details?.course_end ?? null,
      isActive: e.is_active,
    }));
}
