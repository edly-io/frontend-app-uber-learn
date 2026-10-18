import React from 'react';
import type { LessonDescriptor } from '../../lib/outline-mapper';
import { LessonCard } from './LessonCard';
import './lesson-list.scss';

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
    return <p className="lesson-list__empty">No lessons available.</p>;
  }

  return (
    <ul className="lesson-list">
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
