import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getAuthenticatedUser } from '@edx/frontend-platform/auth';
import { getEnrolledCourses, type EnrolledCourse } from '../api/catalog';
import { useCourseOutline } from '../hooks/useCourseOutline';
import { mapOutlineToLessons } from '../lib/outline-mapper';
import { getStoredResumeIdx } from '../lib/resume-storage';
import { getResumeBlock } from '../api/courseware';
import { useSequence } from '../hooks/useSequence';
import { qk } from '../api/queries';
import { useGamification } from '../hooks/useGamification';
import { useCurriculums } from '../hooks/useCurriculums';
import type { GamificationDay, ThisWeekStatus, WeekdayKey } from '../api/gamification';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorView } from '../components/ui/ErrorView';
import { GoalRing } from '../components/ui/GoalRing';

import uberLogo from '../assets/icons/uber-logo.svg';
import iconLightning from '../assets/icons/icon-lightning.svg';
import iconCalendar from '../assets/icons/icon-calendar.svg';
import iconBadgeCheck from '../assets/icons/icon-badge-check.svg';
import iconCircleCheck from '../assets/icons/icon-circle-check.svg';
import courseArtBlue from '../assets/icons/course-art-blue.svg';
import courseArtTeal from '../assets/icons/course-art-teal.svg';
import courseArtLime from '../assets/icons/course-art-steering.svg';
import courseArtPurple from '../assets/icons/course-art-toolbox.svg';
import sceneSafetyCar from '../assets/scenes/safety-car.png';
import sceneSafetyEducation from '../assets/scenes/scene-safety-education.png';
import iconDismiss from '../assets/icons/icon-dismiss.svg';
import iconChevronRight from '../assets/icons/chevron-right.svg';
import badgeHalfwayEarned from '../assets/badges/badge-halfway-earned.svg';
import badgeCompleteEarned from '../assets/badges/badge-complete-earned.svg';
import badgeRetainedLocked from '../assets/badges/badge-retained-locked.svg';

import './course-catalog.scss';

// ── Helpers ─────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getUserFirstName(): string {
  try {
    const user = getAuthenticatedUser() as { name?: string; username?: string } | null;
    const name = user?.name || user?.username || '';
    return name.split(/[\s_]/)[0] || 'there';
  } catch {
    return 'there';
  }
}

// ── Discovery header ─────────────────────────────────────

interface StatChipProps {
  icon: string;
  value: string;
  onClick: () => void;
  label: string;
}

const StatChip = ({ icon, value, onClick, label }: StatChipProps) => (
  <button type="button" className="stat-chip" onClick={onClick} aria-label={label}>
    <img src={icon} alt="" className="stat-chip__icon" aria-hidden="true" />
    <span className="stat-chip__value">{value}</span>
  </button>
);

// ── Day tracker ──────────────────────────────────────────

type DayState = 'Learned' | 'Today' | 'Missed' | 'Upcoming';

const WEEKDAY_LABEL: Record<WeekdayKey, string> = {
  mon: 'M', tue: 'T', wed: 'W', thu: 'T', fri: 'F', sat: 'S', sun: 'S',
};

function mapApiDays(apiDays: GamificationDay[]): Array<{ label: string; state: DayState }> {
  const todayIdx = apiDays.findIndex((d) => d.is_today);
  return apiDays.map((day, idx) => {
    const label = WEEKDAY_LABEL[day.weekday];
    if (day.learned) { return { label, state: 'Learned' }; }
    if (day.is_today) { return { label, state: 'Today' }; }
    if (todayIdx >= 0 && idx > todayIdx) { return { label, state: 'Upcoming' }; }
    return { label, state: 'Missed' };
  });
}

interface DayProps {
  state: DayState;
  label: string;
}

