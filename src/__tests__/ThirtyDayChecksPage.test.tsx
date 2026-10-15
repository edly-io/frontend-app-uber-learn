import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThirtyDayChecksPage } from '../pages/ThirtyDayChecksPage';
import type { LearnerCurriculum } from '../api/curriculum';

const mockNavigate = jest.fn();
const mockUseCurriculums = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../hooks/useCurriculums', () => ({
  useCurriculums: (...args: unknown[]) => mockUseCurriculums(...args),
}));

const CURRICULUM: LearnerCurriculum = {
  uuid: 'safety-path',
  title: 'Business Conduct & Ethics',
  description: '',
  image_url: null,
  assigned_at: '2026-01-01T00:00:00Z',
  courses: [],
  courses_finished: 0,
  courses_total: 1,
  milestones: {
    complete: { reached_at: null, badge: null },
    retained: { reached_at: null, badge: null },
  },
  knowledge_check: {
    course_id: 'course-v1:Uber+BusinessConduct+2026',
    display_name: '30-day check',
    exists: true,
    unlocks_at: null,
    is_open: true,
  },
};

beforeEach(() => {
  mockNavigate.mockClear();
  mockUseCurriculums.mockReturnValue({ data: [CURRICULUM] });
});

describe('ThirtyDayChecksPage course navigation', () => {
  it('opens an available check course with the checks page as its return destination', () => {
    render(<ThirtyDayChecksPage />);

    fireEvent.click(screen.getByRole('button', { name: /Business Conduct & Ethics/i }));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/course/course-v1:Uber+BusinessConduct+2026',
      { state: { origin: '/30-day-checks' } },
    );
  });

  it('opens the learning path for a check that is not available yet', () => {
    mockUseCurriculums.mockReturnValue({
      data: [{
        ...CURRICULUM,
        knowledge_check: { ...CURRICULUM.knowledge_check, is_open: false },
      }],
    });

    render(<ThirtyDayChecksPage />);

    fireEvent.click(screen.getByRole('button', { name: /Business Conduct & Ethics/i }));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/course/course-v1:Uber+BusinessConduct+2026/retention',
      { state: { origin: '/30-day-checks' } },
    );
  });
});
