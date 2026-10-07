/**
 * Unit tests for BadgeEarned page.
 *
 * AC coverage:
 *   - BE-FALLBACK: renders static title/description when no nav state provided
 *   - BE-API-TITLE: uses badge title from nav state when provided
 *   - BE-API-DATE: formats and shows earned date from nav state
 *   - BE-NO-DATE: omits date line when earnedAt absent
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

// ── Mocks ──────────────────────────────────────────────────

const mockNavigate = jest.fn();
let mockLocationState: Record<string, unknown> | null = null;

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ type: 'halfway' }),
  useLocation: () => ({ state: mockLocationState, pathname: '/badge/halfway' }),
}));

jest.mock('../api/curriculum');

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
  });

  it('renders static fallback title when no nav state (BE-FALLBACK)', () => {
    renderBadgeEarned();
    expect(screen.getByText('Badge earned')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /road ready/i })).toBeInTheDocument();
  });

  it('uses badgeTitle from nav state when provided (BE-API-TITLE)', () => {
    mockLocationState = { badgeTitle: 'New driver hero' };
    renderBadgeEarned();
    expect(screen.getByRole('heading', { name: /new driver hero/i })).toBeInTheDocument();
  });

  it('formats and shows earned date from nav state (BE-API-DATE)', () => {
    // Use noon UTC to avoid date-shift across timezones
    mockLocationState = { earnedAt: '2026-11-18T12:00:00Z' };
    renderBadgeEarned();
    expect(screen.getByText(/earned 18 november 2026/i)).toBeInTheDocument();
  });

  it('omits earned date line when earnedAt is absent (BE-NO-DATE)', () => {
    mockLocationState = {};
    renderBadgeEarned();
    // /Earned \d/ matches the date line ("Earned 18 November 2026") but not the kicker "Badge earned"
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
