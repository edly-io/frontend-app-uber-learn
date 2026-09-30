import React from 'react';
import type { LessonDescriptor } from '../../lib/outline-mapper';
import { LessonCard } from './LessonCard';

interface LessonListProps {
  lessons: LessonDescriptor[];
  completedSequenceIds?: Set<string>;
  activeSequenceId?: string;
  onLessonClick: (sequenceId: string) => void;
}

export const LessonList = ({
  lessons,
  completedSequenceIds = new Set(),
  activeSequenceId,
  onLessonClick,
}: LessonListProps) => {
  if (lessons.length === 0) {
    return (
      <p
        style={{
          padding: 'var(--u-page-gutter)',
          color: 'var(--u-content-secondary)',
          textAlign: 'center',
        }}
      >
        No lessons available.
      </p>
    );
  }

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {lessons.map((lesson) => (
        <LessonCard
          key={lesson.sequenceId}
          lesson={lesson}
          isCompleted={completedSequenceIds.has(lesson.sequenceId)}
          isActive={lesson.sequenceId === activeSequenceId}
          onClick={onLessonClick}
        />
      ))}
    </ul>
  );
};
