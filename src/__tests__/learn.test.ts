import { getLearnCourses } from '../api/learn';

const LMS = 'http://lms.test';
const mockGet = jest.fn();

jest.mock('@edx/frontend-platform', () => ({
  getConfig: () => ({ LMS_BASE_URL: 'http://lms.test' }),
}));
jest.mock('@edx/frontend-platform/auth', () => ({
  getAuthenticatedHttpClient: () => ({ get: mockGet }),
}));

const CON101 = 'course-v1:uber+CON101+2026';

const row = (overrides: Record<string, unknown> = {}) => ({
  course_id: CON101,
  title: 'Conduct',
  image_url: `${LMS}/asset-v1:uber+CON101+2026+type@asset+block@cover.png`,
  start: '2026-09-01T00:00:00Z',
  end: null,
  lesson_count: 4,
  completed_lessons: 1,
  progress: 0.375,
  next_lesson: { sequence_key: 'block-v1:seq', title: 'Lesson 2', next_step: 0 },
  status: 'in_progress',
  curriculum: 'Driver basics',
  last_activity: '2026-10-07T09:30:00Z',
  points: 40,
  ...overrides,
});

beforeEach(() => mockGet.mockReset());

describe('getLearnCourses', () => {
  it('reads every enrolled course with its progress in one request', async () => {
    mockGet.mockResolvedValue({ data: [row(), row({ course_id: 'course-v1:uber+SEC103+2026' })] });

    const courses = await getLearnCourses();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(`${LMS}/api/uber/learn/v1/courses/`);
    expect(courses).toHaveLength(2);
    expect(courses[0]).toEqual({
      courseId: CON101,
      title: 'Conduct',
      imageUrl: `${LMS}/asset-v1:uber+CON101+2026+type@asset+block@cover.png`,
      courseStart: '2026-09-01T00:00:00Z',
      courseEnd: null,
      lessonCount: 4,
      completedLessons: 1,
      progress: 0.375,
      nextLesson: { sequenceKey: 'block-v1:seq', title: 'Lesson 2', nextStep: 0 },
      status: 'in_progress',
      curriculum: 'Driver basics',
      lastActivity: '2026-10-07T09:30:00Z',
      points: 40,
    });
  });

  it('falls back to the course id when the course has no title, and keeps a null next lesson', async () => {
    mockGet.mockResolvedValue({ data: [row({ title: null, next_lesson: null })] });

    const [course] = await getLearnCourses();

    expect(course.title).toBe(CON101);
    expect(course.nextLesson).toBeNull();
  });

  it('rejects when the request fails so callers can show their error state', async () => {
    mockGet.mockRejectedValue(new Error('401'));

    await expect(getLearnCourses()).rejects.toThrow('401');
  });
});