const Day = ({ state, label }: DayProps) => {
  const isToday = state === 'Today';
  return (
    <div className="week-day">
      <div className={`week-day__dot week-day__dot--${state.toLowerCase()}`}>
        {state === 'Learned' && (
          <img src={iconCircleCheck} alt="" className="week-day__check" aria-hidden="true" />
        )}
      </div>
      <span className={`week-day__label${isToday ? ' week-day__label--active' : ''}`}>
        {label}
      </span>
    </div>
  );
};

// ── Progress bar ─────────────────────────────────────────

interface ProgressBarProps {
  completed: number;
  total: number;
}

const ProgressBar = ({ completed, total }: ProgressBarProps) => {
  const pct = total > 0 ? Math.min((completed / total) * 100, 100) : 0;
  return (
    <div className="progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-bar__fill" style={{ width: `${pct}%` }} />
    </div>
  );
};

// ── Continue card ────────────────────────────────────────

type ContinueVariant = 'lesson' | 'finalCheck' | 'thirtyDayCheck';

interface ContinueCardProps {
  course: EnrolledCourse;
  lessonTitle: string;
  lessonPosition: string;
  courseMeta: string;
  completedLessons: number;
  totalLessons: number;
  hasStarted?: boolean;
  onContinue: () => void;
  variant?: ContinueVariant;
}

const ContinueCard = ({
  lessonTitle,
  lessonPosition,
  courseMeta,
  completedLessons,
  totalLessons,
  hasStarted = false,
  onContinue,
  variant = 'lesson',
}: ContinueCardProps) => {
  const isFinalCheck = variant === 'finalCheck';
  const is30DayCheck = variant === 'thirtyDayCheck';

  const displayKicker = isFinalCheck ? 'Last step' : is30DayCheck ? '30 days on' : lessonPosition;
  const displayTitle = isFinalCheck ? 'Final check' : is30DayCheck ? 'Your 30-day check' : lessonTitle;
  const displayMeta = isFinalCheck
    ? 'Sexual misconduct education · 5 questions · about 3 min'
    : is30DayCheck
    ? '5 questions · about 3 min'
    : courseMeta;
  const buttonLabel = isFinalCheck ? 'Start final check' : is30DayCheck ? 'Start 30-day check' : hasStarted ? 'Continue' : 'Start';
  const showProgress = !is30DayCheck && (isFinalCheck || hasStarted);
  const displayCompleted = isFinalCheck ? totalLessons : completedLessons;

  return (
    <div className="continue-card">
      <div className="continue-card__band">
        <img src={sceneSafetyCar} alt="" className="continue-card__scene" aria-hidden="true" />
      </div>
      <div className="continue-card__body">
        <div className="continue-card__info">
          <span className="continue-card__kicker">{displayKicker}</span>
          <h2 className="continue-card__title">{displayTitle}</h2>
          <span className="continue-card__meta">{displayMeta}</span>
        </div>
        {showProgress && (
          <div className="continue-card__progress">
            <ProgressBar completed={displayCompleted} total={totalLessons} />
            <span className="continue-card__progress-label">
              {displayCompleted} of {totalLessons} lessons complete
            </span>
          </div>
        )}
        <button type="button" className="btn-primary" onClick={onContinue}>
          {buttonLabel}
        </button>
      </div>
    </div>
  );
};

// ── Required course tile ─────────────────────────────────

interface CourseTileProps {
  course: EnrolledCourse;
  tintClass: string;
  artSrc: string;
  completedLessons: number;
  totalLessons: number;
  isComplete?: boolean;
  category?: string;
  onClick: () => void;
}

