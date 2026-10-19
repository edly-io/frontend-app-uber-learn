/**
 * Regression tests: CourseOverview lesson count and "Continue course" target.
 *
 * Bug (CON101, 2026-10-14): 4 lessons x 2 units each, lessons 1-2 complete,
 * lesson 3 half done (5 of 8 units). The header derived lessons from the
 * progress API's UNIT fraction: Math.round(5/8 * 4) = Math.round(2.5) = 3,
 * so it showed "3 of 4" and "Continue course" opened lessons[3] (lesson 4),
 * skipping the unfinished lesson 3.
 */
import React from 'react';
import {
  render, screen, fireEvent, waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CourseOverview } from '../pages/CourseOverview';
import * as coursewareApi from '../api/courseware';
import { useCourseProgressSummary } from '../hooks/useCourseProgressSummary';

const mockNavigate = jest.fn();
const COURSE_ID = 'course-v1:uber+CON101+2026';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ courseId: 'course-v1:uber+CON101+2026' }),
  useLocation: () => ({
    key: 'test-key', pathname: '/course/x', search: '', hash: '', state: null,
  }),
}));
jest.mock('../api/courseware');
jest.mock('../hooks/useCourseProgressSummary');
jest.mock('../hooks/useGamification', () => ({ useGamification: () => ({ data: undefined }) }));
jest.mock('../hooks/useCurriculums', () => ({
  useCurriculums: () => ({
    data: [{
      title: 'Ethics', courses: [{ course_id: 'course-v1:uber+CON101+2026', position: 1 }],
    }],
  }),
}));

const seq = (id: string, title: string, sectionId: string, complete: boolean) => ({
  id, title, sectionId, complete,
});

// Mirrors the real CON101 outline payload for user "edx".
const CON101_OUTLINE: coursewareApi.CourseOutline = {
  courseId: COURSE_ID,
  title: 'Code of Business Conduct',
  sections: {
    chapter1: { id: 'chapter1', title: 'Module 1', sequenceIds: ['sequential1', 'sequential2'] },
    chapter2: { id: 'chapter2', title: 'Module 2', sequenceIds: ['sequential3', 'sequential4'] },
  },
  sequences: {
    sequential1: seq('sequential1', 'Core Principles', 'chapter1', true),
    sequential2: seq('sequential2', 'Conflicts of Interest', 'chapter1', true),
    sequential3: seq('sequential3', 'Raising Concerns', 'chapter2', false),
    sequential4: seq('sequential4', 'Gifts & Entertainment', 'chapter2', false),
  },
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <CourseOverview />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockNavigate.mockClear();
  jest.mocked(coursewareApi.getCourseOutline).mockResolvedValue(CON101_OUTLINE);
  jest.mocked(coursewareApi.getResumeBlock).mockResolvedValue({
    blockId: 'vertical5', sectionId: 'sequential3', unitId: 'vertical5', resumeBlock: true,
  });
  // Progress API: 5 of 8 UNITS complete (fraction 0.625).
  jest.mocked(useCourseProgressSummary).mockReturnValue({
    data: { completedUnits: 5, totalUnits: 8, fraction: 0.625 },
  } as ReturnType<typeof useCourseProgressSummary>);
});

describe('CourseOverview lesson progress (CON101 regression)', () => {
  it('counts completed lessons from the outline, not the unit fraction', async () => {
    renderPage();
    expect(await screen.findByText('2 of 4 lessons complete')).toBeInTheDocument();
    expect(screen.queryByText('3 of 4 lessons complete')).not.toBeInTheDocument();
  });

  it('"Continue course" opens the first incomplete lesson, not a unit-fraction index', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Continue course' }));
    expect(mockNavigate).toHaveBeenCalledWith(
      `/course/${COURSE_ID}/lesson/sequential3/step/0`,
      { state: undefined },
    );
  });

  it('"Continue course" skips a completed lesson the resume API still points at', async () => {
    // Resume API lags: last completed block is in lesson 2, which is already complete.
    jest.mocked(coursewareApi.getResumeBlock).mockResolvedValue({
      blockId: 'vertical4', sectionId: 'sequential2', unitId: 'vertical4', resumeBlock: true,
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Continue course' }));
    expect(mockNavigate).toHaveBeenCalledWith(
      `/course/${COURSE_ID}/lesson/sequential3/step/0`,
      { state: undefined },
    );
  });

  it('"Continue course" opens at the first incomplete unit, not always step/0 (continueStepIdx)', async () => {
    // sequential3: first two units done, third not → continueStepIdx should be 2
    jest.mocked(coursewareApi.getSequenceMetadata).mockResolvedValue({
      sequence: {
        id: 'sequential3', title: 'Raising Concerns', unitIds: ['u1', 'u2', 'u3'], activeUnitIndex: 0,
      },
      units: [
        {
          id: 'u1', sequenceId: 'sequential3', title: 'Intro', complete: true, contentType: 'html', graded: false,
        },
        {
          id: 'u2', sequenceId: 'sequential3', title: 'Core', complete: true, contentType: 'html', graded: false,
        },
        {
          id: 'u3', sequenceId: 'sequential3', title: 'Quiz', complete: false, contentType: 'problem', graded: true,
        },
      ],
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Continue course' }));
    expect(mockNavigate).toHaveBeenCalledWith(
      `/course/${COURSE_ID}/lesson/sequential3/step/2`,
      { state: undefined },
    );
  });

  it('Continue button is disabled while units are loading (race guard)', async () => {
    // Hold the sequence fetch indefinitely to simulate a slow network.
    let resolveUnits: (v: unknown) => void = () => {};
    jest.mocked(coursewareApi.getSequenceMetadata).mockReturnValue(
      new Promise((res) => { resolveUnits = res; }),
    );
    renderPage();

    // Once the outline loads, the course progress bar appears — then units are still in-flight.
    await screen.findByText('2 of 4 lessons complete');
    const btn = screen.getByRole('button', { name: /loading/i });
    expect(btn).toBeDisabled();

    // Resolve units → button becomes interactive.
    resolveUnits({
      sequence: { id: 'sequential3', title: 'Raising Concerns', unitIds: ['u1'], activeUnitIndex: 0 },
      units: [{ id: 'u1', sequenceId: 'sequential3', title: 'Step', complete: false, contentType: 'html', graded: false }],
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Continue course' })).not.toBeDisabled();
    });
  });
});
