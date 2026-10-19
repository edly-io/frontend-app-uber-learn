import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCourseOutline } from '../hooks/useCourseOutline';
import { useLearnCourses, type LearnCourse } from '../hooks/useLearnCourses';
import { mapOutlineToLessons } from '../lib/outline-mapper';
import { useSequence } from '../hooks/useSequence';
import { qk } from '../api/queries';
import { getLastActivity } from '../api/curriculum';
import { selectContinueCourse } from '../lib/selectContinueCourse';
import { useGamification } from '../hooks/useGamification';
import { useCurriculums } from '../hooks/useCurriculums';
import { useBadges } from '../hooks/useBadges';
import { useBadgeCelebration, goToBadgeCelebration } from '../hooks/useBadgeCelebration';
import type { GamificationDay, WeekdayKey } from '../api/gamification';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorView } from '../components/ui/ErrorView';
import { GoalRing } from '../components/ui/GoalRing';

import uberLogo from '../assets/icons/uber-logo.svg';
import iconLightning from '../assets/icons/icon-lightning.svg';
import iconCalendar from '../assets/icons/icon-calendar.svg';
import iconBadgeCheck from '../assets/icons/icon-badge-check.svg';
import iconCircleCheck from '../assets/icons/icon-circle-check.svg';
import courseArtBlue from '../assets/icons/course-art-blue.svg';
import courseArtLime from '../assets/icons/course-art-steering.svg';
import courseArtPurple from '../assets/icons/course-art-toolbox.svg';
import scenePhoto from '../assets/images/scene-safety-education.png';
import iconChevronRight from '../assets/icons/chevron-right.svg';
import iconDismiss from '../assets/icons/icon-dismiss.svg';
import badgeArtTrophyEarned from '../assets/icons/badge-art-trophy-earned.svg';

import './course-catalog.scss';

// ── Helpers ─────────────────────────────────────────────

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) { return 'Good morning'; }
  if (hour < 18) { return 'Good afternoon'; }
  return 'Good evening';
}

// ── Discovery header ─────────────────────────────────────

interface StatChipProps {
  icon: string;
  value: string;
  onClick: () => void;
  label: string;
}

const StatChip = ({
  icon, value, onClick, label,
}: StatChipProps) => (
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
    <div className="progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${Math.round(pct)}% complete`}>
      <div className="progress-bar__fill" style={{ '--progress': String(pct / 100) } as React.CSSProperties} />
    </div>
  );
};

// ── Continue card ────────────────────────────────────────

type ContinueVariant = 'lesson' | 'finalCheck' | 'thirtyDayCheck';

interface ContinueCardProps {
  lessonTitle: string;
  lessonPosition: string;
  courseMeta: string;
  completedLessons: number;
  totalLessons: number;
  hasStarted?: boolean;
  onContinue: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ContinueVariant;
  finalCheckMeta?: string | null;
  imageUrl?: string | null;
}

const ContinueCard = ({
  lessonTitle,
  lessonPosition,
  courseMeta,
  completedLessons,
  totalLessons,
  hasStarted = false,
  onContinue,
  disabled = false,
  loading = false,
  variant = 'lesson',
  finalCheckMeta = null,
  imageUrl = null,
}: ContinueCardProps) => {
  const isFinalCheck = variant === 'finalCheck';
  const is30DayCheck = variant === 'thirtyDayCheck';

  let displayKicker = lessonPosition;
  if (isFinalCheck) { displayKicker = 'Last step'; } else if (is30DayCheck) { displayKicker = '30 days on'; }

  let displayTitle = lessonTitle;
  if (isFinalCheck) { displayTitle = 'Final check'; } else if (is30DayCheck) { displayTitle = 'Your 30-day check'; }

  let displayMeta = courseMeta;
  if (isFinalCheck) { displayMeta = finalCheckMeta ?? ''; } else if (is30DayCheck) { displayMeta = finalCheckMeta ?? ''; }

  let buttonLabel = hasStarted ? 'Continue' : 'Start';
  if (isFinalCheck) { buttonLabel = 'Start final check'; } else if (is30DayCheck) { buttonLabel = 'Start 30-day check'; }
  const showProgress = !is30DayCheck && (isFinalCheck || hasStarted);
  const displayCompleted = isFinalCheck ? totalLessons : completedLessons;

  return (
    <div className="continue-card">
      <div className="continue-card__band">
        <img
          src={imageUrl ?? scenePhoto}
          alt=""
          className="continue-card__scene"
          aria-hidden="true"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = scenePhoto; }}
        />
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
        <button type="button" className="btn-primary" onClick={onContinue} disabled={disabled}>
          {loading ? 'Loading…' : buttonLabel}
        </button>
      </div>
    </div>
  );
};

