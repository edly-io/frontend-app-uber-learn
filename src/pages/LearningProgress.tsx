import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getEnrolledCourses, type EnrolledCourse } from '../api/catalog';
import { useProgress } from '../hooks/useProgress';
import { useCourseOutline } from '../hooks/useCourseOutline';
import { mapOutlineToLessons } from '../lib/outline-mapper';
import { getStoredResumeIdx } from '../lib/resume-storage';
import { useGamification, type GamificationSummary } from '../hooks/useGamification';
import { useLeaderboard, type LeaderboardData } from '../hooks/useLeaderboard';
import { useCurriculums } from '../hooks/useCurriculums';
import type { LearnerCurriculum, BadgeSlot } from '../api/curriculum';
import type { GamificationDay, WeekdayKey } from '../api/gamification';

import iconCircleInfo from '../assets/icons/icon-circle-info.svg';
import courseArtBlue from '../assets/icons/course-art-blue2.svg';
import courseArtTeal from '../assets/icons/course-art-teal2.svg';
import iconLightningLarge from '../assets/icons/icon-lightning-large.svg';
import iconCircleCheck from '../assets/icons/icon-circle-check.svg';
import iconCalendar from '../assets/icons/icon-calendar.svg';
import iconBadgeCheck from '../assets/icons/icon-badge-check.svg';
import ringTrack from '../assets/icons/ring-track.svg';
import ringProgress from '../assets/icons/ring-progress.svg';
import badgeHalfwayEarned from '../assets/badges/badge-halfway-earned.svg';
import badgeCompleteEarned from '../assets/badges/badge-complete-earned.svg';
import badgeCompleteLocked from '../assets/badges/badge-complete-locked.svg';
import badgeRetainedEarned from '../assets/badges/badge-retained-earned.svg';
import badgeRetainedLocked from '../assets/badges/badge-retained-locked.svg';

import './learning-progress.css';

// ── Tab types ────────────────────────────────────────────

type TabId = 'Points' | 'Streak' | 'Badges' | 'Leaderboard';

const TABS: TabId[] = ['Points', 'Streak', 'Badges', 'Leaderboard'];

// ── Back icon ────────────────────────────────────────────

const ArrowLeft = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path
      d="M12.5 15L7.5 10L12.5 5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// ── Points tab ───────────────────────────────────────────

interface CourseRowProps {
  course: EnrolledCourse;
  artSrc: string;
  tintClass: string;
  gamificationPoints?: number;
}

const PointsCourseRow = ({
  course, artSrc, tintClass, gamificationPoints,
}: CourseRowProps) => {
  const outlineQuery = useCourseOutline(course.courseId);
  const { data: progressData } = useProgress(course.courseId);
  const allLessons = outlineQuery.data ? mapOutlineToLessons(outlineQuery.data) : [];
  const totalLessons = allLessons.length;
  const storedIdx = totalLessons > 0 ? getStoredResumeIdx(course.courseId, allLessons) : -1;
  const completedLessons = storedIdx > 0 ? storedIdx : 0;
  const pointsEarned = gamificationPoints ?? progressData?.points?.earned ?? 0;

  const statusText = totalLessons > 0
    ? `${completedLessons} of ${totalLessons} lessons complete`
    : 'Not started';

  return (
    <div className="lp-course-row">
      <div className={`lp-course-row__art ${tintClass}`}>
        <img src={artSrc} alt="" className="lp-course-row__art-img" aria-hidden="true" />
      </div>
      <div className="lp-course-row__body">
        <span className="lp-course-row__title">{course.title}</span>
        <span className="lp-course-row__status">{statusText}</span>
      </div>
      <span className="lp-course-row__points">
        {pointsEarned > 0 ? `+${pointsEarned}` : '0'}
      </span>
    </div>
  );
};

