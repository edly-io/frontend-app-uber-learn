import { getConfig } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LearnCourseStatus = 'not_started' | 'in_progress' | 'completed';

export interface LearnNextLesson {
  /** Usage key of the sequential (lesson) the learner should do next. */
  sequenceKey: string;
  title: string | null;
}

/** One actively enrolled course with the learner's progress in it. */
export interface LearnCourse {
  courseId: string;
  title: string;
  imageUrl: string | null;
  courseStart: string | null;
  courseEnd: string | null;
  lessonCount: number;
  completedLessons: number;
  /** Completed units / units, 0..1 — the same ratio the course_home progress summary gave. */
  progress: number;
  /** null when every lesson is complete, or the course has no lesson. */
  nextLesson: LearnNextLesson | null;
  status: LearnCourseStatus;
  /** Title of the learning path the course belongs to, null when it belongs to none. */
  curriculum: string | null;
  /** ISO timestamp of the learner's last block completion in this course, null when never. */
  lastActivity: string | null;
  /** Points the learner has earned in this course. */
  points: number;
}

interface RawNextLesson {
  sequence_key: string;
  title: string | null;
}

interface RawLearnCourse {
  course_id: string;
  title: string | null;
  image_url: string | null;
  start: string | null;
  end: string | null;
  lesson_count: number;
  completed_lessons: number;
  progress: number;
  next_lesson: RawNextLesson | null;
  status: LearnCourseStatus;
  curriculum: string | null;
  last_activity: string | null;
  points: number;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

function toLearnCourse(row: RawLearnCourse): LearnCourse {
  return {
    courseId: row.course_id,
    title: row.title ?? row.course_id,
    imageUrl: row.image_url ?? null,
    courseStart: row.start ?? null,
    courseEnd: row.end ?? null,
    lessonCount: row.lesson_count ?? 0,
    completedLessons: row.completed_lessons ?? 0,
    progress: row.progress ?? 0,
    nextLesson: row.next_lesson
      ? { sequenceKey: row.next_lesson.sequence_key, title: row.next_lesson.title ?? null }
      : null,
    status: row.status,
    curriculum: row.curriculum ?? null,
    lastActivity: row.last_activity ?? null,
    points: row.points ?? 0,
  };
}

/**
 * The learner's active enrollments with their progress, in one request.
 *
 * Answers for the logged-in learner only (no user parameter) and returns the courses sorted by title.
 * Replaces the per-course fan-out over the enrollment, course list, outline and progress APIs.
 * Rejects on any HTTP error (401 when the session has expired); callers show their error state.
 */
export async function getLearnCourses(): Promise<LearnCourse[]> {
  const { data } = await getAuthenticatedHttpClient().get<RawLearnCourse[]>(
    `${getConfig().LMS_BASE_URL}/api/uber/learn/v1/courses/`,
  );
  return (data ?? []).map(toLearnCourse);
}
