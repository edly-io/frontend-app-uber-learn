import React, {
  useState, useCallback, useRef, useEffect, useMemo,
} from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorView } from '../components/ui/ErrorView';
import { useGamification, type GamificationSummary } from '../hooks/useGamification';
import { useLeaderboard, type LeaderboardData } from '../hooks/useLeaderboard';
import { useCurriculums } from '../hooks/useCurriculums';
import { useBadges } from '../hooks/useBadges';
import { useLearnCourses, type LearnCourse } from '../hooks/useLearnCourses';
import { qk } from '../api/queries';
import type { LearnerCurriculum, BadgeEntry } from '../api/curriculum';
import { getLastActivity } from '../api/curriculum';
import type { GamificationDay, WeekdayKey } from '../api/gamification';
import { BadgeDetailSheet, type SheetBadgeData } from '../components/ui/BadgeDetailSheet';
import { InfoSheet, type InfoSheetData } from '../components/ui/InfoSheet';
import { GoalRing } from '../components/ui/GoalRing';
import {
  type TabId, TABS, INFO_MAP,
} from './learning-progress/info-content';
import { toOrdinal, getResetsText } from './learning-progress/format';
import { PointsTab } from './learning-progress/PointsTab';

import iconCircleInfo from '../assets/icons/icon-circle-info.svg';
import iconCircleCheck from '../assets/icons/icon-circle-check.svg';
import iconCalendar from '../assets/icons/icon-calendar.svg';
import iconBadgeCheck from '../assets/icons/icon-badge-check.svg';
import iconTrophyEarned from '../assets/icons/badge-art-trophy-earned.svg';
import iconTrophyLocked from '../assets/icons/badge-art-retained.svg';
import courseArtBlue1 from '../assets/icons/course-art-blue.svg';
import courseArtOrange from '../assets/icons/course-art-orange.svg';
import courseArtMagenta from '../assets/icons/course-art-magenta.svg';
import courseArtPurple from '../assets/icons/course-art-purple.svg';
import courseArtLime from '../assets/icons/course-art-lime.svg';
import courseArtSteering from '../assets/icons/course-art-steering.svg';
import courseArtToolbox from '../assets/icons/course-art-toolbox.svg';

import './learning-progress.scss';

// ── Icons ────────────────────────────────────────────────

const CloseX = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// ── Streak tab ───────────────────────────────────────────

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

const StreakThisWeek = ({ apiSummary }: { apiSummary: GamificationSummary }) => {
  const apiWeek = apiSummary.this_week;
  if (!apiWeek) { return null; }
  const days = mapApiDaysToLp(apiWeek.days);
  const daysCompleted = apiWeek.learning_days;
  const { goal } = apiWeek;
  const currentStreak = apiSummary.current_streak_weeks;

  let heading: string;
  let desc: string;

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
      const streakAction = currentStreak > 0 ? 'keep your streak' : 'start a streak';
      desc = `Learn on ${remaining} days this week to ${streakAction}.`;
    }
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

