import { selectContinueCourse } from '../lib/selectContinueCourse';
import type { EnrolledCourse } from '../api/catalog';
import type { LearnerCurriculum } from '../api/curriculum';

const course = (courseId: string): EnrolledCourse => ({
  courseId, title: courseId, imageUrl: null, courseStart: null, courseEnd: null, isActive: true,
});

const path = (
  uuid: string,
  assignedAt: string,
  courses: Array<[string, boolean]>,
  kc: { id: string; retained?: boolean } = { id: `${uuid}-kc` },
): LearnerCurriculum => ({
  uuid,
  title: uuid,
  description: '',
  image_url: null,
  assigned_at: assignedAt,
  courses: courses.map(([id, finished], i) => ({
    course_id: id, display_name: null, exists: true, position: i + 1, finished, description: null, image_url: null,
  })),
  courses_finished: courses.filter(([, f]) => f).length,
  courses_total: courses.length,
  milestones: {
    complete: { reached_at: null, badge: null },
    retained: { reached_at: kc.retained ? '2026-10-01T00:00:00Z' : null, badge: null },
  },
  knowledge_check: {
    course_id: kc.id, display_name: null, exists: true, unlocks_at: null, is_open: false,
  },
});

const DEMO = course('course-v1:OpenedX+DemoX+DemoCourse');
const CON101 = course('course-v1:uber+CON101+2026');
const CON102 = course('course-v1:uber+CON102+2026');
const SEC103 = course('course-v1:uber+SEC103+2026');
const SAF101 = course('course-v1:uber+SAF101+2026');

const conduct = (con101Finished: boolean) => path('conduct', '2026-09-23T00:00:00Z', [
  [CON101.courseId, con101Finished], [CON102.courseId, false],
]);
const security = path('security', '2026-09-14T00:00:00Z', [['course-v1:uber+SEC101+2026', true], [SEC103.courseId, false]]);
const safety = path('safety', '2026-09-30T00:00:00Z', [[SAF101.courseId, false]]);

const ALL = [DEMO, CON101, CON102, SAF101, SEC103];

describe('selectContinueCourse', () => {
  it('returns the last-activity course when it is enrolled and unfinished', () => {
    const { course: picked, curriculum } = selectContinueCourse({
      enrolledCourses: ALL, curriculums: [conduct(false), safety, security], lastActivityCourseId: CON101.courseId,
    });
    expect(picked).toBe(CON101);
    expect(curriculum?.uuid).toBe('conduct');
  });

  it('moves to the next unfinished course in the same path when the last-activity course is finished', () => {
    // Mirrors the live `edx` data: last activity CON101 (finished), path "conduct" 1/3.
    const { course: picked, curriculum } = selectContinueCourse({
      enrolledCourses: ALL, curriculums: [conduct(true), safety, security], lastActivityCourseId: CON101.courseId,
    });
    expect(picked).toBe(CON102);
    expect(curriculum?.uuid).toBe('conduct');
  });

  it('prefers last activity over a more recently assigned, more advanced path', () => {
    const { course: picked } = selectContinueCourse({
      enrolledCourses: ALL, curriculums: [conduct(false), security], lastActivityCourseId: CON101.courseId,
    });
    // security has courses_finished > 0 and would win the path-priority fallback; last activity must win.
    expect(picked).toBe(CON101);
  });

  it('never features a course outside every path when a path-based choice exists (DemoX listed first)', () => {
    const { course: picked } = selectContinueCourse({
      enrolledCourses: ALL, curriculums: [conduct(true), safety], lastActivityCourseId: null,
    });
    expect(picked).toBe(CON102);
  });

  it('falls back to path priority when the last-activity course is not enrolled', () => {
    const { course: picked } = selectContinueCourse({
      enrolledCourses: [CON101, CON102, SAF101],
      curriculums: [conduct(true), safety],
      lastActivityCourseId: DEMO.courseId,
    });
    expect(picked).toBe(CON102);
  });

  it('skips a knowledge-check course whose retained milestone is already reached', () => {
    const doneKc = course('course-v1:uber+LDR-KC+2026');
    const leadership = path('leadership', '2026-08-15T00:00:00Z', [['course-v1:uber+LDR101+2026', true]], {
      id: doneKc.courseId, retained: true,
    });
    const { course: picked } = selectContinueCourse({
      enrolledCourses: [...ALL, doneKc],
      curriculums: [leadership, conduct(true)],
      lastActivityCourseId: doneKc.courseId,
    });
    expect(picked).toBe(CON102);
  });

  it('uses the first enrolled course when the learner has no paths and no activity', () => {
    const { course: picked, curriculum } = selectContinueCourse({
      enrolledCourses: [CON101, CON102], curriculums: [], lastActivityCourseId: null,
    });
    expect(picked).toBe(CON101);
    expect(curriculum).toBeNull();
  });

  it('returns null when nothing is enrolled', () => {
    expect(selectContinueCourse({ enrolledCourses: [], curriculums: [], lastActivityCourseId: null }))
      .toEqual({ course: null, curriculum: null });
  });
});
