import { getEnrolledCourses } from '../api/catalog';

const LMS = 'http://lms.test';
const mockGet = jest.fn();

jest.mock('@edx/frontend-platform', () => ({
  getConfig: () => ({ LMS_BASE_URL: 'http://lms.test' }),
}));
jest.mock('@edx/frontend-platform/auth', () => ({
  getAuthenticatedHttpClient: () => ({ get: mockGet }),
  getAuthenticatedUser: () => ({ username: 'edx' }),
}));

const DEMO = 'course-v1:OpenedX+DemoX+DemoCourse';
const CON101 = 'course-v1:uber+CON101+2026';
const SEC103 = 'course-v1:uber+SEC103+2026';

const enrollment = (courseId: string, isActive: boolean) => ({
  course_details: { course_id: courseId }, is_active: isActive,
});
const courseRow = (id: string) => ({
  id, name: id, start: null, end: null, media: {},
});

/** Fake LMS: the catalog API lists every visible course (paginated, key-ordered) unless course_keys filters it. */
function fakeLms(catalog: string[], enrollments: ReturnType<typeof enrollment>[]) {
  mockGet.mockImplementation((url: string, config?: { params?: Record<string, string | number> }) => {
    if (url.startsWith(`${LMS}/api/enrollment/v1/enrollment`)) {
      return Promise.resolve({ data: enrollments });
    }
    if (url.startsWith(`${LMS}/api/courses/v1/courses/`)) {
      const query = new URL(url).searchParams;
      const keysParam = config?.params?.course_keys ?? query.get('course_keys');
      const keys = keysParam ? String(keysParam).split(',') : null;
      const rows = catalog.filter((id) => !keys || keys.includes(id));
      const page = Number(config?.params?.page ?? query.get('page') ?? 1);
      const size = Number(config?.params?.page_size ?? 10);
      const slice = rows.slice((page - 1) * size, page * size);
      const hasNext = page * size < rows.length;
      return Promise.resolve({
        data: {
          results: slice.map(courseRow),
          pagination: { next: hasNext ? `${LMS}/api/courses/v1/courses/?page=${page + 1}` : null },
        },
      });
    }
    return Promise.reject(new Error(`unexpected url ${url}`));
  });
}

beforeEach(() => mockGet.mockReset());

describe('getEnrolledCourses', () => {
  it('excludes courses the learner is not actively enrolled in, even if the catalog lists them first', async () => {
    fakeLms([DEMO, CON101, SEC103], [enrollment(DEMO, false), enrollment(CON101, true), enrollment(SEC103, true)]);
    const ids = (await getEnrolledCourses()).map((c) => c.courseId);
    expect(ids).not.toContain(DEMO);
    expect(ids.sort()).toEqual([CON101, SEC103]);
  });

  it('returns enrolled courses beyond the first catalog page', async () => {
    // 25 catalog courses sorted before SEC103 push it off page 1 of the default page size (10).
    const filler = Array.from({ length: 25 }, (_, i) => `course-v1:aaa+F${String(i).padStart(2, '0')}+2026`);
    fakeLms([...filler, CON101, SEC103], [enrollment(CON101, true), enrollment(SEC103, true)]);
    const ids = (await getEnrolledCourses()).map((c) => c.courseId);
    expect(ids.sort()).toEqual([CON101, SEC103]);
  });

  it('returns an empty list without querying the catalog when there are no active enrollments', async () => {
    fakeLms([DEMO], [enrollment(DEMO, false)]);
    expect(await getEnrolledCourses()).toEqual([]);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});
