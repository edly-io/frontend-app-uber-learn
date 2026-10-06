import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getEnrolledCourses, type EnrolledCourse } from '../api/catalog';
import { useProgress } from '../hooks/useProgress';
import { useCourseOutline } from '../hooks/useCourseOutline';
import { mapOutlineToLessons } from '../lib/outline-mapper';
import { getStoredResumeIdx } from '../lib/resume-storage';

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
}

const PointsCourseRow = ({ course, artSrc, tintClass }: CourseRowProps) => {
  const outlineQuery = useCourseOutline(course.courseId);
  const { data: progressData } = useProgress(course.courseId);
  const allLessons = outlineQuery.data ? mapOutlineToLessons(outlineQuery.data) : [];
  const totalLessons = allLessons.length;
  const storedIdx = totalLessons > 0 ? getStoredResumeIdx(course.courseId, allLessons) : -1;
  const completedLessons = storedIdx > 0 ? storedIdx : 0;
  const pointsEarned = progressData?.points?.earned ?? 0;

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
  onContinue: () => void;
}

const PointsTab = ({ courses, totalPoints, onContinue }: PointsTabProps) => (
  <div className="lp-tab-content">
    {/* Hero card */}
    <div className="lp-points-hero">
      <div className="lp-points-hero__figure">
        <span className="lp-points-hero__label">Total points</span>
        <span className="lp-points-hero__value">{totalPoints}</span>
        <span className="lp-points-hero__sub">{totalPoints} this month</span>
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
  streakState: StreakState;
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

const StreakThisWeek = ({ streakState }: StreakThisWeekProps) => {
  const cfg = STREAK_THIS_WEEK_CONFIG[streakState];
  const days = STREAK_THIS_WEEK_DAYS[streakState];
  const showProgress = cfg.completed > 0;

  return (
    <div className="lp-streak-this-week">
      <div className="lp-streak-this-week__goal">
        <div className="lp-streak-this-week__ring" aria-label={`${cfg.completed} of 2 days done`}>
          <img src={ringTrack} alt="" className="lp-streak-this-week__ring-track" aria-hidden="true" />
          {showProgress && (
            <img src={ringProgress} alt="" className="lp-streak-this-week__ring-progress" aria-hidden="true" />
          )}
          <span className="lp-streak-this-week__ring-label">{cfg.completed}/2</span>
        </div>
        <div className="lp-streak-this-week__words">
          <span className="lp-streak-this-week__heading">{cfg.heading}</span>
          <span className="lp-streak-this-week__desc">{cfg.desc}</span>
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
  onContinue: () => void;
}

const StreakTab = ({ streakState = 'none', onContinue }: StreakTabProps) => {
  const weeks = streakState === 'reset' ? STREAK_RESET_WEEKS : STREAK_NONE_WEEKS;
  const streakCount = streakState === 'reset' ? 0 : 0;
  const longestStreak = streakState === 'reset' ? 4 : 0;
  const subLine = streakState === 'reset'
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
      <StreakThisWeek streakState={streakState} />

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
  onContinue: () => void;
  onThirtyDayCheck?: () => void;
}

const BadgesTab = ({ badgesState = 'default', onContinue, onThirtyDayCheck }: BadgesTabProps) => {
  const earnedCount = badgesState === 'allEarned' ? 3 : badgesState === 'thirtyDayDue' ? 2 : 1;

  return (
    <div className="lp-tab-content">
      {/* Hi-fi hero */}
      <div className="lp-badges-hifi-hero">
        <div className="lp-badges-hifi-hero__figure">
          <span className="lp-points-hero__label">Badges</span>
          <span className="lp-points-hero__value">{earnedCount} of 3</span>
          <span className="lp-points-hero__sub">for your required courses</span>
        </div>
        <div className="lp-badges-hifi-hero__art">
          <img src={iconBadgeCheck} alt="" className="lp-badges-hifi-hero__icon" aria-hidden="true" />
        </div>
      </div>

      {/* Badge list */}
      <div className="lp-badge-list--hifi">
        <BadgeRowHiFi
          src={badgeHalfwayEarned}
          name="Halfway"
          sub="Earned 26 October 2026"
        />
        <BadgeRowHiFi
          src={badgesState === 'default' ? badgeCompleteLocked : badgeCompleteEarned}
          name="Complete"
          sub={badgesState === 'default' ? 'Finish all lessons to earn this' : 'Earned 2 November 2026'}
        />
        <BadgeRowHiFi
          src={badgesState === 'allEarned' ? badgeRetainedEarned : badgeRetainedLocked}
          name="Retained"
          sub={
            badgesState === 'allEarned'
              ? 'Earned 2 December 2026'
              : badgesState === 'thirtyDayDue'
              ? 'Your 30-day check is open'
              : 'Pass your 30-day check to earn this'
          }
        />
        {badgesState === 'thirtyDayDue' && (
          <div className="lp-badge-cta">
            <button type="button" className="btn-primary" onClick={onThirtyDayCheck ?? onContinue}>
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
  ranked?: boolean;
  onContinue: () => void;
}

const LeaderboardTab = ({ ranked = false, onContinue }: LeaderboardTabProps) => {
  const notRankedRows = [
    { rank: 1, name: 'Driver 4821', points: 45 },
    { rank: 2, name: 'Driver 2210', points: 40 },
    { rank: 3, name: 'Driver 1307', points: 40 },
  ];

  const rankedRows = [
    { rank: 1, name: 'Alex M.', points: 240, isYou: false },
    { rank: 2, name: 'Jordan T.', points: 195, isYou: false },
    { rank: 3, name: 'You', points: 95, isYou: true },
    { rank: 4, name: 'Sam R.', points: 80, isYou: false },
    { rank: 5, name: 'Casey L.', points: 70, isYou: false },
  ];

  return (
    <div className="lp-tab-content">
      {ranked ? (
        <>
          <div className="lp-leaderboard-hero">
            <span className="lp-points-hero__label">Your rank</span>
            <span className="lp-points-hero__value">#3</span>
            <span className="lp-points-hero__sub">Top 30% this month</span>
          </div>
          <h2 className="lp-section-heading">This month</h2>
          <div className="lp-leaderboard-list">
            {rankedRows.map((row) => (
              <div
                key={row.rank}
                className={`lp-leaderboard-row${row.isYou ? ' lp-leaderboard-row--you' : ''}`}
              >
                <span className="lp-leaderboard-row__rank">{row.rank}</span>
                <span className="lp-leaderboard-row__name">{row.name}</span>
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
            {notRankedRows.map((row) => (
              <div key={row.rank} className="lp-leaderboard-row--hifi">
                <span className="lp-leaderboard-row__rank--hifi">{row.rank}</span>
                <div className="lp-leaderboard-avatar">
                  <span className="lp-leaderboard-avatar__icon"><PersonIcon /></span>
                </div>
                <span className="lp-leaderboard-row__name--hifi">{row.name}</span>
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

  const enrolledCourses = courses ?? [];
  const firstCourseId = enrolledCourses[0]?.courseId;
  const { data: progressData } = useProgress(firstCourseId ?? '');
  const totalPoints = progressData?.points?.earned ?? 95;

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
            onContinue={handleContinue}
          />
        )}
        {activeTab === 'Streak' && (
          <StreakTab
            streakState="none"
            onContinue={handleContinue}
          />
        )}
        {activeTab === 'Badges' && (
          <BadgesTab
            badgesState="default"
            onContinue={handleContinue}
          />
        )}
        {activeTab === 'Leaderboard' && (
          <LeaderboardTab
            ranked={false}
            onContinue={handleContinue}
          />
        )}
      </div>
    </div>
  );
};
