import { useMemo } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { useBadges } from './useBadges';
import type { BadgeEntry, BadgeSlot, BadgesResponse } from '../api/curriculum';

export interface AlsoEarnedBadge { id: string; title: string; imageUrl: string | null }
export interface BadgeCelebration { slot: BadgeSlot; awardId: string; alsoEarned: AlsoEarnedBadge[] }

// Module-level guard: award ids already celebrated this session. Prevents redirect
// loops while the markBadgesSeen mutation + refetch are still in flight.
const celebratedAwardIds = new Set<string>();

/** Test-only: reset the session guard between tests. */
export const resetCelebratedBadges = (): void => { celebratedAwardIds.clear(); };

type PendingEntry = BadgeEntry & { id: string };

const isPending = (entry: BadgeEntry): entry is PendingEntry => (
  entry.awarded && entry.seen === false && entry.id !== null && !celebratedAwardIds.has(entry.id)
);

export function selectBadgeCelebration(
  data: BadgesResponse | undefined,
  slots?: readonly BadgeSlot[],
): BadgeCelebration | null {
  if (!data) { return null; }
  const pending = [...data.curriculum_badges, ...data.course_badges].filter(isPending);

  // Prefer an unseen curriculum badge matching the requested slot(s).
  const primary = pending.find((e) => e.source.type === 'curriculum' && (!slots || slots.includes((e.source as Extract<typeof e.source, { type: 'curriculum' }>).slot)));
  if (primary && primary.source.type === 'curriculum') {
    const primarySource = primary.source as Extract<typeof primary.source, { type: 'curriculum' }>;
    return {
      slot: primarySource.slot,
      awardId: primary.id,
      alsoEarned: pending
        .filter((e) => e.id !== primary.id)
        .map((e) => ({ id: e.id, title: e.badge.title, imageUrl: e.badge.image_url })),
    };
  }

  // Fall back to the first unseen course badge so course-only earners are celebrated
  // and the "New" chip clears correctly. Course badges use slot 'complete'.
  const coursePrimary = pending.find((e) => e.source.type === 'course');
  if (!coursePrimary) { return null; }
  return {
    slot: 'complete',
    awardId: coursePrimary.id,
    alsoEarned: pending
      .filter((e) => e.id !== coursePrimary.id)
      .map((e) => ({ id: e.id, title: e.badge.title, imageUrl: e.badge.image_url })),
  };
}

/** Pass a module-level constant for `slots` so the memo stays stable. */
export const useBadgeCelebration = (slots?: readonly BadgeSlot[]): BadgeCelebration | null => {
  const { data } = useBadges();
  return useMemo(() => selectBadgeCelebration(data, slots), [data, slots]);
};

export const goToBadgeCelebration = (navigate: NavigateFunction, celebration: BadgeCelebration): void => {
  celebratedAwardIds.add(celebration.awardId);
  celebration.alsoEarned.forEach((b) => celebratedAwardIds.add(b.id));
  navigate('/');
};
