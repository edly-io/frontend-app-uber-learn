import { mapOutlineToLessons } from '../lib/outline-mapper';
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
    'seq-1a': { id: 'seq-1a', title: 'Intro Video', sectionId: 'section-1' },
    'seq-1b': { id: 'seq-1b', title: 'Quiz 1', sectionId: 'section-1' },
    'seq-2a': { id: 'seq-2a', title: 'Advanced Topics', sectionId: 'section-2' },
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
        existing: { id: 'existing', title: 'Good', sectionId: 's1' },
        // 'missing' is not in sequences map
      },
    };
    const lessons = mapOutlineToLessons(outline);
    expect(lessons).toHaveLength(1);
    expect(lessons[0].sequenceId).toBe('existing');
  });
});
