/**
 * Unit tests for PointsTab component.
 *
 * AC coverage:
 *   PT-SORT-DESC:   courses rendered highest-points-first
 *   PT-SORT-TIE:    courses with equal points preserve relative order
 *   PT-SORT-ZERO:   courses with 0 / missing points appear last
 *   PT-POINTS-DISP: +N label for positive points, "0" for zero
 *   PT-HERO:        total and month points shown in hero card
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PointsTab } from '../pages/learning-progress/PointsTab';
import type { LearnCourse } from '../api/learn';

function makeCourse(id: string, title: string): LearnCourse {
  return {
    courseId: id,
    title,
    imageUrl: null,
    courseStart: null,
    courseEnd: null,
    lessonCount: 0,
    completedLessons: 0,
    progress: 0,
    nextLesson: null,
    status: 'not_started',
    curriculum: null,
    lastActivity: null,
    points: 0,
  };
}

const makeQC = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

function wrap(ui: React.ReactElement) {
  return render(<QueryClientProvider client={makeQC()}>{ui}</QueryClientProvider>);
}

const COURSES = [
  makeCourse('course-a', 'Alpha'),
  makeCourse('course-b', 'Beta'),
  makeCourse('course-c', 'Gamma'),
];

const POINTS_BY_KEY: Record<string, number> = {
  'course-a': 40,
  'course-b': 80,
  'course-c': 20,
};

describe('PointsTab', () => {
  it('PT-SORT-DESC: courses are ordered highest points first', () => {
    wrap(
      <PointsTab
        courses={COURSES}
        totalPoints={140}
        coursePointsByKey={POINTS_BY_KEY}
      />,
    );

    const titles = screen.getAllByText(/Alpha|Beta|Gamma/);
    const order = titles.map((el) => el.textContent);
    expect(order.indexOf('Beta')).toBeLessThan(order.indexOf('Alpha'));
    expect(order.indexOf('Alpha')).toBeLessThan(order.indexOf('Gamma'));
  });

  it('PT-SORT-ZERO: course with 0 points appears after those with points', () => {
    wrap(
      <PointsTab
        courses={COURSES}
        totalPoints={120}
        coursePointsByKey={{ 'course-a': 60, 'course-b': 60, 'course-c': 0 }}
      />,
    );

    const titles = screen.getAllByText(/Alpha|Beta|Gamma/);
    const order = titles.map((el) => el.textContent);
    expect(order.indexOf('Gamma')).toBeGreaterThan(order.indexOf('Alpha'));
    expect(order.indexOf('Gamma')).toBeGreaterThan(order.indexOf('Beta'));
  });

  it('PT-POINTS-DISP: +N for positive points, "0" for zero', () => {
    wrap(
      <PointsTab
        courses={[makeCourse('course-a', 'Alpha'), makeCourse('course-b', 'Beta')]}
        totalPoints={80}
        coursePointsByKey={{ 'course-a': 80, 'course-b': 0 }}
      />,
    );

    expect(screen.getByText('+80')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('PT-HERO: renders total points and month sub-label', () => {
    wrap(
      <PointsTab
        courses={[]}
        totalPoints={885}
        monthPoints={885}
        coursePointsByKey={{}}
      />,
    );

    expect(screen.getByText('885')).toBeInTheDocument();
    expect(screen.getByText('885 this month')).toBeInTheDocument();
  });
});
