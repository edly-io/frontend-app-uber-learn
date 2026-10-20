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
  /** 0-based index of the first incomplete unit within that lesson. */
  nextStep: number;
  /** Total number of units (verticals) in that lesson. */
  unitCount: number;
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
  /**
   * Completed units / units, 0..1, counting only the units the learner can complete (gated and
   * empty ones are left out of both sides, unlike the course_home progress summary, which keeps
   * gated units in its total).
   */
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
  next_step: number;
  unit_count: number;
}

/**
 * A row as the API sends it. The counters are optional here on purpose: an older deployment of
 * uber-features may not send them all, and the mapping below falls back rather than render NaN.
 */
interface RawLearnCourse {
  course_id: string;
  title: string | null;
  image_url: string | null;
  start: string | null;
  end: string | null;
  lesson_count?: number;
  completed_lessons?: number;
  progress?: number;
  next_lesson: RawNextLesson | null;
  status: LearnCourseStatus;
  curriculum: string | null;
  last_activity: string | null;
  points?: number;
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
      ? {
        sequenceKey: row.next_lesson.sequence_key,
        title: row.next_lesson.title ?? null,
        nextStep: row.next_lesson.next_step ?? 0,
        unitCount: row.next_lesson.unit_count ?? 0,
      }
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
 * Answers for the logged-in learner only (no user parameter) and returns the courses sorted by
 * title, then course id. Replaces the per-course fan-out over the enrollment, course list, outline
 * and progress APIs.
 *
 * Rejects on any HTTP error, so callers can show their error state — except a 401, which the app's
 * global interceptor (App.tsx) turns into a redirect to /session-ended before the caller renders.
 */
export async function getLearnCourses(): Promise<LearnCourse[]> {
  const { data } = await getAuthenticatedHttpClient().get<RawLearnCourse[]>(
    `${getConfig().LMS_BASE_URL}/api/uber/learn/v1/courses/`,
  );
  return (data ?? []).map(toLearnCourse);
}