const StreakTab = ({ apiSummary }: { apiSummary?: GamificationSummary }) => {
  if (!apiSummary) { return <LoadingSkeleton />; }
  const streakCount = apiSummary.current_streak_weeks;
  const longestStreak = apiSummary.longest_streak_weeks;
  const weeks = mapApiRecentWeeks(apiSummary);
  const subLine = longestStreak > streakCount
    ? `weeks in a row · your best is ${longestStreak} weeks`
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
      <StreakThisWeek apiSummary={apiSummary} />
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
  progress, art, earned, hasThirty, thirtyOpen,
}: {
  progress: number; art: string; earned: boolean;
  hasThirty?: boolean; thirtyOpen?: boolean;
}) => {
  const size = 88;
  const strokeWidth = 3;
  const c = size / 2;
  const r = c - strokeWidth / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(1, progress));

  return (
    <div className="lp-badge-grid-ring" style={{ width: size, height: size }}>
      <svg className="lp-badge-grid-ring__svg" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={c} cy={c} r={r} stroke="var(--u-border-opaque)" strokeWidth={strokeWidth} fill="none" />
        {progress > 0 && (
          <circle
            cx={c}
            cy={c}
            r={r}
            stroke="var(--u-background-accent)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${c} ${c})`}
          />
        )}
      </svg>
      <div className="lp-badge-grid-ring__inner">
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
          aria-label={thirtyOpen ? '30-day check earned' : '30-day check locked'}
        >
          <img
            src={thirtyOpen ? iconTrophyEarned : iconTrophyLocked}
            width="16"
            height="16"
            alt=""
            aria-hidden="true"
          />
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

// ── Course badge grid item with real progress ─────────────

const CourseGridBadgeItem = ({
  course, idx, award, isNew, onClick,
}: {
  course: LearnCourse; idx: number; award?: BadgeEntry; isNew?: boolean; onClick: () => void;
}) => {
  const artMeta = COURSE_ARTS[idx % COURSE_ARTS.length];
  const earned = Boolean(award?.awarded);
  const progress = earned ? 1 : course.progress;
  const artSrc = award?.badge?.image_url ?? artMeta.art;

  const totalLessons = course.lessonCount;

  let sub: string;
  if (earned && award?.awarded_at) {
    sub = new Date(award.awarded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } else if (totalLessons > 0) {
    sub = `${totalLessons} ${totalLessons === 1 ? 'lesson' : 'lessons'}`;
  } else {
    sub = '';
  }

  return (
    <BadgeGridItem
      title={course.title}
      sub={sub}
      isNew={isNew}
      onClick={onClick}
      ring={(
        <GridSealRing
          progress={progress}
          art={artSrc}
          earned={earned}
        />
      )}
    />
  );
};

// ── Main BadgesTab ────────────────────────────────────────

interface BadgesTabProps {
  curriculums?: LearnerCurriculum[];
  courses: LearnCourse[];
  isCoursesLoading?: boolean;
  badgesData?: ReturnType<typeof useBadges>['data'];
  badgesError?: boolean;
}

const BadgesTab = ({
  curriculums, courses, isCoursesLoading, badgesData, badgesError,
}: BadgesTabProps) => {
  const [sheet, setSheet] = useState<SheetBadgeData | null>(null);
  const handleSheetClose = useCallback(() => setSheet(null), []);

  // Memoized — rebuilt only when badgesData or courses change, not on sheet open/close.
  // Immutable construction avoids the forEach+set mutation pattern.
  const courseAwardMap = useMemo(
    () => new Map(
      (badgesData?.course_badges ?? [])
        .filter((a): a is BadgeEntry & { source: { type: 'course'; course_id: string; display_name: string | null } } => a.source.type === 'course')
        .map((a) => [a.source.course_id, a] as const),
    ),
    [badgesData],
  );
  const badgedCourses = useMemo(
    () => courses.filter((c) => courseAwardMap.has(c.courseId)),
    [courses, courseAwardMap],
  );

  if (badgesError) {
    return (
      <ErrorView
        title="Could not load badges"
        message="We could not retrieve your badge data. Please try again."
      />
    );
  }
  const earnedAwards: BadgeEntry[] = [
    ...(badgesData?.curriculum_badges.filter((b) => b.awarded) ?? []),
    ...(badgesData?.course_badges.filter((b) => b.awarded) ?? []),
  ];
  const totalBadges = earnedAwards.length;

  const handlePathClick = (curriculum: LearnerCurriculum) => {
    setSheet({ kind: 'path', curriculum });
  };

  const handleCourseClick = (course: LearnCourse, idx: number) => {
    const award = courseAwardMap.get(course.courseId);
    const artMeta = COURSE_ARTS[idx % COURSE_ARTS.length];
    const earned = Boolean(award?.awarded);
    const badgeImageUrl = award?.badge?.image_url;
    setSheet({
      kind: 'course',
      courseId: course.courseId,
      title: award?.badge.title ?? course.title,
      description: award?.badge?.description ?? '',
      art: badgeImageUrl ?? artMeta.art,
      progress: 'In progress',
      earned,
      earnedDate: award?.awarded_at
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
              let sub: string;
              if (!isComplete) {
                sub = `${c.courses_finished}/${c.courses_total} courses`;
              } else if (thirtyOpen && !thirtyEarned) {
                sub = '30-day check open';
              } else {
                sub = new Date(complete!.reached_at!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
              }

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
                      earned={isComplete}
                      hasThirty
                      thirtyOpen={thirtyEarned}
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
      {badgedCourses.length > 0 && (
        <>
          <h2 className="lp-section-heading lp-section-heading--badges lp-section-heading--with-divider">Courses</h2>
          <div className="lp-badge-grid">
            {badgedCourses.map((course, idx) => {
              const award = courseAwardMap.get(course.courseId);
              const isNew = award?.awarded && !award.seen;
              return (
                <CourseGridBadgeItem
                  key={course.courseId}
                  course={course}
                  idx={idx}
                  award={award}
                  isNew={Boolean(isNew)}
                  onClick={() => handleCourseClick(course, idx)}
                />
              );
            })}
          </div>
        </>
      )}

      <BadgeDetailSheet data={sheet} onClose={handleSheetClose} />
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

const LeaderboardRowSkeleton = () => (
  <div className="lp-leaderboard-row--hifi" aria-hidden="true">
    <div className="skel-bone skel-bone--w24" />
    <div className="lp-leaderboard-avatar">
      <span className="lp-leaderboard-avatar__icon"><PersonIcon /></span>
    </div>
    <div className="skel-bone skel-bone--flex" />
    <div className="skel-bone skel-bone--w32" />
  </div>
);

interface LeaderboardTabProps {
  apiData?: LeaderboardData;
  isLoading?: boolean;
  isError?: boolean;
}

const LeaderboardTab = ({
  apiData, isLoading = false, isError = false,
}: LeaderboardTabProps) => {
  if (isError) {
    return (
      <ErrorView
        title="Leaderboard unavailable"
        message="We could not load the leaderboard. Please try again."
      />
    );
  }

  const isRanked = apiData?.status === 'ranked';
  const myRank = apiData?.my_rank ?? null;
  const totalDrivers = apiData?.total_drivers ?? 0;

  const allRows = [...(apiData?.rows ?? [])].sort((a, b) => a.rank - b.rank);
  const top10 = allRows.filter((r) => r.rank <= 10);
  const myRow = allRows.find((r) => r.is_me) ?? null;
  const displayRows = myRank && myRank > 10 && myRow
    ? [...top10, myRow]
    : top10;

  const heroLabel = 'Your rank this month';
  let heroValue: string;
  if (isLoading) { heroValue = '—'; } else if (isRanked && myRank) { heroValue = toOrdinal(myRank); } else { heroValue = 'Not yet'; }

  let heroSub: string;
  if (isLoading) { heroSub = '—'; } else if (isRanked && myRank) {
    heroSub = `of ${totalDrivers} drivers · ${getResetsText(apiData?.resets_on)}`;
  } else { heroSub = 'Earn points this month to join'; }

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
        {isLoading ? (
          <>
            <LeaderboardRowSkeleton />
            <LeaderboardRowSkeleton />
            <LeaderboardRowSkeleton />
          </>
        ) : displayRows.map((row) => (
          <React.Fragment key={row.rank}>
            <div className={`lp-leaderboard-row--hifi${row.is_me ? ' lp-leaderboard-row--you' : ''}`}>
              <span className="lp-leaderboard-row__rank--hifi">{row.rank}</span>
              <div className={`lp-leaderboard-avatar${row.is_me ? ' lp-leaderboard-avatar--me' : ''}`}>
                <span className="lp-leaderboard-avatar__icon"><PersonIcon /></span>
              </div>
              <span className="lp-leaderboard-row__name--hifi">{row.is_me ? 'You' : (row.display_name ?? '')}</span>
              <span className="lp-leaderboard-row__points--hifi">{row.points}</span>
            </div>
          </React.Fragment>
        ))}
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
  const handleCloseInfoSheet = useCallback(() => setInfoSheet(null), []);
  const tabListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = tabListRef.current;
    if (!el) { return undefined; }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') { return; }
      const tabs = Array.from(el.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
      const idx = tabs.findIndex((t) => t === document.activeElement);
      if (idx < 0) { return; }
      e.preventDefault();
      const next = tabs[(idx + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      next.focus();
      next.click();
    };
    el.addEventListener('keydown', handleKeyDown);
    return () => el.removeEventListener('keydown', handleKeyDown);
  }, []);

  const { data: courses, isLoading: isCoursesLoading } = useLearnCourses();
  const { data: badgesData, isError: badgesError, refetch: refetchBadges } = useBadges();

  const { data: lastActivity } = useQuery({
    queryKey: qk.lastActivity(),
    queryFn: getLastActivity,
    staleTime: 60_000,
  });

  const {
    data: gamification, isError: gamificationError, isLoading: gamificationLoading,
  } = useGamification();
  const queryClient = useQueryClient();

  const {
    data: leaderboardData, isLoading: leaderboardLoading, isError: leaderboardError, refetch: refetchLeaderboard,
  } = useLeaderboard(100, 10);
  const { data: curriculums } = useCurriculums();

  const enrolledCourses = courses ?? [];
  const firstCourseId = enrolledCourses[0]?.courseId;
  const totalPoints = gamification?.lifetime_points ?? 0;
  const monthPoints = gamification?.month_points;

  const coursePointsByKey = Object.fromEntries(
    (gamification?.courses ?? []).map((c) => [c.course_key, c.points]),
  );

  const handleContinue = () => {
    const lastCourseId = lastActivity?.course?.course_id;
    if (lastCourseId) {
      navigate(`/course/${lastCourseId}`);
    } else if (firstCourseId) {
      navigate(`/course/${firstCourseId}`);
    } else {
      navigate('/');
    }
  };

  const handleClose = () => { navigate('/'); };

  const isActiveTabError = (
    (activeTab === 'Points' || activeTab === 'Streak') && gamificationError
  ) || (activeTab === 'Leaderboard' && leaderboardError)
    || (activeTab === 'Badges' && badgesError);

  const handleFooterRetry = () => {
    if (activeTab === 'Points' || activeTab === 'Streak') {
      queryClient.invalidateQueries({ queryKey: qk.gamification() });
    } else if (activeTab === 'Leaderboard') {
      refetchLeaderboard();
    } else if (activeTab === 'Badges') {
      refetchBadges();
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
          onClick={handleClose}
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
      <div className="lp-tabs" role="tablist" aria-label="Progress tabs" ref={tabListRef}>
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`tab-${tab}`}
            aria-selected={activeTab === tab}
            aria-controls={`panel-${tab}`}
            tabIndex={activeTab === tab ? 0 : -1}
            className={`lp-tab${activeTab === tab ? ' lp-tab--active' : ''}`}
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
          <div role="tabpanel" id="panel-Points" aria-labelledby="tab-Points" tabIndex={0}>
            {gamificationError ? (
              <ErrorView
                title="Could not load points"
                message="We could not load your progress data. Please try again."
              />
            ) : (
              <PointsTab
                courses={enrolledCourses}
                totalPoints={totalPoints}
                monthPoints={monthPoints}
                coursePointsByKey={coursePointsByKey}
                isLoading={gamificationLoading}
              />
            )}
          </div>
        )}
        {activeTab === 'Streak' && (
          <div role="tabpanel" id="panel-Streak" aria-labelledby="tab-Streak" tabIndex={0}>
            {gamificationError ? (
              <ErrorView
                title="Could not load streak"
                message="We could not load your streak data. Please try again."
              />
            ) : (
              <StreakTab apiSummary={gamification} />
            )}
          </div>
        )}
        {activeTab === 'Badges' && (
          <div role="tabpanel" id="panel-Badges" aria-labelledby="tab-Badges" tabIndex={0}>
            <BadgesTab
            curriculums={curriculums}
            courses={enrolledCourses}
            isCoursesLoading={isCoursesLoading}
            badgesData={badgesData}
            badgesError={badgesError}
          />
          </div>
        )}
        {activeTab === 'Leaderboard' && (
          <div role="tabpanel" id="panel-Leaderboard" aria-labelledby="tab-Leaderboard" tabIndex={0}>
            <LeaderboardTab
              apiData={leaderboardData}
              isLoading={leaderboardLoading}
              isError={leaderboardError}
            />
          </div>
        )}
      </div>

      {/* Sticky footer — Try again on error, Continue learning otherwise */}
      {(isActiveTabError || enrolledCourses.length > 0) && (
        <footer className="lp-footer">
          {isActiveTabError ? (
            <button type="button" className="btn-primary" onClick={handleFooterRetry}>
              Try again
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={handleContinue}>
              Continue learning
            </button>
          )}
        </footer>
      )}

      <InfoSheet data={infoSheet} onClose={handleCloseInfoSheet} />
    </div>
  );
};