// ── Required course tile ─────────────────────────────────

// ── Connected continue card (renders the course chosen by selectContinueCourse) ─

interface ConnectedContinueCardProps {
  /** The course to feature. Selection lives in the page (see lib/selectContinueCourse). */
  course: LearnCourse | null;
  onContinue: (courseId: string, sequenceId: string | null, stepIdx: number) => void;
  variant?: ContinueVariant;
  finalCheckMeta?: string | null;
  /** Course card image URL from the curriculum API (CurriculumCourse.image_url). */
  imageUrl?: string | null;
}

const ConnectedContinueCard = ({
  course: firstCourse, onContinue, variant = 'lesson', finalCheckMeta = null, imageUrl = null,
}: ConnectedContinueCardProps) => {
  const courseId = firstCourse?.courseId ?? '';

  const outlineQuery = useCourseOutline(courseId);

  const allLessons = outlineQuery.data ? mapOutlineToLessons(outlineQuery.data) : [];
  const totalLessons = allLessons.length;

  // Use outline complete flags to find the first unfinished lesson — avoids the
  // resume block API call that sent learners back to the last *completed* lesson
  // (off-by-one) and caused a deep-link loop when history was empty.
  const completedLessons = allLessons.filter((l) => l.complete).length;
  const nextLesson = allLessons.find((l) => !l.complete) ?? allLessons[0];

  // Fetch units for the next lesson: used for step count in subtitle and to
  // find the first incomplete unit so Continue resumes at the right step.
  const { units: nextUnits, isLoading: unitsLoading } = useSequence(nextLesson?.sequenceId ?? '');
  const hasStarted = completedLessons > 0 || nextUnits.some((u) => u.complete);
  const stepCount = nextUnits.length;
  const resumeStepIdx = Math.max(0, nextUnits.findIndex((u) => !u.complete));

  const nextLessonIdx = nextLesson ? allLessons.indexOf(nextLesson) : 0;
  const lessonTitle = nextLesson?.lessonTitle ?? firstCourse?.title ?? 'Start learning';
  const lessonPosition = totalLessons > 0
    ? `Lesson ${nextLessonIdx + 1} of ${totalLessons}`
    : 'Start course';
  const courseMeta = firstCourse
    ? `${firstCourse.title}${stepCount > 0 ? ` · ${stepCount} step${stepCount !== 1 ? 's' : ''}` : ` · ${totalLessons} lessons`}`
    : '';

  if (!firstCourse) { return null; }

  return (
    <ContinueCard
      lessonTitle={lessonTitle}
      lessonPosition={lessonPosition}
      courseMeta={courseMeta}
      completedLessons={completedLessons}
      totalLessons={totalLessons}
      hasStarted={hasStarted}
      onContinue={() => onContinue(firstCourse.courseId, nextLesson?.sequenceId ?? null, resumeStepIdx)}
      disabled={unitsLoading}
      loading={unitsLoading}
      variant={variant}
      finalCheckMeta={finalCheckMeta}
      imageUrl={imageUrl}
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
    } else {
      const remaining = goal - daysCompleted;
      heading = remaining === 1 ? 'One more day to go' : `${remaining} days to go`;
      const streakAction = currentStreak > 0 ? `keep your ${currentStreak}-week streak` : 'start a streak';
      if (remaining === 1) {
        desc = currentStreak > 0
          ? `Learn on one more day this week to keep your ${currentStreak}-week streak.`
          : 'Learn on one more day this week to start your first streak.';
      } else {
        desc = `Learn on ${remaining} days this week to ${streakAction}.`;
      }
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

  const isEarned = curriculum.courses_finished > 0
    && curriculum.courses_finished === curriculum.courses_total;
  const badgeArt = curriculum.milestones.complete?.badge?.image_url ?? iconBadgeCheck;

  const completeMilestone = curriculum.milestones.complete;
  const completionLabel = isEarned && completeMilestone?.badge?.title && completeMilestone?.reached_at
    ? (() => {
      const d = new Date(completeMilestone.reached_at!);
      const month = d.toLocaleDateString('en-US', { month: 'short' });
      return `${completeMilestone.badge!.title} · ${d.getDate()} ${month}`;
    })()
    : null;

  const size = 56;
  const strokeWidth = 3;
  const c = size / 2;
  const r = c - strokeWidth / 2;
  const circ = 2 * Math.PI * r;
  const progress = curriculum.courses_total > 0
    ? Math.min(1, curriculum.courses_finished / curriculum.courses_total)
    : 0;
  const offset = circ * (1 - progress);

  return (
    <button type="button" className="path-card" onClick={onClick} aria-label={`View ${curriculum.title}`}>
      <div className="path-card__seal">
        <svg className="path-card__ring" viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden="true">
          <circle cx={c} cy={c} r={r} stroke="var(--u-border-opaque)" strokeWidth={strokeWidth} />
          {progress > 0 && (
            <circle
              cx={c}
              cy={c}
              r={r}
              stroke="var(--u-background-accent)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${c} ${c})`}
            />
          )}
        </svg>
        <div className="path-card__seal-inner">
          <img
            src={badgeArt}
            alt=""
            className="path-card__seal-art"
            aria-hidden="true"
          />
          {/* Desaturates the entire seal (tint + art) when path is not yet earned.
              Uses mix-blend-mode: saturation so colour itself signals completion. */}
          {!isEarned && <div className="path-card__seal-greyscale" aria-hidden="true" />}
        </div>
      </div>
      <div className="path-card__body">
        <span className="path-card__title">{curriculum.title}</span>
        <div className="path-card__meta">
          <span className="path-card__progress">
            {curriculum.courses_finished} of {curriculum.courses_total} courses done
          </span>
          {/* 30-day check status takes priority over completion label / next course */}
          {curriculum.milestones.retained?.reached_at != null && (
            <span className="path-card__next">30-day check passed</span>
          )}
          {curriculum.milestones.retained?.reached_at == null
            && curriculum.knowledge_check.exists
            && curriculum.knowledge_check.is_open
            && (
              <span className="path-card__next path-card__next--check-open">30-day check open</span>
            )}
          {curriculum.milestones.retained?.reached_at == null
            && !(curriculum.knowledge_check.exists && curriculum.knowledge_check.is_open)
            && completionLabel && (
              <span className="path-card__next">{completionLabel}</span>
          )}
          {curriculum.milestones.retained?.reached_at == null
            && !(curriculum.knowledge_check.exists && curriculum.knowledge_check.is_open)
            && !completionLabel
            && nextCourse && (
              <span className="path-card__next">Next: {nextCourse.display_name ?? nextCourse.course_id}</span>
          )}
        </div>
      </div>
      <img src={iconChevronRight} alt="" className="path-card__chevron" aria-hidden="true" />
    </button>
  );
};

// ── Every path done card ─────────────────────────────────

interface EveryPathDoneCardProps {
  curriculums: import('../api/curriculum').LearnerCurriculum[];
  onClick: () => void;
}

const EveryPathDoneCard = ({ curriculums, onClick }: EveryPathDoneCardProps) => {
  const earnedBadges = curriculums
    .map((c) => c.milestones.complete)
    .filter((m): m is NonNullable<typeof m> => m != null);
  const bandImage = curriculums[0]?.image_url ?? scenePhoto;

  return (
    <button type="button" className="notice-card notice-card--caught-up notice-card--full-tap" onClick={onClick} aria-label="Every path done – explore courses">
      <div className="notice-card__band">
        <img src={bandImage} alt="" className="notice-card__scene" aria-hidden="true" />
      </div>
      <div className="notice-card__body">
        <h2 className="notice-card__title">Every path done</h2>
        <p className="notice-card__desc">You&apos;ve earned every path badge. Explore courses to keep learning.</p>
        {earnedBadges.length > 0 && (
          <div className="notice-card__badges">
            {earnedBadges.slice(0, 6).map((m) => (
              <img
                key={m.badge?.uuid ?? m.reached_at ?? String(earnedBadges.indexOf(m))}
                src={m.badge?.image_url ?? iconBadgeCheck}
                alt=""
                className="notice-card__badge-chip"
                aria-hidden="true"
              />
            ))}
          </div>
        )}
      </div>
    </button>
  );
};

// ── New path banner ───────────────────────────────────────

interface NewPathBannerProps {
  curriculum: import('../api/curriculum').LearnerCurriculum;
  onDismiss: () => void;
  onClick: () => void;
}

const NewPathBanner = ({ curriculum, onDismiss, onClick }: NewPathBannerProps) => (
  <div className="notice-card notice-card--caught-up notice-card--new-path">
    <button
      type="button"
      className="notice-card__inner-tap"
      onClick={onClick}
      aria-label={`View new learning path: ${curriculum.title}`}
    >
      <div className="notice-card__band">
        <img
          src={curriculum.image_url ?? scenePhoto}
          alt=""
          className="notice-card__scene notice-card__scene--education"
          aria-hidden="true"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = scenePhoto; }}
        />
      </div>
      <div className="notice-card__body notice-card__body--new-path">
        <h2 className="notice-card__title">New learning path</h2>
        <p className="notice-card__desc">
          {curriculum.description || `${curriculum.title} is now one of your learning paths. Your points, streak and badges stay.`}
        </p>
      </div>
    </button>
    <button
      type="button"
      className="notice-card__dismiss"
      aria-label="Dismiss new learning path notification"
      onClick={(e) => { e.stopPropagation(); onDismiss(); }}
    >
      <img src={iconDismiss} alt="" className="notice-card__dismiss-icon" aria-hidden="true" />
    </button>
  </div>
);

