import React from 'react';
import type { LessonDescriptor } from '../../lib/outline-mapper';

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
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        width: '100%',
        padding: '1rem var(--u-page-gutter)',
        background: isActive ? 'var(--u-mastery-light)' : 'transparent',
        border: 'none',
        borderBottom: '1px solid var(--u-border-opaque)',
        cursor: 'pointer',
        textAlign: 'left',
        minHeight: '64px',
      }}
    >
      {/* Completion indicator — RULE-002: mastery green ONLY for checkmarks */}
      <span
        aria-hidden="true"
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isCompleted ? 'var(--u-mastery)' : 'var(--u-background-state-disabled)',
        }}
      >
        {isCompleted && (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path
            d="M2 7L5.5 10.5L12 3.5"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        )}
      </span>

      <span style={{ flex: 1 }}>
        <span
          style={{
            display: 'block',
            fontSize: '0.75rem',
            color: 'var(--u-content-secondary)',
            marginBottom: '0.125rem',
          }}
        >
          {lesson.sectionTitle}
        </span>
        <span
          style={{
            display: 'block',
            fontFamily: 'var(--u-font-body)',
            fontWeight: 500,
            fontSize: '0.9375rem',
            color: 'var(--u-content-primary)',
          }}
        >
          {lesson.lessonTitle}
        </span>
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