const CourseTile = ({
  course,
  tintClass,
  artSrc,
  completedLessons,
  totalLessons,
  isComplete = false,
  category = 'Safety',
  onClick,
}: CourseTileProps) => {
  const statusLabel = isComplete
    ? 'Complete'
    : totalLessons > 0
    ? `${completedLessons} of ${totalLessons} lessons`
    : `${totalLessons} lessons`;
  const showProgress = !isComplete && completedLessons > 0 && totalLessons > 0;

  return (
    <button type="button" className="course-tile" onClick={onClick}>
      <div className={`course-tile__band ${tintClass}`}>
        <img src={artSrc} alt="" className="course-tile__art" aria-hidden="true" />
      </div>
      <div className="course-tile__body">
        <div className="course-tile__info">
          <span className="course-tile__category">{category}</span>
          <span className="course-tile__title">{course.title}</span>
        </div>
        <div className="course-tile__footer">
          {showProgress && (
            <ProgressBar completed={completedLessons} total={totalLessons} />
          )}
          <span className={`course-tile__status${isComplete ? ' course-tile__status--positive' : ''}`}>
            {statusLabel}
          </span>
        </div>
      </div>
    </button>
  );
};

// ── Connected course tile (fetches its own outline) ───────

const COURSE_TINTS = [
  { tintClass: 'course-tile__band--blue', artSrc: courseArtBlue },
  { tintClass: 'course-tile__band--teal', artSrc: courseArtTeal },
];

interface ConnectedCourseTileProps {
  course: EnrolledCourse;
  index: number;
  onClick: () => void;
}

const ConnectedCourseTile = ({ course, index, onClick }: ConnectedCourseTileProps) => {
  const outlineQuery = useCourseOutline(course.courseId);

  const allLessons = outlineQuery.data ? mapOutlineToLessons(outlineQuery.data) : [];
  const totalLessons = allLessons.length;
  const storedIdx = allLessons.length > 0 ? getStoredResumeIdx(course.courseId, allLessons) : -1;
  const completedLessons = storedIdx > 0 ? storedIdx : 0;
  const isComplete = false;

  const tint = COURSE_TINTS[index % COURSE_TINTS.length];

  return (
    <CourseTile
      course={course}
      tintClass={tint.tintClass}
      artSrc={tint.artSrc}
      completedLessons={completedLessons}
      totalLessons={totalLessons}
      isComplete={isComplete}
      onClick={onClick}
    />
  );
};

// ── Connected continue card (picks first in-progress course) ─

interface ConnectedContinueCardProps {
  courses: EnrolledCourse[];
  onContinue: (courseId: string) => void;
  variant?: ContinueVariant;
}

const ConnectedContinueCard = ({ courses, onContinue, variant = 'lesson' }: ConnectedContinueCardProps) => {
  const firstCourse = courses[0];
  const courseId = firstCourse?.courseId ?? '';

  const outlineQuery = useCourseOutline(courseId);
  const resumeQuery = useQuery({
    queryKey: qk.resume(courseId),
    queryFn: () => getResumeBlock(courseId),
    enabled: Boolean(courseId),
    staleTime: 0,
  });

  const allLessons = outlineQuery.data ? mapOutlineToLessons(outlineQuery.data) : [];
  const totalLessons = allLessons.length;

  // Take the highest resume index from localStorage and the backend API.
  const storedIdx = allLessons.length > 0 ? getStoredResumeIdx(courseId, allLessons) : -1;
  const apiSequenceId = resumeQuery.data?.sectionId ?? null;
  const apiIdx = apiSequenceId ? allLessons.findIndex((l) => l.sequenceId === apiSequenceId) : -1;
  const resumeIdx = Math.max(storedIdx, apiIdx);

  // completedLessons is the count of fully-finished lessons (resume index > 0 means
  // we stored the NEXT lesson after completion, so resumeIdx = number of completed lessons).
  // "hasStarted" drives "Continue" vs "Start" — only true once at least 1 lesson is done.
  const completedLessons = resumeIdx > 0 ? resumeIdx : 0;
  const hasStarted = completedLessons > 0;
  // Navigate to the stored resume position regardless (even if that's lesson 1 index 0).
  const resumeLesson = allLessons[resumeIdx >= 0 ? resumeIdx : 0];

  // Fetch unit count for the resume lesson to show "N steps" in the subtitle.
  const { units: resumeUnits } = useSequence(resumeLesson?.sequenceId ?? '');
  const stepCount = resumeUnits.length;

  const lessonTitle = resumeLesson?.lessonTitle ?? firstCourse?.title ?? 'Start learning';
  const lessonPosition = totalLessons > 0
    ? `Lesson ${hasStarted ? resumeIdx + 1 : 1} of ${totalLessons}`
    : 'Start course';
  const courseMeta = firstCourse
    ? `${firstCourse.title}${stepCount > 0 ? ` · ${stepCount} step${stepCount !== 1 ? 's' : ''}` : ` · ${totalLessons} lessons`}`
    : '';

  if (!firstCourse) return null;

  return (
    <ContinueCard
      course={firstCourse}
      lessonTitle={lessonTitle}
      lessonPosition={lessonPosition}
      courseMeta={courseMeta}
      completedLessons={completedLessons}
      totalLessons={totalLessons}
      hasStarted={hasStarted}
      onContinue={() => onContinue(firstCourse.courseId)}
      variant={variant}
    />
  );
};

