import {
  mapOutlineToLessons, findNextLessonIndex, markSequenceComplete, countLessons,
} from '../lib/outline-mapper';
import type { CourseOutline } from '../api/courseware';

const buildOutline = (): CourseOutline => ({
  courseId: 'course-v1:Uber+Learn+2024',
  title: 'Driver Safety 101',
  sections: {
    'section-1': {
      id: 'section-1',
      title: 'Module 1',
      sequenceIds: ['seq-1a', 'seq-1b'],
    },
    'section-2': {
      id: 'section-2',
      title: 'Module 2',
      sequenceIds: ['seq-2a'],
    },
  },
  sequences: {
    'seq-1a': {
      id: 'seq-1a', title: 'Intro Video', sectionId: 'section-1', complete: false,
    },
    'seq-1b': {
      id: 'seq-1b', title: 'Quiz 1', sectionId: 'section-1', complete: false,
    },
    'seq-2a': {
      id: 'seq-2a', title: 'Advanced Topics', sectionId: 'section-2', complete: false,
    },
  },
});

describe('mapOutlineToLessons', () => {
  it('returns a flat list of lessons in section → sequence order', () => {
    const lessons = mapOutlineToLessons(buildOutline());
    expect(lessons).toHaveLength(3);
    expect(lessons[0].sequenceId).toBe('seq-1a');
    expect(lessons[1].sequenceId).toBe('seq-1b');
    expect(lessons[2].sequenceId).toBe('seq-2a');
  });

  it('assigns sequential lessonIndex values starting from 0', () => {
    const lessons = mapOutlineToLessons(buildOutline());
    expect(lessons[0].lessonIndex).toBe(0);
    expect(lessons[1].lessonIndex).toBe(1);
    expect(lessons[2].lessonIndex).toBe(2);
  });

  it('populates sectionTitle and lessonTitle from the outline', () => {
    const lessons = mapOutlineToLessons(buildOutline());
    expect(lessons[0].sectionTitle).toBe('Module 1');
    expect(lessons[0].lessonTitle).toBe('Intro Video');
    expect(lessons[2].sectionTitle).toBe('Module 2');
    expect(lessons[2].lessonTitle).toBe('Advanced Topics');
  });

  it('returns empty array for an outline with no sections', () => {
    const emptyOutline: CourseOutline = {
      courseId: 'x',
      title: 'Empty',
      sections: {},
      sequences: {},
    };
    expect(mapOutlineToLessons(emptyOutline)).toEqual([]);
  });

  it('skips sequences that are missing from the sequences map', () => {
    const outline: CourseOutline = {
      courseId: 'x',
      title: 'Test',
      sections: {
        s1: { id: 's1', title: 'S1', sequenceIds: ['existing', 'missing'] },
      },
      sequences: {
        existing: {
          id: 'existing', title: 'Good', sectionId: 's1', complete: false,
        },
        // 'missing' is not in sequences map
      },
    };
    const lessons = mapOutlineToLessons(outline);
    expect(lessons).toHaveLength(1);
    expect(lessons[0].sequenceId).toBe('existing');
  });
});

describe('findNextLessonIndex', () => {
  const withComplete = (flags: boolean[]): CourseOutline => {
    const outline = buildOutline();
    const ids = ['seq-1a', 'seq-1b', 'seq-2a'];
    return {
      ...outline,
      sequences: Object.fromEntries(ids.map((id, i) => [id, { ...outline.sequences[id], complete: flags[i] }])),
    };
  };

  it('returns the first incomplete lesson regardless of later completions', () => {
    expect(findNextLessonIndex(mapOutlineToLessons(withComplete([true, false, true])))).toBe(1);
  });

  it('returns 0 when nothing is complete', () => {
    expect(findNextLessonIndex(mapOutlineToLessons(withComplete([false, false, false])))).toBe(0);
  });

  it('returns -1 when every lesson is complete', () => {
    expect(findNextLessonIndex(mapOutlineToLessons(withComplete([true, true, true])))).toBe(-1);
  });
});

describe('markSequenceComplete', () => {
  it('returns a new outline with only the given sequence flagged complete', () => {
    const outline = buildOutline();
    const before = countLessons(outline).completed;

    const next = markSequenceComplete(outline, 'seq-1b');

    expect(next).not.toBe(outline);
    expect(next?.sequences['seq-1b'].complete).toBe(true);
    expect(countLessons(next!).completed).toBe(before + 1);
    expect(outline.sequences['seq-1b'].complete).toBe(false);
  });

  it('returns the input unchanged for unknown sequences or a missing outline', () => {
    const outline = buildOutline();
    expect(markSequenceComplete(outline, 'nope')).toBe(outline);
    expect(markSequenceComplete(undefined, 'seq-1a')).toBeUndefined();
  });
});
