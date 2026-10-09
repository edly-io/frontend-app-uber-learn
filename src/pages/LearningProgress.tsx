import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getEnrolledCourses, type EnrolledCourse } from '../api/catalog';
import { useCourseOutline } from '../hooks/useCourseOutline';
import { mapOutlineToLessons } from '../lib/outline-mapper';
import { getStoredResumeIdx } from '../lib/resume-storage';
import { useGamification, type GamificationSummary } from '../hooks/useGamification';
import { useLeaderboard, type LeaderboardData } from '../hooks/useLeaderboard';
import { useCurriculums } from '../hooks/useCurriculums';
import { useBadges } from '../hooks/useBadges';
import type { LearnerCurriculum, BadgeAward } from '../api/curriculum';
import type { GamificationDay, WeekdayKey } from '../api/gamification';
import { BadgeDetailSheet, type SheetBadgeData } from '../components/ui/BadgeDetailSheet';
import { InfoSheet, type InfoSheetData } from '../components/ui/InfoSheet';
import { GoalRing } from '../components/ui/GoalRing';

import iconCircleInfo from '../assets/icons/icon-circle-info.svg';
import courseArtBlue from '../assets/icons/course-art-blue2.svg';
import courseArtTeal from '../assets/icons/course-art-teal2.svg';
import iconLightningLarge from '../assets/icons/icon-lightning-large.svg';
import iconCircleCheck from '../assets/icons/icon-circle-check.svg';
import iconCalendar from '../assets/icons/icon-calendar.svg';
import iconBadgeCheck from '../assets/icons/icon-badge-check.svg';
import courseArtBlue1 from '../assets/icons/course-art-blue.svg';
import courseArtOrange from '../assets/icons/course-art-orange.svg';
import courseArtMagenta from '../assets/icons/course-art-magenta.svg';
import courseArtPurple from '../assets/icons/course-art-purple.svg';
import courseArtLime from '../assets/icons/course-art-lime.svg';
import courseArtSteering from '../assets/icons/course-art-steering.svg';
import courseArtToolbox from '../assets/icons/course-art-toolbox.svg';

import './learning-progress.scss';

// ── Tab types ────────────────────────────────────────────

type TabId = 'Points' | 'Streak' | 'Badges' | 'Leaderboard';

const TABS: TabId[] = ['Points', 'Streak', 'Badges', 'Leaderboard'];

// ── Info sheet content ───────────────────────────────────

const INFO_POINTS: InfoSheetData = {
  title: 'How points work',
  bullets: [
    '10 points for each step, the first time you finish a lesson.',
    'Plus 5 for each question you get right on the first try.',
    "Repeats and checks don't add points.",
    'Points are never taken away.',
  ],
};

const INFO_STREAK: InfoSheetData = {
  title: 'How your streak works',
  bullets: [
    'Learn on 2 days a week, Monday to Sunday.',
    'Every course counts, in a path or not.',
    "One missed week in any eight is forgiven. That's the outlined week.",
    "If there's no course left to take, your streak pauses.",
  ],
};

const INFO_BADGES: InfoSheetData = {
  title: 'How badges work',
  bullets: [
    'Every course has a badge. Finish its lessons and final check to earn it.',
    'Every learning path has a badge too, for finishing all its courses.',
    '30 days later, a check on the path earns one more.',
    "Badges turn from grey to colour when earned. They're never taken away.",
  ],
};

const INFO_LEADERBOARD: InfoSheetData = {
  title: 'How the leaderboard works',
  bullets: [
    'Ranked by points earned this month. Everyone starts again on the 1st.',
    'Your total stays on the Points tab.',
    "Other drivers' names are hidden.",
    "Drivers with no points this month aren't listed.",
  ],
};

const INFO_MAP: Record<TabId, InfoSheetData> = {
  Points: INFO_POINTS,
  Streak: INFO_STREAK,
  Badges: INFO_BADGES,
  Leaderboard: INFO_LEADERBOARD,
};