const COURSE_ART = [
  { artSrc: courseArtBlue, tintClass: 'lp-course-row__art--blue' },
  { artSrc: courseArtTeal, tintClass: 'lp-course-row__art--teal' },
];

interface PointsTabProps {
  courses: EnrolledCourse[];
  totalPoints: number;
  monthPoints?: number;
  coursePointsByKey?: Record<string, number>;
  onContinue: () => void;
}

const PointsTab = ({
  courses, totalPoints, monthPoints, coursePointsByKey, onContinue,
}: PointsTabProps) => (
  <div className="lp-tab-content">
    {/* Hero card */}
    <div className="lp-points-hero">
      <div className="lp-points-hero__figure">
        <span className="lp-points-hero__label">Total points</span>
        <span className="lp-points-hero__value">{totalPoints}</span>
        <span className="lp-points-hero__sub">{monthPoints ?? totalPoints} this month</span>
      </div>
      <div className="lp-points-hero__art">
        <img src={iconLightningLarge} alt="" className="lp-points-hero__icon" aria-hidden="true" />
      </div>
    </div>

    {/* By course */}
    <h2 className="lp-section-heading">By course</h2>
    <div className="lp-course-list">
      {courses.map((course, i) => (
        <PointsCourseRow
          key={course.courseId}
          course={course}
          artSrc={COURSE_ART[i % COURSE_ART.length].artSrc}
          tintClass={COURSE_ART[i % COURSE_ART.length].tintClass}
          gamificationPoints={coursePointsByKey?.[course.courseId]}
        />
      ))}
    </div>

    {/* Rules pill */}
    <div className="lp-rules-wrap">
      <button type="button" className="lp-rules-pill">
        <img src={iconCircleInfo} alt="" className="lp-rules-pill__icon" aria-hidden="true" />
        <span>How points work</span>
      </button>
    </div>

    <div className="lp-spacer" />

    {/* Footer CTA */}
    <button type="button" className="btn-primary" onClick={onContinue}>
      Continue learning
    </button>
  </div>
);

// ── Streak tab ───────────────────────────────────────────

type StreakState = 'none' | 'reset';

type WeekCellState = 'empty' | 'met' | 'forgiven' | 'missed' | 'current';

interface WeekCellData {
  monthLabel: string;
  dateLabel: string;
  state: WeekCellState;
}

const LP_WEEKDAY_LABEL: Record<WeekdayKey, string> = {
  mon: 'M', tue: 'T', wed: 'W', thu: 'T', fri: 'F', sat: 'S', sun: 'S',
};

function mapApiDaysToLp(apiDays: GamificationDay[]): Array<{ label: string; state: LpDayState }> {
  const todayIdx = apiDays.findIndex((d) => d.is_today);
  return apiDays.map((day, idx) => {
    const label = LP_WEEKDAY_LABEL[day.weekday];
    if (day.learned) { return { label, state: 'learned' }; }
    if (day.is_today) { return { label, state: 'today' }; }
    if (todayIdx >= 0 && idx > todayIdx) { return { label, state: 'upcoming' }; }
    return { label, state: 'missed' };
  });
}

function mapApiRecentWeeks(summary: GamificationSummary): WeekCellData[] {
  const result: WeekCellData[] = summary.recent_weeks.map((week, idx) => {
    const state: WeekCellState = (
      week.status === 'streak' ? 'met'
        : week.status === 'forgiven' ? 'forgiven'
          : week.status === 'missed' ? 'missed'
            : 'empty'
    );
    const d = new Date(week.week_start);
    const day = String(d.getUTCDate());
    const prevMonth = idx > 0 ? new Date(summary.recent_weeks[idx - 1].week_start).getUTCMonth() : -1;
    const monthLabel = d.getUTCMonth() !== prevMonth
      ? d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
      : '';
    return { monthLabel, dateLabel: day, state };
  });
  result.push({ monthLabel: '', dateLabel: 'Now', state: 'current' });
  return result;
}

