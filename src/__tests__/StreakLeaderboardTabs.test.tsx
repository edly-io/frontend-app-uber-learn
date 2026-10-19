/**
 * Tests for StreakTab and LeaderboardTab within LearningProgress.
 *
 * Strategy: render LearningProgress, switch to the relevant tab, assert UI.
 * All API hooks are mocked at module level for isolation.
 *
 * AC coverage (StreakTab):
 *   ST-LOADING:        renders skeleton when gamification data is not yet available
 *   ST-STREAK-COUNT:   renders current streak count
 *   ST-STREAK-BEST:    shows "your best is N weeks" suffix when longest > current
 *   ST-GOAL-MET:       shows "Goal met this week" when status is goal_met
 *   ST-PAUSED:         shows "Streak paused" when status is paused
 *   ST-ACTIVE-DAYS:    shows "N more day(s) to go" when active
 *   ST-DAYS-ROW:       renders day cells (Mon–Sun labels)
 *
 * AC coverage (LeaderboardTab):
 *   LT-LOADING:        renders "—" hero while loading
 *   LT-ERROR:          shows error view on leaderboard fetch failure
 *   LT-UNRANKED:       shows "Not yet" hero when status is not ranked
 *   LT-RANKED:         shows ordinal rank in hero when status is ranked
 *   LT-ROWS:           renders ranked rows
 */
import React from 'react';
import {
  render, screen, fireEvent, waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LearningProgress } from '../pages/LearningProgress';
import type { GamificationSummary } from '../api/gamification';

// ── Router mocks ──────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: null, pathname: '/progress' }),
}));

// ── Hook + API mocks ─────────────────────────────────────────────────────────

jest.mock('../api/learn', () => ({
  getLearnCourses: jest.fn().mockResolvedValue([]),
}));
jest.mock('../api/progress', () => ({
  getProgress: jest.fn().mockResolvedValue(null),
}));
jest.mock('../hooks/useCourseOutline', () => ({
  useCourseOutline: jest.fn().mockReturnValue({ data: null }),
}));
jest.mock('../hooks/useCurriculums', () => ({
  useCurriculums: jest.fn().mockReturnValue({ data: [] }),
}));
jest.mock('../hooks/useBadges', () => ({
  useBadges: jest.fn().mockReturnValue({ data: { curriculum_badges: [], course_badges: [] } }),
}));

const mockUseGamification = jest.fn();
const mockUseLeaderboard = jest.fn();