// ── Icons ────────────────────────────────────────────────

const CloseX = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// ── Helpers ──────────────────────────────────────────────

const toOrdinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

const getResetsText = (resetsOn?: string): string => {
  if (resetsOn) {
    const d = new Date(resetsOn);
    return `resets ${d.toLocaleString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}`;
  }
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  return `resets 1 ${d.toLocaleString('en-US', { month: 'long' })}`;
};

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
  const allLessons = outlineQuery.data ? mapOutlineToLessons(outlineQuery.data) : [];
  const totalLessons = allLessons.length;
  const storedIdx = totalLessons > 0 ? getStoredResumeIdx(course.courseId, allLessons) : -1;
  const completedLessons = storedIdx > 0 ? storedIdx : 0;
  const pointsEarned = gamificationPoints ?? 0;

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
}

const PointsTab = ({
  courses, totalPoints, monthPoints, coursePointsByKey,
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
    {courses.length > 0 && (
      <>
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
      </>
    )}
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
    let state: WeekCellState = 'empty';
    if (week.status === 'streak') { state = 'met'; } else if (week.status === 'forgiven') { state = 'forgiven'; } else if (week.status === 'missed') { state = 'missed'; }
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
    } else {
      const remaining = goal - daysCompleted;
      heading = remaining === 1 ? 'One more day to go' : `${remaining} days to go`;
      if (remaining === 1) {
        desc = currentStreak > 0
          ? `Learn on one more day this week to keep your ${currentStreak}-week streak.`
          : 'Learn on one more day this week to start your first streak.';
      } else {
        desc = `Learn on ${remaining} days this week to ${currentStreak > 0 ? 'keep your streak' : 'start a streak'}.`;
      }
    }
  } else {
    const cfg = STREAK_THIS_WEEK_CONFIG[streakState];
    heading = cfg.heading;
    desc = cfg.desc;
  }

  return (
    <div className="lp-streak-this-week">
      <div className="lp-streak-this-week__goal">
        <GoalRing daysCompleted={daysCompleted} daysGoal={goal} />
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
}

const StreakTab = ({ streakState = 'none', apiSummary }: StreakTabProps) => {
  const streakCount = apiSummary?.current_streak_weeks ?? (streakState === 'reset' ? 0 : 0);
  const longestStreak = apiSummary?.longest_streak_weeks ?? (streakState === 'reset' ? 4 : 0);
  let weeks: WeekCellData[];
  if (apiSummary) { weeks = mapApiRecentWeeks(apiSummary); } else if (streakState === 'reset') { weeks = STREAK_RESET_WEEKS; } else { weeks = STREAK_NONE_WEEKS; }
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
    </div>
  );
};

// ── Badges tab ───────────────────────────────────────────

const COURSE_ARTS = [
  { art: courseArtBlue1, tint: 'var(--u-learning-course-tint-blue)' },
  { art: courseArtLime, tint: 'var(--u-learning-course-tint-lime)' },
  { art: courseArtOrange, tint: 'var(--u-learning-course-tint-orange)' },
  { art: courseArtMagenta, tint: 'var(--u-learning-course-tint-magenta)' },
  { art: courseArtPurple, tint: 'var(--u-learning-course-tint-purple)' },
  { art: courseArtSteering, tint: 'var(--u-learning-course-tint-teal)' },
  { art: courseArtToolbox, tint: 'var(--u-learning-course-tint-blue)' },
];

// ── Badge grid seal ring ──────────────────────────────────

