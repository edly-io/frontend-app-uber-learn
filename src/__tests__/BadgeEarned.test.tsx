/**
 * Unit tests for BadgeEarned page.
 *
 * AC coverage:
 *   - BE-FALLBACK: renders static title/description when curriculum has no reached milestone
 *   - BE-API-TITLE: uses badge title from curriculum milestones API
 *   - BE-API-DATE: formats and shows earned date from curriculum milestones API
 *   - BE-NO-DATE: omits date line when milestone.reached_at is null
 *   - BE-ALSO-EARNED-SHOWN: renders "Also earned" card(s) when alsoEarned is non-empty
 *   - BE-ALSO-EARNED-HIDDEN: "Also earned" section absent when alsoEarned is empty
 *   - BE-MARK-SEEN: markBadgesSeen called on mount when awardId present
 *   - BE-NO-MARK-SEEN: markBadgesSeen NOT called when awardId absent
 *   - BE-NAV-CONTINUE: "Continue" navigates to "/"
 *   - BE-NAV-SEE-BADGES: "See your badges" navigates to /progress with tab state
 */
import React from 'react';
import {
  render, screen, fireEvent, waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BadgeEarned } from '../pages/BadgeEarned';
import * as curriculumApi from '../api/curriculum';
import type { LearnerCurriculum } from '../api/curriculum';

// ── Mocks ──────────────────────────────────────────────────

const mockNavigate = jest.fn();
let mockLocationState: Record<string, unknown> | null = null;

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ type: 'complete' }),
  useLocation: () => ({ state: mockLocationState, pathname: '/badge/complete' }),
}));

jest.mock('../api/curriculum');

// ── Fixtures ───────────────────────────────────────────────

const makeCurriculum = (overrides: Partial<LearnerCurriculum['milestones']> = {}): LearnerCurriculum => ({
  uuid: 'c1',
  title: 'Safety Fundamentals',
  description: '',
  image_url: null,
  assigned_at: '2026-01-01T00:00:00Z',
  courses: [],
  courses_finished: 0,
  courses_total: 0,
  knowledge_check: {
    course_id: 'course-v1:Uber+KC+2026',
    display_name: null,
    exists: true,
    unlocks_at: null,
    is_open: false,
  },
  milestones: {
    complete: { reached_at: null, badge: null },
    retained: { reached_at: null, badge: null },
    ...overrides,
  },
});

// ── Helpers ────────────────────────────────────────────────

const makeQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

const renderBadgeEarned = (qc = makeQueryClient()) => render(
  <QueryClientProvider client={qc}><BadgeEarned /></QueryClientProvider>,
);

// ── Tests ──────────────────────────────────────────────────

describe('BadgeEarned', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockLocationState = null;
    (curriculumApi.markBadgesSeen as jest.Mock).mockClear();
    (curriculumApi.markBadgesSeen as jest.Mock).mockResolvedValue(undefined);
    // Default: curriculum with no reached milestones
    (curriculumApi.getLearnerCurriculums as jest.Mock).mockResolvedValue([makeCurriculum()]);
  });

  it('renders static fallback title when no milestone is reached (BE-FALLBACK)', async () => {
    renderBadgeEarned();
    expect(screen.getByText('Badge earned')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^complete$/i })).toBeInTheDocument();
    });
  });

  it('uses badge title from curriculum milestones API (BE-API-TITLE)', async () => {
    (curriculumApi.getLearnerCurriculums as jest.Mock).mockResolvedValue([
      makeCurriculum({
        complete: {
          reached_at: '2026-11-18T12:00:00Z',
          badge: {
            uuid: 'b1',
            title: 'New driver hero',
            description: 'You did it.',
            image_url: null,
          },
        },
      }),
    ]);
    renderBadgeEarned();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /new driver hero/i })).toBeInTheDocument();
    });
  });

  it('formats and shows earned date from curriculum milestones API (BE-API-DATE)', async () => {
    (curriculumApi.getLearnerCurriculums as jest.Mock).mockResolvedValue([
      makeCurriculum({
        complete: {
          reached_at: '2026-11-18T12:00:00Z',
          badge: null,
        },
      }),
    ]);
    renderBadgeEarned();
    await waitFor(() => {
      // Date is formatted with device locale so we check the numeric day and year are present
      expect(screen.getByText(/^Earned /i)).toBeInTheDocument();
      expect(screen.getByText(/18/)).toBeInTheDocument();
      expect(screen.getByText(/2026/)).toBeInTheDocument();
    });
  });

  it('omits earned date line when milestone.reached_at is null (BE-NO-DATE)', async () => {
    renderBadgeEarned();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^complete$/i })).toBeInTheDocument();
    });
    expect(screen.queryByText(/Earned \d/)).not.toBeInTheDocument();
  });

  it('renders "Also earned" card when alsoEarned is non-empty (BE-ALSO-EARNED-SHOWN)', () => {
    mockLocationState = {
      alsoEarned: [{ id: 'a1', title: 'Road safety fundamentals', imageUrl: null }],
    };
    renderBadgeEarned();
    expect(screen.getByText(/also earned/i)).toBeInTheDocument();
    expect(screen.getByText(/road safety fundamentals/i)).toBeInTheDocument();
  });

  it('hides "Also earned" section when alsoEarned is empty (BE-ALSO-EARNED-HIDDEN)', () => {
    mockLocationState = { alsoEarned: [] };
    renderBadgeEarned();
    expect(screen.queryByText(/also earned/i)).not.toBeInTheDocument();
  });

  it('calls markBadgesSeen on mount when awardId is present (BE-MARK-SEEN)', async () => {
    mockLocationState = { awardId: 'award-xyz' };
    renderBadgeEarned();
    await waitFor(() => {
      expect(curriculumApi.markBadgesSeen).toHaveBeenCalledWith(['award-xyz']);
    });
  });

  it('does NOT call markBadgesSeen when awardId is absent (BE-NO-MARK-SEEN)', () => {
    mockLocationState = {};
    renderBadgeEarned();
    expect(curriculumApi.markBadgesSeen).not.toHaveBeenCalled();
  });

  it('"Continue" button navigates to "/" (BE-NAV-CONTINUE)', () => {
    renderBadgeEarned();
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('"See your badges" navigates to /progress with tab state (BE-NAV-SEE-BADGES)', () => {
    renderBadgeEarned();
    fireEvent.click(screen.getByRole('button', { name: /see your badges/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/progress', { state: { tab: 'Badges' } });
  });
});
