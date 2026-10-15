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

interface RawCourseListItem {
  id?: string;
  course_id?: string;
  name?: string;
  start?: string | null;
  end?: string | null;
  media?: {
    course_image?: { uri?: string };
    image?: { raw?: string };
  };
}

interface RawCourseListResponse {
  results?: RawCourseListItem[];
  pagination?: { next?: string | null };
}

interface RawEnrollment {
  course_details?: { course_id?: string };
  is_active?: boolean;
}

/** Max page size accepted by the LMS course list API. */
const COURSE_LIST_PAGE_SIZE = 100;
/** Keeps the course_keys query string well under URL length limits. */
const COURSE_KEYS_BATCH_SIZE = 50;

async function getActiveEnrollmentCourseIds(lmsBase: string): Promise<string[]> {
  const { data } = await getAuthenticatedHttpClient().get<RawEnrollment[]>(
    `${lmsBase}/api/enrollment/v1/enrollment`,
  );
  return (data ?? [])
    .filter((e) => e.is_active)
    .map((e) => e.course_details?.course_id)
    .filter((id): id is string => Boolean(id));
}

async function fetchBatch(lmsBase: string, username: string, batch: string[]): Promise<RawCourseListItem[]> {
  const items: RawCourseListItem[] = [];
  let page = 1;
  let hasNext = true;
  while (hasNext) {
    // eslint-disable-next-line no-await-in-loop
    const { data } = await getAuthenticatedHttpClient().get<RawCourseListResponse>(
      `${lmsBase}/api/courses/v1/courses/`,
      {
        params: {
          username, course_keys: batch.join(','), page_size: COURSE_LIST_PAGE_SIZE, page,
        },
      },
    );
    items.push(...(data?.results ?? []));
    hasNext = Boolean(data?.pagination?.next);
    page += 1;
  }
  return items;
}

/** Course metadata for the given keys, fetching all batches in parallel. */
async function getCourseListItems(lmsBase: string, username: string, courseKeys: string[]) {
  const batches: string[][] = [];
  for (let i = 0; i < courseKeys.length; i += COURSE_KEYS_BATCH_SIZE) {
    batches.push(courseKeys.slice(i, i + COURSE_KEYS_BATCH_SIZE));
  }
  const results = await Promise.all(batches.map((batch) => fetchBatch(lmsBase, username, batch)));
  return results.flat();
}

/**
 * The learner's actively enrolled courses with catalog metadata.
 *
 * Enrollment comes from the enrollment API; the course list API alone returns every course *visible* to the
 * user (paginated, ordered by course key), which includes courses they are not enrolled in.
 */
export async function getEnrolledCourses(): Promise<EnrolledCourse[]> {
  const user = getAuthenticatedUser();
  const username = (user as { username?: string } | null)?.username ?? '';
  const lmsBase = getConfig().LMS_BASE_URL as string;

  const toAbsoluteUrl = (relUrl: string | undefined | null): string | null => {
    if (!relUrl) { return null; }
    return relUrl.startsWith('http') ? relUrl : `${lmsBase}${relUrl}`;
  };

  const enrolledIds = await getActiveEnrollmentCourseIds(lmsBase);
  if (enrolledIds.length === 0) { return []; }
  const enrolledSet = new Set(enrolledIds);
  const results = await getCourseListItems(lmsBase, username, enrolledIds);

  return results
    .filter((c) => enrolledSet.has((c.id ?? c.course_id) ?? ''))
    .filter((c) => Boolean(c.id ?? c.course_id))
    .map((c) => {
      const courseId = (c.id ?? c.course_id)!;
      const imageUri = c.media?.image?.raw ?? c.media?.course_image?.uri;
      return {
        courseId,
        title: c.name ?? courseId,
        imageUrl: toAbsoluteUrl(imageUri ?? null),
        courseStart: c.start ?? null,
        courseEnd: c.end ?? null,
        isActive: true,
      };
    });
}
