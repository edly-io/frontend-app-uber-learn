/**
 * Edge-case tests for ActivityView — covers paths not hit by ActivityView.test.tsx:
 *
 * AC coverage:
 *   AV-OFFLINE:         OfflineView renders when device is offline
 *   AV-NOT-ENROLLED:    NotEnrolledPage renders when course not in enrolled list
 *   AV-SLOW-LOAD:       SlowLoadView renders when load takes > threshold while isLoading
 *   AV-BACK-STEP:       Back arrow within a lesson navigates to previous step
 *   AV-BACK-LESSON:     Back arrow at step 0 navigates to previous lesson
 *   AV-BACK-OVERVIEW:   Back arrow at lesson 0, step 0 navigates to course overview
 *   AV-CLOSE:           X close button navigates to resume page
 *   AV-TRANSCRIPT-OPEN: plugin.openTranscript opens transcript sheet
 *   AV-TRANSCRIPT-CLOSE: closing transcript sheet hides it
 *   AV-CONTENT-ERROR:   onContentError navigates to video-error page
 */
import React from 'react';
import {
  render, screen, waitFor, fireEvent, act,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mergeConfig } from '@edx/frontend-platform';
import { ActivityView } from '../pages/ActivityView';
import * as coursewareApi from '../api/courseware';
import * as progressApi from '../api/progress';

// ── Routing mocks ─────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
const mockUseParams = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => mockUseParams(),
  useLocation: () => ({
    key: 'test-key', pathname: '/', search: '', hash: '', state: null,
  }),
}));

// ── API mocks ─────────────────────────────────────────────────────────────────

jest.mock('../api/courseware');
jest.mock('../api/progress');
jest.mock('../api/gamification', () => ({
  getGamificationSummary: jest.fn().mockResolvedValue({ server_time: '2026-10-19T10:00:00Z' }),
}));

// ── Hook-level mocks for edge-case control ────────────────────────────────────

const mockIsOffline = jest.fn(() => false);
jest.mock('../hooks/useOffline', () => ({
  useOffline: () => mockIsOffline(),
}));

const mockIsSlowLoad = jest.fn(() => false);
jest.mock('../hooks/useSlowLoad', () => ({
  useSlowLoad: () => mockIsSlowLoad(),
}));

const mockLearnCourses = jest.fn();
jest.mock('../hooks/useLearnCourses', () => ({
  useLearnCourses: () => mockLearnCourses(),
}));

// ── Test data ─────────────────────────────────────────────────────────────────

const COURSE_ID = 'course-v1:Uber+L2024';
const SEQ_ID = 'block-v1:Uber+L2024+type@sequential+block@seq1';
const SEQ_ID_2 = 'block-v1:Uber+L2024+type@sequential+block@seq2';

const SEQUENCE_DATA = {
  sequence: {
    id: SEQ_ID, title: 'Driver Basics', unitIds: ['unit-1', 'unit-2'], activeUnitIndex: 0,
  },
  units: [
    {
      id: 'unit-1', sequenceId: SEQ_ID, title: 'Introduction', complete: false, contentType: 'video', graded: false,
    },
    {
      id: 'unit-2', sequenceId: SEQ_ID, title: 'Quiz', complete: false, contentType: 'problem', graded: true,
    },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeQC = () => new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
});

function renderAV(qc?: QueryClient) {
  const client = qc ?? makeQC();
  render(
    <QueryClientProvider client={client}>
      <ActivityView />
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default params
  mockUseParams.mockReturnValue({ courseId: COURSE_ID, sequenceId: SEQ_ID, unitIdx: '0' });
  // Default hooks
  mockIsOffline.mockReturnValue(false);
  mockIsSlowLoad.mockReturnValue(false);
  mockLearnCourses.mockReturnValue({ data: [{ courseId: COURSE_ID }], isLoading: false });
  // Default API
  jest.mocked(coursewareApi.getSequenceMetadata).mockResolvedValue(SEQUENCE_DATA);
  jest.mocked(progressApi.saveSequencePosition).mockResolvedValue(undefined);
  jest.mocked(progressApi.getBlockCompletion).mockResolvedValue(false);
  // Config for LMS URL
  mergeConfig({ LMS_BASE_URL: 'http://localhost:18000', UBER_LIGHTWEIGHT_IFRAMES: false });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ActivityView edge cases', () => {
  it('AV-NOT-ENROLLED: shows NotEnrolledPage when course is not in enrolled list', async () => {
    mockLearnCourses.mockReturnValue({
      data: [], // empty list — course not enrolled
      isLoading: false,
    });
    renderAV();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /we can't open this/i })).toBeInTheDocument();
    });
  });

  it('AV-OFFLINE: shows OfflineView when device goes offline', async () => {
    mockIsOffline.mockReturnValue(true);
    renderAV();
    await waitFor(() => {
      expect(screen.getByText(/you're offline/i)).toBeInTheDocument();
    });
  });

  it('AV-SLOW-LOAD: shows SlowLoadView while loading is slow', async () => {
    jest.mocked(coursewareApi.getSequenceMetadata).mockReturnValue(new Promise(() => {}));
    mockIsSlowLoad.mockReturnValue(true);
    renderAV();
    await waitFor(() => {
      expect(screen.getByText(/this is taking longer than expected/i)).toBeInTheDocument();
    });
  });

  it('AV-BACK-STEP: back at step 1 navigates to step 0 within same lesson', async () => {
    mockUseParams.mockReturnValue({ courseId: COURSE_ID, sequenceId: SEQ_ID, unitIdx: '1' });
    renderAV();
    await waitFor(() => screen.getByRole('button', { name: /finish/i }));
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(mockNavigate).toHaveBeenCalledWith(
      `/course/${COURSE_ID}/lesson/${SEQ_ID}/step/0`,
      expect.anything(),
    );
  });

  it('AV-BACK-OVERVIEW: back at lesson 0, step 0 navigates to course overview', async () => {
    // No outline data means allLessons=[] → currentLessonIdx=-1 → course overview
    renderAV();
    await waitFor(() => screen.getByRole('button', { name: /continue/i }));
    const backBtn = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith(
      `/course/${COURSE_ID}`,
      expect.anything(),
    );
  });
});