const STREAK_NONE_WEEKS: WeekCellData[] = [
  { monthLabel: 'Sep', dateLabel: '7', state: 'empty' },
  { monthLabel: '', dateLabel: '14', state: 'empty' },
  { monthLabel: '', dateLabel: '21', state: 'empty' },
  { monthLabel: '', dateLabel: '28', state: 'empty' },
  { monthLabel: 'Oct', dateLabel: '5', state: 'empty' },
  { monthLabel: '', dateLabel: '12', state: 'empty' },
  { monthLabel: '', dateLabel: '19', state: 'empty' },
  { monthLabel: '', dateLabel: 'Now', state: 'current' },
];

const STREAK_RESET_WEEKS: WeekCellData[] = [
  { monthLabel: 'Sep', dateLabel: '7', state: 'met' },
  { monthLabel: '', dateLabel: '14', state: 'met' },
  { monthLabel: '', dateLabel: '21', state: 'met' },
  { monthLabel: '', dateLabel: '28', state: 'met' },
  { monthLabel: 'Oct', dateLabel: '5', state: 'forgiven' },
  { monthLabel: '', dateLabel: '12', state: 'missed' },
  { monthLabel: '', dateLabel: '19', state: 'missed' },
  { monthLabel: '', dateLabel: 'Now', state: 'current' },
];

type LpDayState = 'learned' | 'today' | 'missed' | 'upcoming';

interface LpDayProps {
  state: LpDayState;
  label: string;
}

const LpDay = ({ state, label }: LpDayProps) => (
  <div className="lp-streak-day">
    <div className={`lp-streak-day__dot lp-streak-day__dot--${state}`}>
      {state === 'learned' && (
        <img src={iconCircleCheck} alt="" className="lp-streak-day__check" aria-hidden="true" />
      )}
    </div>
    <span className={`lp-streak-day__label${state === 'today' ? ' lp-streak-day__label--today' : ''}`}>
      {label}
    </span>
  </div>
);

interface StreakThisWeekProps {
  streakState?: StreakState;
  apiSummary?: GamificationSummary;
}

const STREAK_THIS_WEEK_DAYS: Record<StreakState, Array<{ label: string; state: LpDayState }>> = {
  none: [
    { label: 'M', state: 'missed' },
    { label: 'T', state: 'missed' },
    { label: 'W', state: 'today' },
    { label: 'T', state: 'upcoming' },
    { label: 'F', state: 'upcoming' },
    { label: 'S', state: 'upcoming' },
    { label: 'S', state: 'upcoming' },
  ],
  reset: [
    { label: 'M', state: 'learned' },
    { label: 'T', state: 'missed' },
    { label: 'W', state: 'today' },
    { label: 'T', state: 'upcoming' },
    { label: 'F', state: 'upcoming' },
    { label: 'S', state: 'upcoming' },
    { label: 'S', state: 'upcoming' },
  ],
};

const STREAK_THIS_WEEK_CONFIG: Record<StreakState, { completed: number; heading: string; desc: string }> = {
  none: {
    completed: 0,
    heading: 'Two days to go',
    desc: 'Learn on 2 days this week to start a week streak.',
  },
  reset: {
    completed: 1,
    heading: 'One more day to go',
    desc: 'Learn on one more day this week to start a new streak.',
  },
};