// ── This week card ───────────────────────────────────────

type WeekState = 'zero' | 'one' | 'two' | 'paused';

interface WeekStateConfig {
  completed: number;
  heading: string;
  desc: string;
  days: Array<{ label: string; state: DayState }>;
}

const THIS_WEEK_CONFIGS: Record<WeekState, WeekStateConfig> = {
  zero: {
    completed: 0,
    heading: 'Two days to go',
    desc: 'Learn on 2 days this week to start a week streak.',
    days: [
      { label: 'M', state: 'Missed' },
      { label: 'T', state: 'Missed' },
      { label: 'W', state: 'Today' },
      { label: 'T', state: 'Upcoming' },
      { label: 'F', state: 'Upcoming' },
      { label: 'S', state: 'Upcoming' },
      { label: 'S', state: 'Upcoming' },
    ],
  },
  one: {
    completed: 1,
    heading: 'One more day to go',
    desc: 'Learn on one more day this week to keep your 2-week streak.',
    days: [
      { label: 'M', state: 'Learned' },
      { label: 'T', state: 'Missed' },
      { label: 'W', state: 'Today' },
      { label: 'T', state: 'Upcoming' },
      { label: 'F', state: 'Upcoming' },
      { label: 'S', state: 'Upcoming' },
      { label: 'S', state: 'Upcoming' },
    ],
  },
  two: {
    completed: 2,
    heading: 'Goal met this week',
    desc: 'Your streak grows to 3 weeks when the week ends.',
    days: [
      { label: 'M', state: 'Learned' },
      { label: 'T', state: 'Learned' },
      { label: 'W', state: 'Today' },
      { label: 'T', state: 'Upcoming' },
      { label: 'F', state: 'Upcoming' },
      { label: 'S', state: 'Upcoming' },
      { label: 'S', state: 'Upcoming' },
    ],
  },
  paused: {
    completed: 1,
    heading: 'Streak paused',
    desc: 'Nothing required is left, so your streak is safe. Optional courses still count.',
    days: [
      { label: 'M', state: 'Learned' },
      { label: 'T', state: 'Missed' },
      { label: 'W', state: 'Today' },
      { label: 'T', state: 'Upcoming' },
      { label: 'F', state: 'Upcoming' },
      { label: 'S', state: 'Upcoming' },
      { label: 'S', state: 'Upcoming' },
    ],
  },
};

interface ThisWeekCardProps {
  weekState: WeekState;
  apiWeek?: import('../api/gamification').GamificationThisWeek;
  currentStreak?: number;
}

