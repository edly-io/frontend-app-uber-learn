import type { CourseOutline, OutlineSection, OutlineSequence } from '../api/courseware';

/**
 * A flat lesson descriptor — one per sequence, ready for the UI.
 */
export interface LessonDescriptor {
  sequenceId: string;
  sectionId: string;
  sectionTitle: string;
  lessonTitle: string;
  lessonIndex: number;
  /** True when all units in this sequence are complete (sourced from the outline API). */
  complete: boolean;
}

/**
 * Maps the nested CourseOutline structure into an ordered flat list of lessons.
 * Preserves section order → sequence order within each section.
 */
export function mapOutlineToLessons(outline: CourseOutline): LessonDescriptor[] {
  const lessons: LessonDescriptor[] = [];
  let lessonIndex = 0;

  // Sections are stored as a keyed map; the ordering comes from the API's
  // sections array. We use Object.values and rely on insertion order (guaranteed
  // in V8 for non-integer keys).
  Object.values(outline.sections).forEach((section: OutlineSection) => {
    section.sequenceIds.forEach((seqId) => {
      const seq: OutlineSequence | undefined = outline.sequences[seqId];
      if (!seq) { return; }

      lessons.push({
        sequenceId: seqId,
        sectionId: section.id,
        sectionTitle: section.title,
        lessonTitle: seq.title,
        lessonIndex,
        complete: seq.complete,
      });
      lessonIndex += 1;
    });
  });

  return lessons;
}

/**
 * Counts lesson-level (sequence-level) completion from the course outline.
 *
 * Use this instead of `completedUnits`/`totalUnits` from the progress API,
 * which counts XBlock units (steps) rather than lessons (sequences).
 */
export function countLessons(outline: CourseOutline): { total: number; completed: number } {
  const sequences = Object.values(outline.sequences);
  return {
    total: sequences.length,
    completed: sequences.filter((s) => s.complete).length,
  };
}
