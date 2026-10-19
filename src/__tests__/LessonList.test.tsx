/**
 * Tests for LessonCard and LessonList components.
 *
 * AC coverage:
 *   LC-RENDERS:   renders lesson title and section title
 *   LC-CLICK:     calls onClick with sequenceId on button click
 *   LC-ACTIVE:    isActive=true adds aria-current="step" and --active class
 *   LC-INACTIVE:  isActive=false omits aria-current and --active class
 *   LC-COMPLETED: isCompleted=true shows checkmark svg and --completed icon class
 *   LC-UNCOMPLETED: isCompleted=false omits checkmark
 *
 *   LL-RENDERS:   renders a list of lesson cards
 *   LL-EMPTY:     shows empty message when lessons array is empty
 *   LL-COMPLETED: cards in completedSequenceIds get isCompleted=true
 *   LL-ACTIVE:    card matching activeSequenceId gets isActive=true
 *   LL-CLICK:     click on a card calls onLessonClick with the right sequenceId
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LessonCard } from '../components/lesson-list/LessonCard';
import { LessonList } from '../components/lesson-list/LessonList';
import type { LessonDescriptor } from '../lib/outline-mapper';

const LESSON: LessonDescriptor = {
  sequenceId: 'seq-1',
  sectionId: 'sec-1',
  lessonTitle: 'Introduction to Safety',
  sectionTitle: 'Unit 1',
  lessonIndex: 0,
  complete: false,
};

const LESSON_2: LessonDescriptor = {
  sequenceId: 'seq-2',
  sectionId: 'sec-1',
  lessonTitle: 'Advanced Techniques',
  sectionTitle: 'Unit 2',
  lessonIndex: 1,
  complete: false,
};

// ── LessonCard ────────────────────────────────────────────────────────────────

describe('LessonCard', () => {
  it('LC-RENDERS: renders lesson title and section title', () => {
    render(<LessonCard lesson={LESSON} onClick={jest.fn()} />);
    expect(screen.getByText('Introduction to Safety')).toBeInTheDocument();
    expect(screen.getByText('Unit 1')).toBeInTheDocument();
  });

  it('LC-CLICK: calls onClick with sequenceId when button is clicked', () => {
    const onClick = jest.fn();
    render(<LessonCard lesson={LESSON} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith('seq-1');
  });

  it('LC-ACTIVE: isActive adds aria-current=step and --active class', () => {
    render(<LessonCard lesson={LESSON} isActive onClick={jest.fn()} />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-current', 'step');
    expect(btn.className).toContain('lesson-card--active');
  });

  it('LC-INACTIVE: isActive=false omits aria-current and --active class', () => {
    render(<LessonCard lesson={LESSON} isActive={false} onClick={jest.fn()} />);
    const btn = screen.getByRole('button');
    expect(btn).not.toHaveAttribute('aria-current');
    expect(btn.className).not.toContain('lesson-card--active');
  });

  it('LC-COMPLETED: isCompleted=true shows checkmark and --completed icon class', () => {
    const { container } = render(<LessonCard lesson={LESSON} isCompleted onClick={jest.fn()} />);
    expect(container.querySelector('.lesson-card__icon--completed')).not.toBeNull();
    expect(container.querySelector('svg path[d="M2 7L5.5 10.5L12 3.5"]')).not.toBeNull();
  });

  it('LC-UNCOMPLETED: isCompleted=false omits checkmark', () => {
    const { container } = render(<LessonCard lesson={LESSON} isCompleted={false} onClick={jest.fn()} />);
    expect(container.querySelector('.lesson-card__icon--completed')).toBeNull();
    expect(container.querySelector('svg path[d="M2 7L5.5 10.5L12 3.5"]')).toBeNull();
  });
});

// ── LessonList ────────────────────────────────────────────────────────────────

describe('LessonList', () => {
  it('LL-RENDERS: renders a card for each lesson', () => {
    render(<LessonList lessons={[LESSON, LESSON_2]} onLessonClick={jest.fn()} />);
    expect(screen.getByText('Introduction to Safety')).toBeInTheDocument();
    expect(screen.getByText('Advanced Techniques')).toBeInTheDocument();
  });

  it('LL-EMPTY: shows empty message when lessons array is empty', () => {
    render(<LessonList lessons={[]} onLessonClick={jest.fn()} />);
    expect(screen.getByText('No lessons available.')).toBeInTheDocument();
  });

  it('LL-COMPLETED: cards in completedSequenceIds get the completed style', () => {
    const { container } = render(
      <LessonList
        lessons={[LESSON, LESSON_2]}
        completedSequenceIds={new Set(['seq-1'])}
        onLessonClick={jest.fn()}
      />,
    );
    const icons = container.querySelectorAll('.lesson-card__icon');
    expect(icons[0].className).toContain('--completed');
    expect(icons[1].className).not.toContain('--completed');
  });

  it('LL-ACTIVE: card matching activeSequenceId gets aria-current=step', () => {
    render(
      <LessonList
        lessons={[LESSON, LESSON_2]}
        activeSequenceId="seq-2"
        onLessonClick={jest.fn()}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).not.toHaveAttribute('aria-current');
    expect(buttons[1]).toHaveAttribute('aria-current', 'step');
  });

  it('LL-CLICK: clicking a card calls onLessonClick with its sequenceId', () => {
    const onLessonClick = jest.fn();
    render(<LessonList lessons={[LESSON, LESSON_2]} onLessonClick={onLessonClick} />);
    fireEvent.click(screen.getAllByRole('button')[1]);
    expect(onLessonClick).toHaveBeenCalledWith('seq-2');
  });
});
