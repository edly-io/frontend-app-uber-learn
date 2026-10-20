/**
 * Tests for thin query hooks that wrap API calls with useQuery.
 *
 * These hooks have 0% function coverage because integration tests mock them
 * at the module level. Testing them directly proves they call the correct
 * API functions and use the expected query keys.
 *
 * AC coverage:
 *   QH-GAMIFICATION:  useGamification queries getGamificationSummary
 *   QH-LEADERBOARD:   useLeaderboard queries getLeaderboard with above/below params
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGamification } from '../hooks/useGamification';
import { useLeaderboard } from '../hooks/useLeaderboard';
import * as gamificationApi from '../api/gamification';

jest.mock('../api/gamification', () => ({
  getGamificationSummary: jest.fn(),
  getLeaderboard: jest.fn(),
}));

const makeQC = () => new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: 0 } },
});

// ── useGamification ───────────────────────────────────────────────────────────

function GamificationConsumer() {
  const { data, isError } = useGamification();
  if (isError) return <span>error</span>;
  if (!data) return <span>loading</span>;
  return <span>{data.lifetime_points} pts</span>;
}

describe('useGamification', () => {
  it('QH-GAMIFICATION: renders data returned by getGamificationSummary', async () => {
    jest.mocked(gamificationApi.getGamificationSummary).mockResolvedValue({
      lifetime_points: 420,
    } as gamificationApi.GamificationSummary);

    render(
      <QueryClientProvider client={makeQC()}>
        <GamificationConsumer />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('420 pts')).toBeInTheDocument();
    });
    expect(gamificationApi.getGamificationSummary).toHaveBeenCalledTimes(1);
  });
});

// ── useLeaderboard ────────────────────────────────────────────────────────────

function LeaderboardConsumer({ above, below }: { above: number; below: number }) {
  const { data, isError } = useLeaderboard(above, below);
  if (isError) return <span>error</span>;
  if (!data) return <span>loading</span>;
  return <span>rank {data.my_rank}</span>;
}

describe('useLeaderboard', () => {
  it('QH-LEADERBOARD: renders data returned by getLeaderboard with correct params', async () => {
    jest.mocked(gamificationApi.getLeaderboard).mockResolvedValue({
      status: 'ranked',
      my_rank: 7,
      total_drivers: 30,
      resets_on: '2026-11-01',
      month: '2026-10',
      board_month: '2026-10',
      my_points: 350,
      rows: [],
    } as unknown as gamificationApi.LeaderboardData);

    render(
      <QueryClientProvider client={makeQC()}>
        <LeaderboardConsumer above={3} below={3} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('rank 7')).toBeInTheDocument();
    });
    expect(gamificationApi.getLeaderboard).toHaveBeenCalledWith(3, 3);
  });
});