const GridSealRing = ({
  progress, art, tintColor, earned, hasThirty, thirtyOpen,
}: {
  progress: number; art: string; tintColor: string; earned: boolean;
  hasThirty?: boolean; thirtyOpen?: boolean;
}) => {
  const size = 88;
  const r = (size - 12) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(1, progress));

  return (
    <div className="lp-badge-grid-ring" style={{ width: size, height: size }}>
      <svg className="lp-badge-grid-ring__svg" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={c} cy={c} r={r} stroke="var(--u-border-opaque)" strokeWidth="4" fill="none" />
        {progress > 0 && (
          <circle
            cx={c}
            cy={c}
            r={r}
            stroke="var(--u-background-accent)"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${c} ${c})`}
          />
        )}
      </svg>
      <div
        className="lp-badge-grid-ring__inner"
        style={{ background: earned ? tintColor : 'var(--u-background-tertiary)' }}
      >
        <img
          src={art}
          alt=""
          className={`lp-badge-grid-ring__art${earned ? '' : ' lp-badge-grid-ring__art--locked'}`}
          aria-hidden="true"
        />
      </div>
      {hasThirty && (
        <div
          className={`lp-badge-grid-ring__thirty${thirtyOpen ? ' lp-badge-grid-ring__thirty--open' : ''}`}
          aria-label={thirtyOpen ? '30-day check open' : '30-day check locked'}
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <path d="M10 13c-3.314 0-6-2.686-6-6V3h12v4c0 3.314-2.686 6-6 6Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <path d="M4 5H2v2c0 1.657 1.343 3 3 3M16 5h2v2c0 1.657-1.343 3-3 3M10 13v4M7 17h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </div>
  );
};

// ── Badge grid item ───────────────────────────────────────

const BadgeGridItem = ({
  title, sub, ring, isNew, onClick,
}: {
  title: string; sub: string; ring: React.ReactNode; isNew?: boolean; onClick: () => void;
}) => (
  <button type="button" className="lp-badge-grid-item" onClick={onClick}>
    <div className="lp-badge-grid-item__ring-wrap">
      {ring}
      {isNew && <span className="lp-badge-grid-item__new">New</span>}
    </div>
    <span className="lp-badge-grid-item__name">{title}</span>
    <span className="lp-badge-grid-item__sub">{sub}</span>
  </button>
);

// ── Main BadgesTab ────────────────────────────────────────

interface BadgesTabProps {
  curriculums?: LearnerCurriculum[];
  courses: EnrolledCourse[];
  isCoursesLoading?: boolean;
}

const BadgesTab = ({ curriculums, courses, isCoursesLoading }: BadgesTabProps) => {
  const [sheet, setSheet] = useState<SheetBadgeData | null>(null);
  const { data: badgesPage } = useBadges();
  const totalBadges = badgesPage?.count ?? 0;
  const earnedAwards = badgesPage?.results ?? [];

  // Build map of course_id → BadgeAward for quick lookup
  const courseAwardMap = new Map<string, BadgeAward>();
  earnedAwards.forEach((a) => {
    if (a.source.type === 'course') {
      courseAwardMap.set(a.source.course_id, a);
    }
  });

  const handlePathClick = (curriculum: LearnerCurriculum) => {
    setSheet({ kind: 'path', curriculum });
  };

  const handleCourseClick = (course: EnrolledCourse, idx: number) => {
    const award = courseAwardMap.get(course.courseId);
    const artMeta = COURSE_ARTS[idx % COURSE_ARTS.length];
    const earned = Boolean(award);
    const badgeImageUrl = award?.badge?.image_url;
    setSheet({
      kind: 'course',
      courseId: course.courseId,
      title: award?.badge.title ?? course.title,
      description: award?.badge.description ?? 'Earned when you finish all lessons and the final check.',
      art: (earned && badgeImageUrl) ? badgeImageUrl : artMeta.art,
      tintColor: artMeta.tint,
      progress: 'In progress',
      earned,
      earnedDate: award
        ? new Date(award.awarded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : undefined,
    });
  };

  const badgeLabel = totalBadges === 1 ? 'badge earned' : 'badges earned';

  return (
    <div className="lp-tab-content">
      {/* Hero */}
      <div className="lp-badges-hifi-hero">
        <div className="lp-badges-hifi-hero__figure">
          <span className="lp-points-hero__label">Badges</span>
          <span className="lp-points-hero__value">{totalBadges}</span>
          <span className="lp-points-hero__sub">{badgeLabel}</span>
        </div>
        <div className="lp-badges-hifi-hero__art">
          <img src={iconBadgeCheck} alt="" className="lp-badges-hifi-hero__icon" aria-hidden="true" />
        </div>
      </div>

      {/* Learning paths section */}
      {curriculums && curriculums.length > 0 && (
        <>
          <h2 className="lp-section-heading lp-section-heading--badges">Learning paths</h2>
          <div className="lp-badge-grid">
            {curriculums.map((c) => {
              const { complete } = c.milestones;
              const { retained } = c.milestones;
              const isComplete = complete?.reached_at != null;
              const thirtyOpen = c.knowledge_check.is_open;
              const thirtyEarned = retained?.reached_at != null;
              const progress = c.courses_total > 0
                ? c.courses_finished / c.courses_total
                : 0;
              const sub = isComplete
                ? new Date(complete!.reached_at!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                : `${c.courses_finished}/${c.courses_total} courses`;

              return (
                <BadgeGridItem
                  key={c.uuid}
                  title={c.title}
                  sub={sub}
                  onClick={() => handlePathClick(c)}
                  ring={(
                    <GridSealRing
                      progress={progress}
                      art={complete?.badge?.image_url ?? iconBadgeCheck}
                      tintColor="var(--u-learning-course-tint-blue)"
                      earned={isComplete}
                      hasThirty={!thirtyEarned}
                      thirtyOpen={thirtyOpen}
                    />
                  )}
                />
              );
            })}
          </div>
        </>
      )}

      {/* Courses section */}
      {isCoursesLoading && courses.length === 0 && (
        <>
          <h2 className="lp-section-heading lp-section-heading--badges lp-section-heading--with-divider">Courses</h2>
          <div className="lp-badge-grid lp-badge-grid--loading">
            {[0, 1, 2].map((i) => (
              <div key={i} className="lp-badge-grid-item">
                <div className="lp-badge-grid-ring__skeleton" />
              </div>
            ))}
          </div>
        </>
      )}
      {courses.length > 0 && (
        <>
          <h2 className="lp-section-heading lp-section-heading--badges lp-section-heading--with-divider">Courses</h2>
          <div className="lp-badge-grid">
            {courses.map((course, idx) => {
              const award = courseAwardMap.get(course.courseId);
              const artMeta = COURSE_ARTS[idx % COURSE_ARTS.length];
              const earned = Boolean(award);
              const isNew = award && !award.seen;
              const sub = earned
                ? new Date(award!.awarded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : 'In progress';
              const artSrc = (earned && award?.badge?.image_url) ? award.badge.image_url : artMeta.art;

              return (
                <BadgeGridItem
                  key={course.courseId}
                  title={course.title}
                  sub={sub}
                  isNew={Boolean(isNew)}
                  onClick={() => handleCourseClick(course, idx)}
                  ring={(
                    <GridSealRing
                      progress={earned ? 1 : 0.2}
                      art={artSrc}
                      tintColor={artMeta.tint}
                      earned={earned}
                    />
                  )}
                />
              );
            })}
          </div>
        </>
      )}

      <BadgeDetailSheet data={sheet} onClose={() => setSheet(null)} />
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
}

const LeaderboardTab = ({ apiData }: LeaderboardTabProps) => {
  const isRanked = apiData?.status === 'ranked';
  const myRank = apiData?.my_rank ?? null;
  const totalDrivers = apiData?.total_drivers ?? 0;
  const displayRows = apiData?.rows ?? [];

  const heroLabel = 'Your rank this month';
  const heroValue = isRanked && myRank ? toOrdinal(myRank) : '0';
  const heroSub = isRanked && myRank
    ? `of ${totalDrivers} drivers · ${getResetsText(apiData?.resets_on)}`
    : 'Finish a lesson this month to join';

  return (
    <div className="lp-tab-content">
      <div className="lp-leaderboard-hero--hifi">
        <div className="lp-leaderboard-hero__figure">
          <span className="lp-points-hero__label">{heroLabel}</span>
          <span className="lp-points-hero__value">{heroValue}</span>
          <span className="lp-points-hero__sub">{heroSub}</span>
        </div>
        <div className="lp-podium" aria-hidden="true">
          <div className="lp-podium__bar lp-podium__bar--silver" />
          <div className="lp-podium__bar lp-podium__bar--gold" />
          <div className="lp-podium__bar lp-podium__bar--bronze" />
        </div>
      </div>

      <div className="lp-leaderboard-list--hifi">
        {displayRows.map((row, i) => {
          const prev = displayRows[i - 1];
          const hasGap = prev && row.rank - prev.rank > 1;
          return (
            <React.Fragment key={row.rank}>
              {hasGap && <div className="lp-leaderboard-gap">···</div>}
              <div className={`lp-leaderboard-row--hifi${row.is_me ? ' lp-leaderboard-row--you' : ''}`}>
                <span className="lp-leaderboard-row__rank--hifi">{row.rank}</span>
                <div className={`lp-leaderboard-avatar${row.is_me ? ' lp-leaderboard-avatar--me' : ''}`}>
                  <span className="lp-leaderboard-avatar__icon"><PersonIcon /></span>
                </div>
                <span className="lp-leaderboard-row__name--hifi">{row.is_me ? 'You' : (row.display_name ?? '')}</span>
                <span className="lp-leaderboard-row__points--hifi">{row.points}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

    </div>
  );
};

// ── Main page ────────────────────────────────────────────

export const LearningProgress = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initialTab = (TABS as readonly string[]).includes(location.state?.tab)
    ? (location.state.tab as TabId)
    : 'Points';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [infoSheet, setInfoSheet] = useState<InfoSheetData | null>(null);

  const { data: courses, isLoading: isCoursesLoading } = useQuery({
    queryKey: ['enrolled-courses'],
    queryFn: getEnrolledCourses,
    staleTime: 5 * 60_000,
  });

  const { data: gamification } = useGamification();
  const { data: leaderboardData } = useLeaderboard();
  const { data: curriculums } = useCurriculums();

  const enrolledCourses = courses ?? [];
  const firstCourseId = enrolledCourses[0]?.courseId;
  const totalPoints = gamification?.lifetime_points ?? 0;
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
          className="lp-nav__close"
          aria-label="Close"
          onClick={() => navigate(-1)}
        >
          <CloseX />
        </button>
        <span className="lp-nav__title">Your progress</span>
        <button
          type="button"
          className="lp-nav__info"
          aria-label="How this works"
          onClick={() => setInfoSheet(INFO_MAP[activeTab])}
        >
          <img src={iconCircleInfo} alt="" aria-hidden="true" />
        </button>
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
          />
        )}
        {activeTab === 'Streak' && (
          <StreakTab apiSummary={gamification} />
        )}
        {activeTab === 'Badges' && (
          <BadgesTab curriculums={curriculums} courses={enrolledCourses} isCoursesLoading={isCoursesLoading} />
        )}
        {activeTab === 'Leaderboard' && (
          <LeaderboardTab apiData={leaderboardData} />
        )}
      </div>

      {/* Sticky footer — only when enrolled in at least one course */}
      {enrolledCourses.length > 0 && (
        <footer className="lp-footer">
          <button type="button" className="btn-primary" onClick={handleContinue}>
            Continue learning
          </button>
        </footer>
      )}

      <InfoSheet data={infoSheet} onClose={() => setInfoSheet(null)} />
    </div>
  );
};
