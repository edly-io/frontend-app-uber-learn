import { getConfig } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';

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
