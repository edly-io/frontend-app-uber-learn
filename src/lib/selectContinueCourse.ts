import type { EnrolledCourse } from '../api/catalog';
import type { LearnerCurriculum } from '../api/curriculum';

export interface ContinueSelectionInput {
  enrolledCourses: EnrolledCourse[];
  curriculums: LearnerCurriculum[];
  /** Course the learner last completed a block in (from the last-activity API), if any. */
  lastActivityCourseId: string | null;
  /** Course-level progress fraction keyed by curriculum uuid (for curricula with no finished course yet). */
  curriculumFraction?: Record<string, number>;
  /** Course IDs to never surface in the continue card (e.g. knowledge-check courses). */
  excludeCourseIds?: Set<string>;
}

export interface ContinueSelection {
  course: EnrolledCourse | null;
  /** The learning path the featured course belongs to, used for knowledge-check variant and art. */
  curriculum: LearnerCurriculum | null;
}

const byAssignedDesc = (a: LearnerCurriculum, b: LearnerCurriculum) => (
  new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime()
);

const isUnfinished = (c: LearnerCurriculum) => c.courses_total > 0 && c.courses_finished < c.courses_total;

const firstUnfinishedCourseId = (c: LearnerCurriculum): string | null => (
  c.courses.slice().sort((a, b) => a.position - b.position).find((course) => !course.finished)?.course_id ?? null
);

const containsCourse = (c: LearnerCurriculum, courseId: string) => (
  c.courses.some((course) => course.course_id === courseId) || c.knowledge_check?.course_id === courseId
);

/** Course IDs the learner is done with: finished required courses and passed knowledge checks. */
const finishedCourseIdsOf = (curriculums: LearnerCurriculum[]): Set<string> => {
  const ids = new Set<string>();
  curriculums.forEach((c) => {
    c.courses.forEach((course) => { if (course.finished) { ids.add(course.course_id); } });
    if (c.knowledge_check?.course_id && c.milestones?.retained?.reached_at) { ids.add(c.knowledge_check.course_id); }
  });
  return ids;
};

/** Curriculum priority when there is no usable last activity: started paths first, newest assignment first. */
const mostRelevantUnfinishedCurriculum = (
  unfinished: LearnerCurriculum[],
  fraction: Record<string, number>,
): LearnerCurriculum | null => {
  const sorted = unfinished.slice().sort(byAssignedDesc);
  return sorted.find((c) => c.courses_finished > 0)
    ?? sorted.find((c) => (fraction[c.uuid] ?? 0) > 0)
    ?? sorted[0]
    ?? null;
};

/**
 * Pick the course the dashboard "continue" card should feature.
 *
 * 1. The learner's last-activity course, if it is enrolled and not finished.
 * 2. Otherwise, if that course belongs to an unfinished path, the next unfinished course in that path.
 * 3. Otherwise, the next unfinished course of the most relevant unfinished path.
 * 4. Otherwise, the first enrolled course that is not finished, else the last enrolled course.
 *
 * Never relies on the order of `enrolledCourses` while a path-based answer exists: that order comes from the
 * LMS course listing (sorted by course key), not from learner activity.
 */
export function selectContinueCourse({
  enrolledCourses,
  curriculums,
  lastActivityCourseId,
  curriculumFraction = {},
  excludeCourseIds = new Set(),
}: ContinueSelectionInput): ContinueSelection {
  const enrolledById = new Map(enrolledCourses.map((c) => [c.courseId, c]));
  const finished = finishedCourseIdsOf(curriculums);
  const unfinishedPaths = curriculums.filter(isUnfinished).sort(byAssignedDesc);

  const pathFor = (courseId: string) => unfinishedPaths.find((c) => containsCourse(c, courseId))
    ?? curriculums.slice().sort(byAssignedDesc).find((c) => containsCourse(c, courseId))
    ?? null;

  const nextInPath = (path: LearnerCurriculum | null): ContinueSelection | null => {
    const nextId = path ? firstUnfinishedCourseId(path) : null;
    const course = nextId && !excludeCourseIds.has(nextId) ? enrolledById.get(nextId) : undefined;
    return course ? { course, curriculum: path } : null;
  };

  if (lastActivityCourseId && !excludeCourseIds.has(lastActivityCourseId)) {
    const lastCourse = enrolledById.get(lastActivityCourseId);
    if (lastCourse && !finished.has(lastActivityCourseId)) {
      return { course: lastCourse, curriculum: pathFor(lastActivityCourseId) };
    }
    const lastPath = unfinishedPaths.find((c) => containsCourse(c, lastActivityCourseId)) ?? null;
    const fromLastPath = nextInPath(lastPath);
    if (fromLastPath) { return fromLastPath; }
  }

  const fromRelevantPath = nextInPath(mostRelevantUnfinishedCurriculum(unfinishedPaths, curriculumFraction));
  if (fromRelevantPath) { return fromRelevantPath; }

  const nonExcluded = enrolledCourses.filter((c) => !excludeCourseIds.has(c.courseId));
  const fallback = nonExcluded.find((c) => !finished.has(c.courseId))
    ?? nonExcluded[nonExcluded.length - 1]
    ?? null;
  return { course: fallback, curriculum: fallback ? pathFor(fallback.courseId) : null };
}