const StreakThisWeek = ({ streakState = 'none', apiSummary }: StreakThisWeekProps) => {
  const apiWeek = apiSummary?.this_week;
  const days = apiWeek ? mapApiDaysToLp(apiWeek.days) : STREAK_THIS_WEEK_DAYS[streakState];
  const daysCompleted = apiWeek ? apiWeek.learning_days : STREAK_THIS_WEEK_CONFIG[streakState].completed;
  const goal = apiWeek ? apiWeek.goal : 2;
  const showProgress = daysCompleted > 0;
  const currentStreak = apiSummary?.current_streak_weeks ?? 0;

  let heading: string;
  let desc: string;

  if (apiWeek) {
    if (apiWeek.status === 'paused') {
      heading = 'Streak paused';
      desc = 'Nothing required is left, so your streak is safe.';
    } else if (apiWeek.status === 'goal_met') {
      heading = 'Goal met this week';
      desc = apiWeek.projected_streak_weeks > currentStreak
        ? `Your streak grows to ${apiWeek.projected_streak_weeks} weeks when the week ends.`
        : 'Keep learning — your streak is already growing.';
    } else if (daysCompleted === 0) {
      heading = 'Two days to go';
      desc = 'Learn on 2 days this week to start a week streak.';
    } else {
      heading = 'One more day to go';
      desc = currentStreak > 0
        ? `Learn on one more day this week to keep your ${currentStreak}-week streak.`
        : 'Learn on one more day this week to start your first streak.';
    }
  } else {
    const cfg = STREAK_THIS_WEEK_CONFIG[streakState];
    heading = cfg.heading;
    desc = cfg.desc;
  }

  return (
    <div className="lp-streak-this-week">
      <div className="lp-streak-this-week__goal">
        <div className="lp-streak-this-week__ring" aria-label={`${daysCompleted} of ${goal} days done`}>
          <img src={ringTrack} alt="" className="lp-streak-this-week__ring-track" aria-hidden="true" />
          {showProgress && (
            <img src={ringProgress} alt="" className="lp-streak-this-week__ring-progress" aria-hidden="true" />
          )}
          <span className="lp-streak-this-week__ring-label">{daysCompleted}/{goal}</span>
        </div>
        <div className="lp-streak-this-week__words">
          <span className="lp-streak-this-week__heading">{heading}</span>
          <span className="lp-streak-this-week__desc">{desc}</span>
        </div>
      </div>
      <div className="lp-streak-this-week__days">
        {days.map((day, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <LpDay key={i} state={day.state} label={day.label} />
        ))}
      </div>
    </div>
  );
};

interface StreakTabProps {
  streakState?: StreakState;
  apiSummary?: GamificationSummary;
  onContinue: () => void;
}

