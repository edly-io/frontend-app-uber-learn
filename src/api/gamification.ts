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

export interface QuickCheckResult {
  correct: number;
  total: number;
  at: string;
}

export interface FinalCheckResult {
  correct: number;
  total: number;
  passed_at: string;
}

export interface GamificationCoursePoints {
  course_key: string;
  points: number;
  quick_check: QuickCheckResult | null;
  final_check: FinalCheckResult | null;
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
  /** Driver's first name for the personalised greeting — returned by backend when available */
  first_name?: string | null;
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

export interface LessonResults {
  sequence_key: string;
  course_key: string;
  points_earned: number;
  correct_percent: number | null;
  first_try_goal_met?: boolean;
  questions: number;
  already_completed_before: boolean;
  steps_count: number | null;
}

export interface LessonMaxPoints {
  display_name: string;
  max_points: number;
  completion_points: number;
  first_try_points: number;
}

export interface CourseMaxPoints {
  course_id: string;
  max_points: number;
  completion_points: number;
  first_try_points: number;
  lessons: LessonMaxPoints[];
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

export async function getLeaderboard(above: number, below: number): Promise<LeaderboardData> {
  const { data } = await getAuthenticatedHttpClient().get(
    `${getConfig().LMS_BASE_URL}/api/uber/gamification/v1/leaderboard/`,
    { params: { above, below } },
  );
  return data as LeaderboardData;
}

export async function getLessonResults(
  sequenceKey: string,
): Promise<LessonResults> {
  const { data } = await getAuthenticatedHttpClient().get(
    `${getConfig().LMS_BASE_URL}/api/uber/gamification/v1/lessons/${encodeURIComponent(sequenceKey)}/results/`,
  );
  return data as LessonResults;
}

export async function getCourseMaxPoints(courseId: string): Promise<CourseMaxPoints> {
  const { data } = await getAuthenticatedHttpClient().get(
    `${getConfig().LMS_BASE_URL}/api/uber/gamification/v1/courses/${encodeURIComponent(courseId)}/max-points/`,
  );
  return data as CourseMaxPoints;
}