const ThisWeekCard = ({ weekState, apiWeek, currentStreak = 0 }: ThisWeekCardProps) => {
  const days = apiWeek ? mapApiDays(apiWeek.days) : THIS_WEEK_CONFIGS[weekState].days;
  const daysCompleted = apiWeek ? apiWeek.learning_days : THIS_WEEK_CONFIGS[weekState].completed;
  const goal = apiWeek ? apiWeek.goal : 2;

  let heading: string;
  let desc: string;

  if (apiWeek) {
    if (apiWeek.status === 'paused') {
      heading = 'Streak paused';
      desc = 'Nothing required is left, so your streak is safe. Optional courses still count.';
    } else if (apiWeek.status === 'goal_met') {
      heading = 'Goal met this week';
      const projected = apiWeek.projected_streak_weeks;
      desc = projected > currentStreak
        ? `Your streak grows to ${projected} weeks when the week ends.`
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
    const cfg = THIS_WEEK_CONFIGS[weekState];
    heading = cfg.heading;
    desc = cfg.desc;
  }

  return (
    <div className="this-week-card">
      <div className="this-week-card__goal">
        <GoalRing daysCompleted={daysCompleted} daysGoal={goal} />
        <div className="this-week-card__words">
          <span className="this-week-card__heading">{heading}</span>
          <span className="this-week-card__desc">{desc}</span>
        </div>
      </div>
      <div className="this-week-card__days">
        {days.map((day, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <Day key={i} state={day.state} label={day.label} />
        ))}
      </div>
    </div>
  );
};

// ── Notice card ──────────────────────────────────────────

type NoticeVariant = 'newCurriculum' | 'caughtUp';

interface NoticeCardProps {
  variant?: NoticeVariant;
  onDismiss?: () => void;
}

const NoticeCard = ({ variant = 'newCurriculum', onDismiss }: NoticeCardProps) => {
  const isCaughtUp = variant === 'caughtUp';
  return (
    <div className={`notice-card${isCaughtUp ? ' notice-card--caught-up' : ''}`}>
      <div className="notice-card__band">
        <img src={sceneSafetyEducation} alt="" className="notice-card__scene" aria-hidden="true" />
        {!isCaughtUp && onDismiss && (
          <button
            type="button"
            className="notice-card__dismiss"
            aria-label="Dismiss notice"
            onClick={onDismiss}
          >
            <img src={iconDismiss} alt="" className="notice-card__dismiss-icon" aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="notice-card__body">
        {isCaughtUp ? (
          <>
            <p className="notice-card__title">You&#39;re all caught up</p>
            <p className="notice-card__desc">
              Every required course is done, and your 30-day check is open.
            </p>
            <div className="notice-card__badges">
              <img src={badgeHalfwayEarned} alt="Halfway badge" className="notice-card__badge-icon" />
              <img src={badgeCompleteEarned} alt="Complete badge" className="notice-card__badge-icon" />
              <img src={badgeRetainedLocked} alt="Retained badge (locked)" className="notice-card__badge-icon" />
            </div>
          </>
        ) : (
          <>
            <p className="notice-card__title">New required courses</p>
            <p className="notice-card__desc">
              Find them under Required. Your points, streak and earlier badges stay.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

// ── Learning path card ───────────────────────────────────

interface LearningPathCardProps {
  curriculum: import('../api/curriculum').LearnerCurriculum;
  onClick: () => void;
}

const LearningPathCard = ({ curriculum, onClick }: LearningPathCardProps) => {
  const nextCourse = curriculum.courses
    .slice()
    .sort((a, b) => a.position - b.position)
    .find((c) => !c.finished);

  return (
    <button type="button" className="path-card" onClick={onClick} aria-label={`View ${curriculum.title}`}>
      <div className="path-card__seal">
        <svg className="path-card__ring" viewBox="0 0 56 56" fill="none" aria-hidden="true">
          <circle cx="28" cy="28" r="24" stroke="var(--u-border-opaque)" strokeWidth="3" />
          {curriculum.courses_total > 0 && (
            <circle
              cx="28" cy="28" r="24"
              stroke="var(--u-content-accent)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 24}`}
              strokeDashoffset={`${2 * Math.PI * 24 * (1 - curriculum.courses_finished / curriculum.courses_total)}`}
              transform="rotate(-90 28 28)"
            />
          )}
        </svg>
        <div className="path-card__seal-inner">
          <img src={iconBadgeCheck} alt="" className="path-card__seal-icon" aria-hidden="true" />
        </div>
      </div>
      <div className="path-card__body">
        <span className="path-card__title">{curriculum.title}</span>
        <div className="path-card__meta">
          <span className="path-card__progress">
            {curriculum.courses_finished} of {curriculum.courses_total} courses done
          </span>
          {nextCourse && (
            <span className="path-card__next">Next: {nextCourse.display_name ?? nextCourse.course_id}</span>
          )}
        </div>
      </div>
      <img src={iconChevronRight} alt="" className="path-card__chevron" aria-hidden="true" />
    </button>
  );
};

// ── All courses card ─────────────────────────────────────

const AllCoursesCard = ({
  onClick, count, isEmpty,
}: { onClick: () => void; count: number; isEmpty: boolean }) => (
  <button type="button" className="all-courses-card" onClick={onClick} aria-label="See all courses">
    <div className="all-courses-card__content">
      <div className="all-courses-card__heading">
        <span className="all-courses-card__title">Explore courses</span>
        <span className="all-courses-card__desc">
          {isEmpty
            ? 'Courses on safety, driving and more.'
            : `${count === 1 ? '1 course' : `${count} courses`} available to you, any time.`}
        </span>
      </div>
      <span className="all-courses-card__cta">See all courses</span>
    </div>
    <div className="all-courses-card__artwork" aria-hidden="true">
      <div className="all-courses-card__tile all-courses-card__tile--1 course-tile__band--blue">
        <img src={courseArtBlue} alt="" className="all-courses-card__tile-art" />
      </div>
      <div className="all-courses-card__tile all-courses-card__tile--2 course-tile__band--lime">
        <img src={courseArtLime} alt="" className="all-courses-card__tile-art" />
      </div>
      <div className="all-courses-card__tile all-courses-card__tile--3 course-tile__band--purple">
        <img src={courseArtPurple} alt="" className="all-courses-card__tile-art" />
      </div>
    </div>
  </button>
);

// ── Main page ────────────────────────────────────────────

const NOTICE_DISMISSED_KEY = 'uber-learn:notice-new-curriculum-dismissed';

export const CourseCatalog = () => {
  const navigate = useNavigate();

  const [noticeVisible, setNoticeVisible] = useState(() => {
    try {
      return localStorage.getItem(NOTICE_DISMISSED_KEY) !== 'true';
    } catch {
      return false;
    }
  });

  const handleDismissNotice = () => {
    try { localStorage.setItem(NOTICE_DISMISSED_KEY, 'true'); } catch { /* ignore */ }
    setNoticeVisible(false);
  };

  const { data: courses, isLoading, isError, refetch } = useQuery({
    queryKey: ['enrolled-courses'],
    queryFn: getEnrolledCourses,
    staleTime: 5 * 60_000,
  });

  const { data: gamification } = useGamification();
  const { data: curriculums } = useCurriculums();

  const greeting = `${getGreeting()}.`;
  const enrolledCourses = courses ?? [];
  const completedCount = 0; // TODO: sum from progress API
  const allCoursesComplete = enrolledCourses.length > 0 && completedCount >= enrolledCourses.length;

  // Stat chip values from gamification API (fall back to 0 while loading)
  const pointsValue = String(gamification?.lifetime_points ?? 0);
  const streakValue = String(gamification?.current_streak_weeks ?? 0);

  // Badge count: earned milestones from first curriculum
  const curriculum = curriculums?.[0];
  const badgesEarned = curriculum
    ? (['halfway', 'complete', 'retained'] as const).filter(
        (s) => curriculum.milestones[s]?.reached_at != null,
      ).length
    : 0;
  const badgesTotal = curriculum ? 3 : 3;
  const badgesValue = `${badgesEarned}/${badgesTotal}`;

  // This-week card state: derive from API when available, otherwise fall back to static
  const apiThisWeek = gamification?.this_week;
  const weekState: WeekState = (() => {
    if (apiThisWeek) {
      if (apiThisWeek.status === 'paused') { return 'paused'; }
      if (apiThisWeek.status === 'goal_met') { return 'two'; }
      return apiThisWeek.learning_days >= 1 ? 'one' : 'zero';
    }
    return allCoursesComplete ? 'paused' : 'zero';
  })();

  const continueVariant: ContinueVariant = allCoursesComplete ? 'thirtyDayCheck' : 'lesson';
  const noticeVariant: NoticeVariant = allCoursesComplete ? 'caughtUp' : 'newCurriculum';

  return (
    <div className="home-page">
      {/* Discovery header */}
      <header className="home-header">
        <img src={uberLogo} alt="Uber" className="home-header__logo" />
        <nav className="home-header__stats" aria-label="Learning stats">
          <StatChip
            icon={iconLightning}
            value={pointsValue}
            label={`${pointsValue} points — view points`}
            onClick={() => navigate('/progress', { state: { tab: 'Points' } })}
          />
          <StatChip
            icon={iconCalendar}
            value={streakValue}
            label={`${streakValue}-week streak — view streak`}
            onClick={() => navigate('/progress', { state: { tab: 'Streak' } })}
          />
          <StatChip
            icon={iconBadgeCheck}
            value={badgesValue}
            label={`${badgesEarned} of ${badgesTotal} badges — view badges`}
            onClick={() => navigate('/progress', { state: { tab: 'Badges' } })}
          />
        </nav>
      </header>

      {/* Scrollable content */}
      <main className="home-content">
        <h1 className="home-greeting">{greeting}</h1>

        {isLoading && <LoadingSkeleton lines={4} />}

        {isError && (
          <ErrorView
            title="Could not load courses"
            message="We could not retrieve your enrolled courses. Please try again."
            onRetry={() => refetch()}
          />
        )}

        {/* Empty state — no enrolled courses: hero Explore card before This week */}
        {!isLoading && !isError && enrolledCourses.length === 0 && (
          <AllCoursesCard onClick={() => navigate('/library')} count={0} isEmpty />
        )}

        {/* Continue card — shown when there are enrolled courses */}
        {!isLoading && !isError && enrolledCourses.length > 0 && (
          <ConnectedContinueCard
            courses={enrolledCourses}
            onContinue={(courseId) => navigate(`/course/${courseId}`)}
            variant={continueVariant}
          />
        )}

        {/* This week */}
        <div className="home-section-header home-section-header--padded">
          <h2 className="home-section-header__title">This week</h2>
        </div>
        <ThisWeekCard
          weekState={weekState}
          apiWeek={apiThisWeek}
          currentStreak={gamification?.current_streak_weeks}
        />

        {/* Your learning paths */}
        {curriculums && curriculums.length > 0 && (
          <>
            <div className="home-section-header home-section-header--padded">
              <h2 className="home-section-header__title">Your learning paths</h2>
              <button
                type="button"
                className="home-section-header__see-all"
                onClick={() => navigate('/learning-paths')}
              >
                See all
              </button>
            </div>
            <div className="path-list">
              {curriculums.slice(0, 3).map((c) => (
                <LearningPathCard
                  key={c.uuid}
                  curriculum={c}
                  onClick={() => navigate(`/learning-path/${c.uuid}`)}
                />
              ))}
            </div>
          </>
        )}

        {/* All courses card — only shown when there are enrolled courses */}
        {enrolledCourses.length > 0 && (
          <AllCoursesCard
            onClick={() => navigate('/library')}
            count={enrolledCourses.length}
            isEmpty={false}
          />
        )}
      </main>
    </div>
  );
};
