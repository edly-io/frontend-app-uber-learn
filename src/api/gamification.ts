import { getConfig } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type ThisWeekStatus = 'active' | 'goal_met' | 'paused';
export type RecentWeekStatus = 'streak' | 'forgiven' | 'missed' | 'none';

export interface GamificationDay {
  date: string;
  weekday: WeekdayKey;
  learned: boolean;
  is_today: boolean;
}

export interface GamificationThisWeek {
  week_start: string;
  today: string;
  learning_days: number;
  goal: number;
  status: ThisWeekStatus;
  projected_streak_weeks: number;
  days: GamificationDay[];
}

export interface GamificationRecentWeek {
  week_start: string;
  status: RecentWeekStatus;
  learning_days: number;
}

export interface GamificationCoursePoints {
  course_key: string;
  points: number;
}

export interface GamificationSummary {
  lifetime_points: number;
  month_points: number;
  month: string;
  current_streak_weeks: number;
  longest_streak_weeks: number;
  last_learning_date: string | null;
  courses: GamificationCoursePoints[];
  this_week: GamificationThisWeek;
  recent_weeks: GamificationRecentWeek[];
  server_time: string;
}

export interface LeaderboardRow {
  rank: number;
  display_name: string | null;
  points: number;
  is_me: boolean;
}

export interface LeaderboardData {
  month: string;
  resets_on: string;
  board_month: string;
  status: 'ranked' | 'not_ranked';
  my_rank: number | null;
  my_points: number;
  total_drivers: number;
  rows: LeaderboardRow[];
}

// ---------------------------------------------------------------------------
// Fetch functions
// ---------------------------------------------------------------------------

export async function getGamificationSummary(): Promise<GamificationSummary> {
  const { data } = await getAuthenticatedHttpClient().get(
    `${getConfig().LMS_BASE_URL}/api/uber/gamification/v1/summary/`,
  );
  return data as GamificationSummary;
}

export async function getLeaderboard(): Promise<LeaderboardData> {
  const { data } = await getAuthenticatedHttpClient().get(
    `${getConfig().LMS_BASE_URL}/api/uber/gamification/v1/leaderboard/`,
  );
  return data as LeaderboardData;
}