const StreakTab = ({ streakState = 'none', apiSummary, onContinue }: StreakTabProps) => {
  const streakCount = apiSummary?.current_streak_weeks ?? (streakState === 'reset' ? 0 : 0);
  const longestStreak = apiSummary?.longest_streak_weeks ?? (streakState === 'reset' ? 4 : 0);
  const weeks = apiSummary ? mapApiRecentWeeks(apiSummary) : (streakState === 'reset' ? STREAK_RESET_WEEKS : STREAK_NONE_WEEKS);
  const subLine = longestStreak > streakCount
    ? `weeks in a row · longest ${longestStreak}`
    : 'weeks in a row';

  return (
    <div className="lp-tab-content">
      {/* Hero — includes 8-week history */}
      <div className="lp-streak-hero">
        <div className="lp-streak-hero__row">
          <div className="lp-streak-hero__figure">
            <span className="lp-points-hero__label">Week streak</span>
            <span className="lp-points-hero__value">{streakCount}</span>
            <span className="lp-points-hero__sub">{subLine}</span>
          </div>
          <div className="lp-streak-hero__art lp-streak-hero__art--green">
            <img src={iconCalendar} alt="" className="lp-streak-hero__icon" aria-hidden="true" />
          </div>
        </div>
        <div className="lp-week-history" aria-label="8-week history">
          {weeks.map((week, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="lp-week-col">
              <span className="lp-week-col__month">{week.monthLabel}</span>
              <div className={`lp-week-cell lp-week-cell--${week.state}`}>
                {week.state === 'met' && (
                  <img src={iconCircleCheck} alt="" className="lp-week-cell__icon" aria-hidden="true" />
                )}
              </div>
              <span className={`lp-week-col__date${week.state === 'current' ? ' lp-week-col__date--current' : ''}`}>
                {week.dateLabel}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* This week */}
      <StreakThisWeek streakState={streakState} apiSummary={apiSummary} />

      <div className="lp-rules-wrap">
        <button type="button" className="lp-rules-pill">
          <img src={iconCircleInfo} alt="" className="lp-rules-pill__icon" aria-hidden="true" />
          <span>How your streak works</span>
        </button>
      </div>

      <div className="lp-spacer" />
      <button type="button" className="btn-primary" onClick={onContinue}>
        Continue learning
      </button>
    </div>
  );
};

// ── Badges tab ───────────────────────────────────────────

function formatEarnedDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

type BadgesState = 'default' | 'thirtyDayDue' | 'allEarned';

interface BadgeRowHiFiProps {
  src: string;
  name: string;
  sub: string;
}

const BadgeRowHiFi = ({ src, name, sub }: BadgeRowHiFiProps) => (
  <div className="lp-badge-row--hifi">
    <img src={src} alt="" className="lp-badge-row__img--hifi" aria-hidden="true" />
    <div className="lp-badge-row__body--hifi">
      <span className="lp-badge-row__name--hifi">{name}</span>
      <span className="lp-badge-row__sub--hifi">{sub}</span>
    </div>
  </div>
);

interface BadgesTabProps {
  badgesState?: BadgesState;
  apiCurriculum?: LearnerCurriculum;
  onContinue: () => void;
  onThirtyDayCheck?: () => void;
}

const SLOT_ORDER: BadgeSlot[] = ['halfway', 'complete', 'retained'];

const SLOT_FALLBACK_EARNED: Record<BadgeSlot, string> = {
  halfway: badgeHalfwayEarned,
  complete: badgeCompleteEarned,
  retained: badgeRetainedEarned,
};
const SLOT_FALLBACK_LOCKED: Record<BadgeSlot, string> = {
  halfway: badgeHalfwayEarned,
  complete: badgeCompleteLocked,
  retained: badgeRetainedLocked,
};
const SLOT_LABEL: Record<BadgeSlot, string> = {
  halfway: 'Halfway',
  complete: 'Complete',
  retained: 'Retained',
};

const BadgesTab = ({ badgesState = 'default', apiCurriculum, onContinue, onThirtyDayCheck }: BadgesTabProps) => {
  const milestones = apiCurriculum?.milestones;
  const knowledgeCheck = apiCurriculum?.knowledge_check;

  const earnedSlots = milestones
    ? SLOT_ORDER.filter((s) => milestones[s].reached_at !== null).length
    : (badgesState === 'allEarned' ? 3 : badgesState === 'thirtyDayDue' ? 2 : 1);

  const isThirtyDayDue = milestones ? Boolean(knowledgeCheck?.is_open) : badgesState === 'thirtyDayDue';

  const handleThirtyDay = () => {
    if (knowledgeCheck?.course_id) {
      onThirtyDayCheck?.();
    } else {
      onContinue();
    }
  };

  return (
    <div className="lp-tab-content">
      {/* Hero */}
      <div className="lp-badges-hifi-hero">
        <div className="lp-badges-hifi-hero__figure">
          <span className="lp-points-hero__label">Badges</span>
          <span className="lp-points-hero__value">{earnedSlots} of 3</span>
          <span className="lp-points-hero__sub">for your required courses</span>
        </div>
        <div className="lp-badges-hifi-hero__art">
          <img src={iconBadgeCheck} alt="" className="lp-badges-hifi-hero__icon" aria-hidden="true" />
        </div>
      </div>

      {/* Badge list */}
      <div className="lp-badge-list--hifi">
        {SLOT_ORDER.map((slot) => {
          const milestone = milestones?.[slot];
          const earned = milestone ? milestone.reached_at !== null : undefined;
          const apiImageUrl = milestone?.badge?.image_url ?? null;
          const badgeTitle = milestone?.badge?.title ?? SLOT_LABEL[slot];
          const imgSrc = apiImageUrl ?? (
            slot === 'halfway'
              ? badgeHalfwayEarned
              : earned === false
              ? SLOT_FALLBACK_LOCKED[slot]
              : SLOT_FALLBACK_EARNED[slot]
          );

          let sub: string;
          if (milestone) {
            if (milestone.reached_at) {
              sub = `Earned ${formatEarnedDate(milestone.reached_at)}`;
            } else if (slot === 'retained' && isThirtyDayDue) {
              sub = 'Your 30-day check is open';
            } else if (slot === 'retained') {
              sub = 'Pass your 30-day check to earn this';
            } else {
              sub = 'Finish all lessons to earn this';
            }
          } else {
            // No API data — fall back to static state
            if (slot === 'halfway') {
              sub = 'Earned 26 October 2026';
            } else if (slot === 'complete') {
              sub = badgesState === 'default' ? 'Finish all lessons to earn this' : 'Earned 2 November 2026';
            } else {
              sub = badgesState === 'allEarned' ? 'Earned 2 December 2026'
                : badgesState === 'thirtyDayDue' ? 'Your 30-day check is open'
                : 'Pass your 30-day check to earn this';
            }
          }

          return (
            <BadgeRowHiFi
              key={slot}
              src={imgSrc}
              name={badgeTitle}
              sub={sub}
            />
          );
        })}
        {isThirtyDayDue && (
          <div className="lp-badge-cta">
            <button type="button" className="btn-primary" onClick={handleThirtyDay}>
              Take your 30-day check
            </button>
          </div>
        )}
      </div>

      <div className="lp-rules-wrap">
        <button type="button" className="lp-rules-pill">
          <img src={iconCircleInfo} alt="" className="lp-rules-pill__icon" aria-hidden="true" />
          <span>How badges work</span>
        </button>
      </div>

      <div className="lp-spacer" />
      <button type="button" className="btn-primary" onClick={onContinue}>
        Continue learning
      </button>
    </div>
  );
};

// ── Leaderboard tab ──────────────────────────────────────

const PersonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <circle cx="9" cy="6" r="3.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M2 16c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

interface LeaderboardTabProps {
  apiData?: LeaderboardData;
  onContinue: () => void;
}

const LeaderboardTab = ({ apiData, onContinue }: LeaderboardTabProps) => {
  const isRanked = apiData?.status === 'ranked';
  const myRank = apiData?.my_rank ?? null;
  const totalDrivers = apiData?.total_drivers ?? 0;
  const topPct = myRank && totalDrivers > 0
    ? Math.round((myRank / totalDrivers) * 100)
    : null;

  const displayRows = apiData?.rows ?? [];

  return (
    <div className="lp-tab-content">
      {isRanked ? (
        <>
          <div className="lp-leaderboard-hero">
            <span className="lp-points-hero__label">Your rank</span>
            <span className="lp-points-hero__value">#{myRank}</span>
            {topPct !== null && (
              <span className="lp-points-hero__sub">Top {topPct}% this month</span>
            )}
          </div>
          <h2 className="lp-section-heading">This month</h2>
          <div className="lp-leaderboard-list">
            {displayRows.map((row) => (
              <div
                key={row.rank}
                className={`lp-leaderboard-row${row.is_me ? ' lp-leaderboard-row--you' : ''}`}
              >
                <span className="lp-leaderboard-row__rank">{row.rank}</span>
                <span className="lp-leaderboard-row__name">{row.is_me ? 'You' : (row.display_name ?? '')}</span>
                <span className="lp-leaderboard-row__points">{row.points}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="lp-leaderboard-hero--hifi">
            <div className="lp-leaderboard-hero__figure">
              <span className="lp-points-hero__label">Your rank this month</span>
              <span className="lp-points-hero__value">Not yet</span>
              <span className="lp-points-hero__sub">Finish a lesson this month to join</span>
            </div>
            <div className="lp-podium" aria-hidden="true">
              <div className="lp-podium__bar lp-podium__bar--silver" />
              <div className="lp-podium__bar lp-podium__bar--gold" />
              <div className="lp-podium__bar lp-podium__bar--bronze" />
            </div>
          </div>

          <h2 className="lp-section-heading">This month</h2>
          <div className="lp-leaderboard-list--hifi">
            {displayRows.map((row) => (
              <div key={row.rank} className="lp-leaderboard-row--hifi">
                <span className="lp-leaderboard-row__rank--hifi">{row.rank}</span>
                <div className="lp-leaderboard-avatar">
                  <span className="lp-leaderboard-avatar__icon"><PersonIcon /></span>
                </div>
                <span className="lp-leaderboard-row__name--hifi">{row.display_name ?? ''}</span>
                <span className="lp-leaderboard-row__points--hifi">{row.points}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="lp-rules-wrap">
        <button type="button" className="lp-rules-pill">
          <img src={iconCircleInfo} alt="" className="lp-rules-pill__icon" aria-hidden="true" />
          <span>How the leaderboard works</span>
        </button>
      </div>

      <div className="lp-spacer" />
      <button type="button" className="btn-primary" onClick={onContinue}>
        Continue learning
      </button>
    </div>
  );
};

// ── Main page ────────────────────────────────────────────

export const LearningProgress = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('Points');

  const { data: courses } = useQuery({
    queryKey: ['enrolled-courses'],
    queryFn: getEnrolledCourses,
    staleTime: 5 * 60_000,
  });

  const { data: gamification } = useGamification();
  const { data: leaderboardData } = useLeaderboard();
  const { data: curriculums } = useCurriculums();

  const enrolledCourses = courses ?? [];
  const firstCourseId = enrolledCourses[0]?.courseId;
  const { data: progressData } = useProgress(firstCourseId ?? '');

  // Use gamification API for points; fall back to legacy progress API while loading
  const totalPoints = gamification?.lifetime_points ?? progressData?.points?.earned ?? 0;
  const monthPoints = gamification?.month_points;

  // Build course_key → gamification points map for PointsTab rows
  const coursePointsByKey: Record<string, number> = {};
  gamification?.courses.forEach((c) => { coursePointsByKey[c.course_key] = c.points; });

  const handleContinue = () => {
    if (firstCourseId) {
      navigate(`/course/${firstCourseId}`);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="lp-page">
      {/* Navigation header */}
      <header className="lp-nav">
        <button
          type="button"
          className="lp-nav__back"
          aria-label="Go back"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft />
        </button>
        <span className="lp-nav__title">Your progress</span>
        <div className="lp-nav__spacer" aria-hidden="true" />
      </header>

      {/* Tabs */}
      <div className="lp-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            className={`lp-tab${activeTab === tab ? ' lp-tab--active' : ''}`}
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          >
            <span className="lp-tab__label">{tab}</span>
            <span className="lp-tab__bar" />
          </button>
        ))}
      </div>

      {/* Scrollable content + footer */}
      <div className="lp-body">
        {activeTab === 'Points' && (
          <PointsTab
            courses={enrolledCourses}
            totalPoints={totalPoints}
            monthPoints={monthPoints}
            coursePointsByKey={coursePointsByKey}
            onContinue={handleContinue}
          />
        )}
        {activeTab === 'Streak' && (
          <StreakTab
            apiSummary={gamification}
            onContinue={handleContinue}
          />
        )}
        {activeTab === 'Badges' && (
          <BadgesTab
            apiCurriculum={curriculums?.[0]}
            onContinue={handleContinue}
          />
        )}
        {activeTab === 'Leaderboard' && (
          <LeaderboardTab
            apiData={leaderboardData}
            onContinue={handleContinue}
          />
        )}
      </div>
    </div>
  );
};
