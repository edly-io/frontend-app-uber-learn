import type { LessonDescriptor } from './outline-mapper';

const key = (courseId: string) => `uber-learn:resume:${courseId}`;

export function storeResumeSequence(courseId: string, sequenceId: string): void {
  try {
    localStorage.setItem(key(courseId), sequenceId);
  } catch {
    // storage unavailable — no-op
  }
}

/**
 * Returns the index (in `lessons`) of the stored resume sequence, or -1 if none.
 * When multiple sources are available, callers should take the maximum index.
 */
export function getStoredResumeIdx(courseId: string, lessons: LessonDescriptor[]): number {
  try {
    const stored = localStorage.getItem(key(courseId));
    if (!stored) { return -1; }
    return lessons.findIndex((l) => l.sequenceId === stored);
  } catch {
    return -1;
  }
}

export function getStoredResumeSequenceId(courseId: string): string | null {
  try {
    return localStorage.getItem(key(courseId));
  } catch {
    return null;
  }
}