// ── 30-day checks open banner ─────────────────────────────

interface ChecksOpenBannerProps {
  openChecks: import('../api/curriculum').LearnerCurriculum[];
  onClick: () => void;
}

const NUMBER_WORDS: Record<number, string> = {
  2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five',
};

const ChecksOpenBanner = ({ openChecks, onClick }: ChecksOpenBannerProps) => {
  const count = openChecks.length;
  const title = count === 1
    ? '30-day check open'
    : `${NUMBER_WORDS[count] ?? count} 30-day checks open`;

  let subtitle: string;
  if (count === 1) {
    subtitle = openChecks[0].title;
  } else if (count === 2) {
    subtitle = `${openChecks[0].title} and ${openChecks[1].title}`;
  } else {
    subtitle = `${openChecks[0].title} and ${count - 1} more`;
  }

  return (
    <button
      type="button"
      className="check-open-banner"
      onClick={onClick}
      aria-label={title}
    >
      <img src={badgeArtTrophyEarned} alt="" className="check-open-banner__icon" aria-hidden="true" />
      <div className="check-open-banner__body">
        <span className="check-open-banner__title">{title}</span>
        <span className="check-open-banner__sub">{subtitle}</span>
      </div>
      <img src={iconChevronRight} alt="" className="check-open-banner__chevron" aria-hidden="true" />
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

export const CourseCatalog = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: courses, isLoading, isError, refetch,
  } = useLearnCourses();

  const {
    data: gamification, isLoading: gamificationLoading, isError: gamificationError,
  } = useGamification();
  const { data: curriculums } = useCurriculums();
  const { data: badgesData } = useBadges();

  // Catch-all for awards granted asynchronously: celebrate once per award per session.
  const celebration = useBadgeCelebration();
  useEffect(() => {
    if (celebration) { goToBadgeCelebration(navigate, celebration); }
  }, [celebration, navigate]);

  const greeting = `${getGreeting()}.`;
  const enrolledCourses = courses ?? [];

  const kcCourseIds = new Set(
    (curriculums ?? []).map((c) => c.knowledge_check?.course_id).filter(Boolean) as string[],
  );
  const visibleCourseCount = enrolledCourses.filter((c) => !kcCourseIds.has(c.courseId)).length;

  // When there are no enrolled courses (and no API error), redirect to the
  // no-required-courses page — the driver has nothing assigned in their city.
  useEffect(() => {
    if (!isLoading && !isError && enrolledCourses.length === 0) {
      navigate('/no-courses', { replace: true });
    }
  }, [isLoading, isError, enrolledCourses.length, navigate]);

  // 30-day knowledge check: show only when the curriculum API confirms it is open.

  // The course the learner last made progress in — the primary signal for the continue card.
  const { data: lastActivity, isPending: isLastActivityPending } = useQuery({
    queryKey: qk.lastActivity(),
    queryFn: getLastActivity,
    staleTime: 0,
    // On failure, fall back quickly to path-based selection instead of hiding the card through retries.
    retry: 1,
  });

  // Stat chip values from gamification API (fall back to 0 while loading)
  const pointsValue = String(gamification?.lifetime_points ?? 0);
  const streakValue = String(gamification?.current_streak_weeks ?? 0);

  // Badge count: only earned badges shown in the header chip.
  const badgesValue = String(
    (badgesData?.curriculum_badges.filter((b) => b.awarded).length ?? 0)
    + (badgesData?.course_badges.filter((b) => b.awarded).length ?? 0),
  );

  // This-week card state: derive from API when available, otherwise fall back to static
  const apiThisWeek = gamification?.this_week;
  const weekState: WeekState = (() => {
    if (apiThisWeek) {
      if (apiThisWeek.status === 'paused') { return 'paused'; }
      if (apiThisWeek.status === 'goal_met') { return 'two'; }
      return apiThisWeek.learning_days >= 1 ? 'one' : 'zero';
    }
    return 'zero';
  })();

  // Progress in the first unfinished course of every unfinished curriculum, so we can prefer
  // curricula the learner has actually started over ones that are merely newer. It comes from the
  // courses list, which already carries every enrolled course's progress.
  const progressByCourseId = new Map(enrolledCourses.map((c) => [c.courseId, c.progress]));
  const unfinishedCurricula = (curriculums ?? []).filter(
    (c) => c.courses_total > 0 && c.courses_finished < c.courses_total,
  );
  const curriculumFraction: Record<string, number> = {};
  unfinishedCurricula.forEach((c) => {
    const sorted = c.courses.slice().sort((a, b) => a.position - b.position);
    const firstUnfinishedId = sorted.find((course) => !course.finished)?.course_id ?? null;
    curriculumFraction[c.uuid] = (firstUnfinishedId && progressByCourseId.get(firstUnfinishedId)) || 0;
  });

  // Pick the course for the continue card: last activity first, then path priority.
  // KC courses are filtered out before selection so they can never appear via any code path.
  const nonKcCourses = enrolledCourses.filter((c) => !kcCourseIds.has(c.courseId));
  const { course: continueCourse, curriculum: firstCourseCurriculum } = selectContinueCourse({
    enrolledCourses: nonKcCourses,
    curriculums: curriculums ?? [],
    lastActivityCourseId: lastActivity?.course?.course_id ?? null,
    curriculumFraction,
    excludeCourseIds: kcCourseIds,
  });
  const firstCourseId = continueCourse?.courseId;
  const finalCheckMeta = firstCourseCurriculum?.knowledge_check?.display_name ?? null;

  // Show the 30-day check variant in the continue card only when the curriculum
  // explicitly marks the knowledge check as existing and currently open.
  const showKnowledgeCheck = Boolean(
    firstCourseCurriculum?.knowledge_check.exists
    && firstCourseCurriculum?.knowledge_check.is_open,
  );

  const continueVariant: ContinueVariant = showKnowledgeCheck ? 'thirtyDayCheck' : 'lesson';

  // ── Banner detection ────────────────────────────────────
  const allPathsDone = Boolean(
    curriculums && curriculums.length > 0 && curriculums.every((c) => {
      if (c.courses_total === 0) { return true; }
      const coursesDone = c.courses_finished === c.courses_total;
      const checkDone = !c.knowledge_check.exists || c.milestones.retained?.reached_at != null;
      return coursesDone && checkDone;
    }),
  );

  // Session-only dismiss: no localStorage — refreshing the page will show the banner again
  // within the 24-hour window.
  const [dismissedPathIds, setDismissedPathIds] = useState<Set<string>>(() => new Set<string>());

  const dismissNewPath = (uuid: string) => {
    setDismissedPathIds((prev) => { const next = new Set(prev); next.add(uuid); return next; });
  };

  // Show the "New learning path" banner only for curricula assigned within the last 24 hours.
  // Among eligible ones, pick the most recently assigned (highest assigned_at).
  const recentlyAssignedPaths = (curriculums ?? [])
    .filter((c) => {
      if (!c.assigned_at || dismissedPathIds.has(c.uuid)) { return false; }
      const age = Date.now() - new Date(c.assigned_at).getTime();
      return age >= 0 && age < TWENTY_FOUR_HOURS_MS;
    })
    .sort((a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime());

  const featuredNewPath = !allPathsDone ? (recentlyAssignedPaths[0] ?? null) : null;

  // Curricula with an open 30-day check the learner hasn't passed yet
  const openKnowledgeChecks = (curriculums ?? []).filter(
    (c) => c.knowledge_check.exists
      && c.knowledge_check.is_open
      && c.milestones.retained?.reached_at == null,
  );

  // Home page: show curricula where (1) not all courses done AND (2) has activity.
  // KC milestone is intentionally excluded from "complete" — a path with all courses done
  // but KC still open is surfaced via the ChecksOpenBanner, not here.
  const activePathsForHome = (curriculums ?? []).filter((c) => {
    const allCoursesDone = c.courses_finished === c.courses_total && c.courses_total > 0;
    const hasActivity = c.courses_finished > 0 || (curriculumFraction[c.uuid] ?? 0) > 0;
    return !allCoursesDone && hasActivity;
  });

  return (
    <div className="home-page">
      {/* Discovery header */}
      <header className="home-header">
        <img src={uberLogo} alt="Uber" className="home-header__logo" />
        <div className="home-header__actions">
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
              label={`${badgesValue} badges earned — view badges`}
              onClick={() => navigate('/progress', { state: { tab: 'Badges' } })}
            />
          </nav>
          <button
            type="button"
            className="home-header__search"
            aria-label="Search courses"
            onClick={() => navigate('/search')}
          >
            <SearchIcon />
          </button>
        </div>
      </header>

      {/* Scrollable content */}
      <main className="home-content">
        <h1 className="home-greeting">{greeting}</h1>

        {isLoading && <LoadingSkeleton />}

        {isError && (
          <ErrorView
            title="Could not load courses"
            message="We could not retrieve your enrolled courses. Please try again."
            onRetry={() => refetch()}
          />
        )}

        {/* Top card — every-path-done, new-path, or normal continue */}
        {!isLoading && !isError && enrolledCourses.length > 0 && (
          <>
            {allPathsDone && curriculums && (
              <EveryPathDoneCard
                curriculums={curriculums}
                onClick={() => navigate('/courses')}
              />
            )}
            {/* When a new path is present: new-path banner → check banner → continue */}
            {!allPathsDone && featuredNewPath && (
              <>
                <NewPathBanner
                  curriculum={featuredNewPath}
                  onDismiss={() => dismissNewPath(featuredNewPath.uuid)}
                  onClick={() => navigate(`/learning-path/${featuredNewPath.uuid}`, { state: { origin: '/' } })}
                />
                {openKnowledgeChecks.length > 0 && (
                  <ChecksOpenBanner
                    openChecks={openKnowledgeChecks}
                    onClick={() => navigate('/30-day-checks')}
                  />
                )}
                {!isLastActivityPending && (
                  <ConnectedContinueCard
                    course={continueCourse}
                    onContinue={(courseId, sequenceId, stepIdx) => {
                      if (showKnowledgeCheck && firstCourseCurriculum?.knowledge_check.course_id) {
                        navigate(`/course/${firstCourseCurriculum.knowledge_check.course_id}`, { state: { origin: '/' } });
                      } else if (sequenceId) {
                        navigate(`/course/${courseId}/lesson/${sequenceId}/step/${stepIdx}`, { state: { origin: '/' } });
                      } else {
                        navigate(`/course/${courseId}`, { state: { origin: '/' } });
                      }
                    }}
                    variant={continueVariant}
                    finalCheckMeta={finalCheckMeta}
                    imageUrl={null}
                  />
                )}
              </>
            )}
            {/* No new path: check banner (if any) → continue card */}
            {!allPathsDone && !featuredNewPath && (
              <>
                {openKnowledgeChecks.length > 0 && (
                  <ChecksOpenBanner
                    openChecks={openKnowledgeChecks}
                    onClick={() => navigate('/30-day-checks')}
                  />
                )}
                {/* Wait for last activity so the card does not flash a different course first. */}
                {!isLastActivityPending && (
                  <ConnectedContinueCard
                    course={continueCourse}
                    onContinue={(courseId, sequenceId, stepIdx) => {
                      if (showKnowledgeCheck && firstCourseCurriculum?.knowledge_check.course_id) {
                        navigate(`/course/${firstCourseCurriculum.knowledge_check.course_id}`, { state: { origin: '/' } });
                      } else if (sequenceId) {
                        navigate(`/course/${courseId}/lesson/${sequenceId}/step/${stepIdx}`, { state: { origin: '/' } });
                      } else {
                        navigate(`/course/${courseId}`, { state: { origin: '/' } });
                      }
                    }}
                    variant={continueVariant}
                    finalCheckMeta={finalCheckMeta}
                    imageUrl={
                      firstCourseCurriculum?.courses.find(
                        (c) => c.course_id === firstCourseId,
                      )?.image_url ?? firstCourseCurriculum?.image_url ?? null
                    }
                  />
                )}
              </>
            )}
          </>
        )}

        {/* This week */}
        <div className="home-section-header home-section-header--padded">
          <h2 className="home-section-header__title">This week</h2>
        </div>
        {gamificationLoading && (
          <div
            className="this-week-card this-week-card--skeleton"
            aria-busy="true"
            aria-label="Loading…"
          >
            <div
              className="skel-bone"
              style={{ width: '60%', height: 20, borderRadius: 4 }}
            />
            <div
              className="skel-bone"
              style={{
                width: '80%', height: 14, borderRadius: 4, marginTop: 8,
              }}
            />
          </div>
        )}
        {gamificationError && !gamificationLoading && (
          <ErrorView
            title="Could not load streak"
            message="We could not retrieve your streak data. Please try again."
            onRetry={() => queryClient.invalidateQueries({ queryKey: qk.gamification() })}
          />
        )}
        {!gamificationLoading && !gamificationError && (
          <ThisWeekCard
            weekState={weekState}
            apiWeek={apiThisWeek}
            currentStreak={gamification?.current_streak_weeks}
          />
        )}

        {/* Your learning paths — only active (started, not yet done) paths */}
        {activePathsForHome.length > 0 && (
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
              {activePathsForHome.slice(0, 3).map((c) => (
                <LearningPathCard
                  key={c.uuid}
                  curriculum={c}
                  onClick={() => navigate(`/learning-path/${c.uuid}`, { state: { origin: '/' } })}
                />
              ))}
            </div>
          </>
        )}

        {/* All courses card — only shown when there are enrolled courses */}
        {enrolledCourses.length > 0 && (
          <AllCoursesCard
            onClick={() => navigate('/courses')}
            count={visibleCourseCount}
            isEmpty={false}
          />
        )}
      </main>
    </div>
  );
};