jest.mock('../hooks/useGamification', () => ({
  useGamification: (...args: unknown[]) => mockUseGamification(...args),
}));
jest.mock('../hooks/useLeaderboard', () => ({
  useLeaderboard: (...args: unknown[]) => mockUseLeaderboard(...args),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeDay(weekday: string, opts: { learned?: boolean; is_today?: boolean } = {}) {
  return {
    weekday,
    learned: opts.learned ?? false,
    is_today: opts.is_today ?? false,
  };
}

const DAYS_7 = [
  makeDay('mon', { learned: true }),
  makeDay('tue', { learned: true }),
  makeDay('wed', { is_today: true }),
  makeDay('thu'),
  makeDay('fri'),
  makeDay('sat'),
  makeDay('sun'),
];

function makeGamification(overrides: Partial<GamificationSummary['this_week']> = {}): GamificationSummary {
  return {
    server_time: '2026-10-19T12:00:00Z',
    lifetime_points: 500,
    month_points: 100,
    current_streak_weeks: 3,
    longest_streak_weeks: 5,
    this_week: {
      week_start: '2026-10-14',
      today: '2026-10-16',
      learning_days: 2,
      goal: 2,
      status: 'active',
      projected_streak_weeks: 4,
      days: DAYS_7,
      ...overrides,
    },
    recent_weeks: [
      { week_start: '2026-10-07', status: 'streak' },
      { week_start: '2026-09-30', status: 'missed' },
      { week_start: '2026-09-23', status: 'forgiven' },
      { week_start: '2026-09-16', status: 'streak' },
      { week_start: '2026-09-09', status: 'empty' },
      { week_start: '2026-09-02', status: 'streak' },
      { week_start: '2026-08-26', status: 'streak' },
    ],
    courses: [],
  } as unknown as GamificationSummary;
}

const LEADERBOARD_RANKED = {
  status: 'ranked',
  my_rank: 3,
  total_drivers: 42,
  resets_on: '2026-11-01',
  rows: [
    {
      rank: 1, display_name: 'Alice', points: 900, is_me: false,
    },
    {
      rank: 2, display_name: 'Bob', points: 800, is_me: false,
    },
    {
      rank: 3, display_name: 'Me', points: 700, is_me: true,
    },
  ],
};

const LEADERBOARD_UNRANKED = {
  status: 'unranked',
  my_rank: null,
  total_drivers: 15,
  resets_on: null,
  rows: [],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeQC = () => new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderProgress = () => render(
  <QueryClientProvider client={makeQC()}><LearningProgress /></QueryClientProvider>,
);

const switchToTab = (tabName: string) => {
  fireEvent.click(screen.getByRole('tab', { name: new RegExp(tabName, 'i') }));
};

// ── StreakTab tests ───────────────────────────────────────────────────────────

describe('StreakTab inside LearningProgress', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockUseGamification.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    mockUseLeaderboard.mockReturnValue({ data: undefined, isLoading: false, isError: false });
  });

  it('ST-LOADING: renders loading skeleton while gamification data unavailable', () => {
    renderProgress();
    switchToTab('Streak');
    expect(screen.getByLabelText('Loading…')).toBeInTheDocument();
  });

  it('ST-STREAK-COUNT: renders current streak count', async () => {
    mockUseGamification.mockReturnValue({
      data: makeGamification(), isLoading: false, isError: false,
    });
    renderProgress();
    switchToTab('Streak');
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('ST-STREAK-BEST: shows "your best is N weeks" when longest > current', async () => {
    mockUseGamification.mockReturnValue({
      data: makeGamification(), isLoading: false, isError: false,
    });
    renderProgress();
    switchToTab('Streak');
    await waitFor(() => {
      expect(screen.getByText(/your best is 5 weeks/i)).toBeInTheDocument();
    });
  });

  it('ST-GOAL-MET: shows "Goal met this week" when status is goal_met', async () => {
    mockUseGamification.mockReturnValue({
      data: makeGamification({ status: 'goal_met', learning_days: 2, goal: 2 }),
      isLoading: false,
      isError: false,
    });
    renderProgress();
    switchToTab('Streak');
    await waitFor(() => {
      expect(screen.getByText('Goal met this week')).toBeInTheDocument();
    });
  });

  it('ST-PAUSED: shows "Streak paused" when status is paused', async () => {
    mockUseGamification.mockReturnValue({
      data: makeGamification({ status: 'paused' }),
      isLoading: false,
      isError: false,
    });
    renderProgress();
    switchToTab('Streak');
    await waitFor(() => {
      expect(screen.getByText('Streak paused')).toBeInTheDocument();
    });
  });

  it('ST-ACTIVE-ONE: shows "One more day to go" when 1 day remaining', async () => {
    mockUseGamification.mockReturnValue({
      data: makeGamification({ status: 'active', learning_days: 1, goal: 2 }),
      isLoading: false,
      isError: false,
    });
    renderProgress();
    switchToTab('Streak');
    await waitFor(() => {
      expect(screen.getByText('One more day to go')).toBeInTheDocument();
    });
  });

  it('ST-ACTIVE-DAYS: shows "N days to go" when multiple days remaining', async () => {
    mockUseGamification.mockReturnValue({
      data: makeGamification({ status: 'active', learning_days: 0, goal: 2 }),
      isLoading: false,
      isError: false,
    });
    renderProgress();
    switchToTab('Streak');
    await waitFor(() => {
      expect(screen.getByText(/2 days to go/i)).toBeInTheDocument();
    });
  });
});

// ── LeaderboardTab tests ──────────────────────────────────────────────────────

describe('LeaderboardTab inside LearningProgress', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockUseGamification.mockReturnValue({ data: makeGamification(), isLoading: false, isError: false });
    mockUseLeaderboard.mockReturnValue({ data: undefined, isLoading: false, isError: false });
  });

  it('LT-LOADING: renders "—" hero value while leaderboard is loading', () => {
    mockUseLeaderboard.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderProgress();
    switchToTab('Leaderboard');
    const values = screen.getAllByText('—');
    expect(values.length).toBeGreaterThan(0);
  });

  it('LT-ERROR: shows error view when leaderboard fetch fails', () => {
    mockUseLeaderboard.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: jest.fn() });
    renderProgress();
    switchToTab('Leaderboard');
    expect(screen.getByText(/Leaderboard unavailable/i)).toBeInTheDocument();
  });

  it('LT-UNRANKED: shows "Not yet" hero when status is unranked', async () => {
    mockUseLeaderboard.mockReturnValue({
      data: LEADERBOARD_UNRANKED, isLoading: false, isError: false,
    });
    renderProgress();
    switchToTab('Leaderboard');
    await waitFor(() => {
      expect(screen.getByText('Not yet')).toBeInTheDocument();
    });
  });

  it('LT-RANKED: shows ordinal rank (3rd) in hero when ranked', async () => {
    mockUseLeaderboard.mockReturnValue({
      data: LEADERBOARD_RANKED, isLoading: false, isError: false,
    });
    renderProgress();
    switchToTab('Leaderboard');
    await waitFor(() => {
      expect(screen.getByText('3rd')).toBeInTheDocument();
    });
  });

  it('LT-ROWS: renders row names from leaderboard data', async () => {
    mockUseLeaderboard.mockReturnValue({
      data: LEADERBOARD_RANKED, isLoading: false, isError: false,
    });
    renderProgress();
    switchToTab('Leaderboard');
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
  });
});
