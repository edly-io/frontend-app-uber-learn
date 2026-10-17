import React from 'react';
import type { LessonDescriptor } from '../../lib/outline-mapper';
import './lesson-card.scss';

interface LessonCardProps {
  lesson: LessonDescriptor;
  isCompleted?: boolean;
  isActive?: boolean;
  onClick: (sequenceId: string) => void;
}

export const LessonCard = ({
  lesson, isCompleted = false, isActive = false, onClick,
}: LessonCardProps) => (
  <li>
    <button
      type="button"
      onClick={() => onClick(lesson.sequenceId)}
      aria-current={isActive ? 'step' : undefined}
      className={`lesson-card${isActive ? ' lesson-card--active' : ''}`}
    >
      {/* Completion indicator — RULE-002: mastery green ONLY for checkmarks */}
      <span
        aria-hidden="true"
        className={`lesson-card__icon${isCompleted ? ' lesson-card__icon--completed' : ''}`}
      >
        {isCompleted && (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M2 7L5.5 10.5L12 3.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>

      <span className="lesson-card__text">
        <span className="lesson-card__kicker">{lesson.sectionTitle}</span>
        <span className="lesson-card__title">{lesson.lessonTitle}</span>
      </span>

      {/* Chevron */}
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M6 12L10 8L6 4"
          stroke="var(--u-content-secondary)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  </li>
);
