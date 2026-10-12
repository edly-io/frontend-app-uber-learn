import type { InfoSheetData } from '../../components/ui/InfoSheet';

// ── Tab types ────────────────────────────────────────────

export type TabId = 'Points' | 'Streak' | 'Badges' | 'Leaderboard';

export const TABS: TabId[] = ['Points', 'Streak', 'Badges', 'Leaderboard'];

// ── Info sheet content ───────────────────────────────────

export const INFO_POINTS: InfoSheetData = {
  title: 'How points work',
  bullets: [
    '10 points for each step, the first time you finish a lesson.',
    'Plus 5 for each question you get right on the first try.',
    "Repeats and checks don't add points.",
    'Points are never taken away.',
  ],
};

export const INFO_STREAK: InfoSheetData = {
  title: 'How your streak works',
  bullets: [
    'Learn on 2 days a week, Monday to Sunday.',
    'Every course counts, in a path or not.',
    "One missed week in any eight is forgiven. That's the outlined week.",
    "If there's no course left to take, your streak pauses.",
  ],
};

export const INFO_BADGES: InfoSheetData = {
  title: 'How badges work',
  bullets: [
    'Every course has a badge. Finish its lessons and final check to earn it.',
    'Every learning path has a badge too, for finishing all its courses.',
    '30 days later, a check on the path earns one more.',
    "Badges turn from grey to colour when earned. They're never taken away.",
  ],
};

export const INFO_LEADERBOARD: InfoSheetData = {
  title: 'How the leaderboard works',
  bullets: [
    'Ranked by points earned this month. Everyone starts again on the 1st.',
    'Your total stays on the Points tab.',
    "Other drivers' names are hidden.",
    "Drivers with no points this month aren't listed.",
  ],
};

export const INFO_MAP: Record<TabId, InfoSheetData> = {
  Points: INFO_POINTS,
  Streak: INFO_STREAK,
  Badges: INFO_BADGES,
  Leaderboard: INFO_LEADERBOARD,
};
