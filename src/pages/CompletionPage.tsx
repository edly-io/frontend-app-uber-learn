import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { BadgeSlot, LearnerCurriculum, BadgesResponse } from '../api/curriculum';
import { useBadgeCelebration, goToBadgeCelebration } from '../hooks/useBadgeCelebration';
import { useBadges } from '../hooks/useBadges';
import { useCourseOutline } from '../hooks/useCourseOutline';
import { useGamification } from '../hooks/useGamification';
import { useSequence } from '../hooks/useSequence';
import { useCurriculums } from '../hooks/useCurriculums';
import { useLessonResults } from '../hooks/useLessonResults';
import { markBadgesSeen } from '../api/curriculum';
import { qk } from '../api/queries';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorView } from '../components/ui/ErrorView';
import { mapOutlineToLessons, countLessons } from '../lib/outline-mapper';
import iconArrowLeft from '../assets/icons/icon-arrow-left.svg';
import iconCircleCheck from '../assets/icons/icon-circle-check.svg';
import iconCalendar from '../assets/icons/icon-calendar.svg';
import iconLightning from '../assets/icons/icon-lightning.svg';
import iconRouteFlag from '../assets/icons/icon-route-flag.svg';
import resultDone from '../assets/icons/result-done.svg';
import resultRefreshed from '../assets/icons/result-refreshed.svg';
import badgeRingTrack from '../assets/icons/badge-ring-track.svg';
import badgeRingEarned from '../assets/icons/badge-ring-earned.svg';
import iconBadgeCheck from '../assets/icons/icon-badge-check.svg';
import courseArtBook from '../assets/icons/course-art-book.svg';
import courseArtBlue from '../assets/icons/course-art-blue.svg';
import courseArtOrange from '../assets/icons/course-art-orange.svg';
import courseArtMagenta from '../assets/icons/course-art-magenta.svg';
import courseArtPurple from '../assets/icons/course-art-purple.svg';
import courseArtLime from '../assets/icons/course-art-lime.svg';
import courseArtSteering from '../assets/icons/course-art-steering.svg';
import courseArtToolbox from '../assets/icons/course-art-toolbox.svg';
import badgeArtRetained from '../assets/icons/badge-art-retained.svg';
import './completion-page.scss';

const LESSON_CELEBRATION_SLOTS: readonly BadgeSlot[] = ['complete'];
const COURSE_CELEBRATION_SLOTS: readonly BadgeSlot[] = ['complete'];
const RETENTION_CELEBRATION_SLOTS: readonly BadgeSlot[] = ['retained'];

// ── Course art palette (matches LearningProgress order) ───────────────────

const COURSE_ARTS = [
  courseArtBook,
  courseArtSteering,
  courseArtBlue,
  courseArtOrange,
  courseArtMagenta,
  courseArtPurple,
  courseArtLime,
  courseArtToolbox,
];

// ── Curriculum course badge row ────────────────────────────────────────────

const CourseBadgeRow = ({
  curriculum,
  badges,
}: {
  curriculum: LearnerCurriculum;
  badges: BadgesResponse | undefined;
}) => {
  const courseBadges = badges?.course_badges ?? [];
  const isComplete = curriculum.milestones.complete?.reached_at != null;
  const progress = curriculum.courses_total > 0
    ? curriculum.courses_finished / curriculum.courses_total
    : 0;

  // SVG curriculum ring dimensions
  const size = 56;
  const sw = 3;
  const c = size / 2;
  const r = c - sw / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(1, progress));

  return (
    <div className="cpc-badge-row">
      {curriculum.courses.map((course, idx) => {
        const entry = courseBadges.find(
          (b) => b.source.type === 'course' && b.source.course_id === course.course_id,
        );
        const earned = Boolean(entry?.awarded);
        const artSrc = entry?.badge?.image_url ?? COURSE_ARTS[idx % COURSE_ARTS.length];
        return (
          <div
            key={course.course_id}
            className={`cpc-badge-item${earned ? ' cpc-badge-item--earned' : ''}`}
          >
            <img src={artSrc} alt="" className="cpc-badge-item__img" />
          </div>
        );
      })}

      {/* Dash connector between course seals and path ring */}
      <div className="cpc-badge-dash" aria-hidden="true" />

      {/* Curriculum badge ring — shows completion progress or earned state */}
      <div className="cpc-curriculum-ring">
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
          <circle cx={c} cy={c} r={r} stroke="var(--u-border-opaque)" strokeWidth={sw} fill="none" />
          {progress > 0 && (
            <circle
              cx={c}
              cy={c}
              r={r}
              stroke="var(--u-background-accent)"
              strokeWidth={sw}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${c} ${c})`}
            />
          )}
        </svg>
        <img
          src={curriculum.milestones.complete?.badge?.image_url ?? iconBadgeCheck}
          alt=""
          className={`cpc-curriculum-ring__badge${isComplete ? '' : ' cpc-curriculum-ring__badge--locked'}`}
        />
      </div>
    </div>
  );
};

// ── Shared: Simple nav bar with back arrow ─────────────────────────────────

interface SimpleNavBarProps {
  onBack: () => void;
  backLabel?: string;
}

const SimpleNavBar = ({ onBack, backLabel = 'Back' }: SimpleNavBarProps) => (
  <nav className="cp-simple-nav" aria-label="Page navigation">
    <button type="button" className="cp-simple-nav__back" onClick={onBack} aria-label={backLabel}>
      <img src={iconArrowLeft} alt="" aria-hidden="true" width={20} height={20} />
    </button>
  </nav>
);

// ── Shared: White art panel (badge seal ring) ──────────────────────────────

interface WhiteArtPanelProps {
  artSrc: string;
  artAlt?: string;
  earned?: boolean;
  tintClass?: string;
}

const WhiteArtPanel = ({
  artSrc, artAlt = '', earned = true, tintClass = 'cp-badge-seal--blue',
}: WhiteArtPanelProps) => (
  <div className="cp-white-panel" aria-hidden="true">
    <div className="cp-badge-ring">
      <img src={badgeRingTrack} alt="" aria-hidden="true" className="cp-badge-ring__track" />
      {earned && (
        <img src={badgeRingEarned} alt="" aria-hidden="true" className="cp-badge-ring__fill" />
      )}
      <div className={`cp-badge-seal ${tintClass}`}>
        <img src={artSrc} alt={artAlt} className="cp-badge-seal__art" />
      </div>
    </div>
  </div>
);

// ── Shared: Two-action footer ──────────────────────────────────────────────

interface FooterProps {
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
}

const Footer = ({
  primaryLabel, secondaryLabel, onPrimary, onSecondary,
}: FooterProps) => (
  <footer className="cp-footer">
    <button type="button" className="cp-footer__primary" onClick={onPrimary}>
      {primaryLabel}
    </button>
    <button type="button" className="cp-footer__secondary" onClick={onSecondary}>
      {secondaryLabel}
    </button>
  </footer>
);

// ── Shared: Stats summary card ─────────────────────────────────────────────

interface StatsRowProps {
  icon: string;
  iconAlt?: string;
  label: string;
  value: string;
  withBar?: boolean;
  barPercent?: number;
}

const StatsRow = ({
  icon, iconAlt = '', label, value, withBar = false, barPercent = 0,
}: StatsRowProps) => (
  <div className={`cp-stats-row${withBar ? ' cp-stats-row--with-bar' : ''}`}>
    <div className="cp-stats-row__main">
      <img src={icon} alt={iconAlt} aria-hidden="true" className="cp-stats-row__icon" />
      <p className="cp-stats-row__label">{label}</p>
      <p className="cp-stats-row__value">{value}</p>
    </div>
    {withBar && (
      <div className="cp-stats-bar">
        <div
          className="cp-stats-bar__fill"
          style={{ '--progress': String(Math.min(1, barPercent / 100)) } as React.CSSProperties}
        />
      </div>
    )}
  </div>
);

// ── Lesson Complete Page ───────────────────────────────────────────────────

export const LessonCompletePage = () => {
  const { courseId = '', sequenceId = '' } = useParams<{ courseId: string; sequenceId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const since = (location.state as { since?: string } | null)?.since as string | undefined;

  const outlineQuery = useCourseOutline(courseId);
  const { data: gamificationData } = useGamification();

  const resultsQuery = useLessonResults(sequenceId, since);

  const allLessons = outlineQuery.data ? mapOutlineToLessons(outlineQuery.data) : [];
  const currentLessonIdx = allLessons.findIndex((l) => l.sequenceId === sequenceId);
  const lessonNumber = currentLessonIdx >= 0 ? currentLessonIdx + 1 : 1;
  const courseTitle = outlineQuery.data?.title ?? '';
  const currentLessonTitle = currentLessonIdx >= 0 ? (allLessons[currentLessonIdx]?.lessonTitle ?? '') : '';
  const lessonCount = allLessons.length;
  const nextLesson = currentLessonIdx >= 0 ? (allLessons[currentLessonIdx + 1] ?? null) : null;
  const nextSequenceId = nextLesson?.sequenceId ?? null;
  const isLastLesson = currentLessonIdx >= 0 && currentLessonIdx === allLessons.length - 1;

  // Fetch next lesson's units to show step count in the "Next lesson" card
  // and to detect if the next lesson is the final check (all units are assessment type).
  const { units: nextUnits } = useSequence(nextSequenceId ?? '');
  const nextStepCount = nextUnits.length;
  const isFinalCheck = nextUnits.length > 0 && nextUnits.every((u) => u.graded === true);

  const isRepeat = resultsQuery.data?.already_completed_before ?? false;
  const pointsEarned = resultsQuery.data?.points_earned ?? 0;
  const correctPercent = resultsQuery.data?.correct_percent ?? null;
  const questions = resultsQuery.data?.questions ?? 0;

  // Use outline-based lesson counts (sequences) rather than the progress API's unit (step) counts,
  // which would overcount steps within a lesson as separate "lessons".
  const outlineCounts = outlineQuery.data ? countLessons(outlineQuery.data) : null;
  const completedUnits = outlineCounts?.completed ?? lessonNumber;
  const totalUnits = outlineCounts?.total ?? lessonCount;
  // Drive the bar from the same lesson-based fraction as the text ("2 of 4 = 50%"),
  // not the unit-based fraction from the progress API which can differ (e.g. 62.5% for CON101).
  const progressPercent = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;

  const thisWeek = gamificationData?.this_week;
  const weekGoal = thisWeek?.goal ?? 0;
  const weekDays = thisWeek?.learning_days ?? 0;
  const goalMet = thisWeek?.status === 'goal_met';
  let weekLabel: string | null = null;
  if (weekGoal > 0) {
    // Cap displayed days at the goal when exceeded so "3 of 2" never appears.
    const displayDays = goalMet ? Math.min(weekDays, weekGoal) : weekDays;
    weekLabel = goalMet
      ? `Goal met, ${displayDays} of ${weekGoal} days`
      : `${displayDays} of ${weekGoal} days`;
  }

  const celebration = useBadgeCelebration(LESSON_CELEBRATION_SLOTS);
  const { data: curriculums } = useCurriculums();
  const parentCurriculum = curriculums?.find(
    (c) => c.courses.some((course) => course.course_id === courseId),
  );

  // Course/curriculum badges only make sense after the last lesson — don't show mid-course.
  const showCelebration = isLastLesson && celebration !== null;

  // Guard against heading flash: "Lesson complete" → "Course refreshed" on repeat completion.
  // Only wait for results when `since` is provided — without it the query is disabled and
  // we show the page immediately with default (non-repeat) state.
  if (since && resultsQuery.isLoading) {
    return <LoadingSkeleton />;
  }

  const isCourseRefreshed = isRepeat && isLastLesson;
  const doneMark = (isRepeat && isLastLesson) ? resultRefreshed : resultDone;

  const handleBack = () => navigate(`/course/${courseId}`);
  const handleStartNext = () => {
    if (nextSequenceId) {
      navigate(`/course/${courseId}/lesson/${nextSequenceId}/step/0`);
    } else if (parentCurriculum) {
      navigate(`/course/${courseId}/complete`);
    } else {
      navigate(`/course/${courseId}`);
    }
  };

  // When completing the last lesson of a curriculum course, bypass badge
  // celebration and go straight to CourseCompletePage, which owns its own
  // badge flow via "See your badges".
  const handlePrimary = () => {
    if (isLastLesson && parentCurriculum) {
      navigate(`/course/${courseId}/complete`);
      return;
    }
    if (showCelebration) {
      goToBadgeCelebration(navigate, celebration!);
      return;
    }
    handleStartNext();
  };

  const handleSecondary = () => navigate(`/course/${courseId}`);

  let nextLessonLabel = `Start lesson ${lessonNumber + 1}`;
  if (isFinalCheck) { nextLessonLabel = 'Start final check'; }
  if (isLastLesson) { nextLessonLabel = 'Continue'; }
  const primaryLabel = (isLastLesson && parentCurriculum) || !showCelebration ? nextLessonLabel : 'See your badge';

  const headingText = isCourseRefreshed ? 'Course refreshed' : 'Lesson complete';
  const subtitleText = isCourseRefreshed
    ? `${courseTitle} · all ${lessonCount} lessons`
    : `${currentLessonTitle || courseTitle} · Lesson ${lessonNumber} of ${lessonCount}`;
  const pointsLabel = isCourseRefreshed ? 'points earned again' : 'points earned';
  const progressRowLabel = isCourseRefreshed ? 'Lessons refreshed' : 'Course progress';
  const progressRowValue = isCourseRefreshed
    ? `${totalUnits} of ${totalUnits}`
    : `${completedUnits} of ${totalUnits} lessons`;

  return (
    <div className="cp-page cp-page--scrollable">
      <SimpleNavBar onBack={handleBack} />

      <main className="cp-content">
        {/* Done mark + heading */}
        <div className="cpl-top">
          <img src={doneMark} alt="" aria-hidden="true" className="cpl-done-mark" />
          <h1 className="cpl-title">{headingText}</h1>
          {(courseTitle || lessonCount > 0) && (
            <p className="cpl-subtitle">{subtitleText}</p>
          )}
        </div>

        {/* Stat cards grid — 2-up colored cards (Figma spec: points + accuracy side by side) */}
        {since && (pointsEarned > 0 || correctPercent !== null) && (
          <div className="cpl-stat-grid">
            {pointsEarned > 0 && (
              <div className="cpl-stat-card cpl-stat-card--points">
                <div className="cpl-stat-card__figure">
                  <img src={iconLightning} alt="" aria-hidden="true" className="cpl-stat-card__icon" />
                  <span className="cpl-stat-card__value">
                    +
                    {pointsEarned}
                  </span>
                </div>
                <p className="cpl-stat-card__label">{pointsLabel}</p>
              </div>
            )}
            {correctPercent !== null && questions > 0 && (
              <div className="cpl-stat-card cpl-stat-card--correct">
                <div className="cpl-stat-card__figure">
                  <img src={iconCircleCheck} alt="" aria-hidden="true" className="cpl-stat-card__icon" />
                  <span className="cpl-stat-card__value">
                    {correctPercent}
                    %
                  </span>
                </div>
                <p className="cpl-stat-card__label">correct</p>
              </div>
            )}
          </div>
        )}

        {/* Stats card */}
        <div className="cp-stats-card">
          {isRepeat && (
            <StatsRow
              icon={iconLightning}
              label="Points"
              value="Already earned"
            />
          )}
          {weekLabel && (
            <StatsRow
              icon={iconCalendar}
              label="This week"
              value={weekLabel}
            />
          )}
          <StatsRow
            icon={iconRouteFlag}
            label={progressRowLabel}
            value={progressRowValue}
            withBar={!isCourseRefreshed}
            barPercent={progressPercent}
          />
        </div>

        {/* Next lesson / Final check card */}
        {!isCourseRefreshed && nextLesson && (
          <div className="cpl-next-card">
            <div className="cpl-next-card__body">
              {isFinalCheck ? (
                <>
                  <p className="cpl-next-card__kicker">Last step</p>
                  <p className="cpl-next-card__title">Final check</p>
                  {nextUnits.length > 0 && (
                    <p className="cpl-next-card__steps">
                      {`${nextUnits.length} ${nextUnits.length === 1 ? 'question' : 'questions'}`}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="cpl-next-card__kicker">Next lesson</p>
                  <p className="cpl-next-card__title">{nextLesson.lessonTitle}</p>
                  {nextStepCount > 0 && (
                    <p className="cpl-next-card__steps">
                      {`${nextStepCount} ${nextStepCount === 1 ? 'step' : 'steps'}`}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>

      <Footer
        primaryLabel={primaryLabel}
        secondaryLabel="Back to course"
        onPrimary={handlePrimary}
        onSecondary={handleSecondary}
      />
    </div>
  );
};

// ── Course Complete Page ───────────────────────────────────────────────────

export const CourseCompletePage = () => {
  const { courseId = '' } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const { finalCheckSequenceId, since } = (
    location.state as { finalCheckSequenceId?: string; since?: string } | null
  ) ?? {};

  const courseOutlineQuery = useCourseOutline(courseId);
  const gamificationQuery = useGamification();
  const { data: curriculums } = useCurriculums();
  const { data: badgesData } = useBadges();

  // Fetch final check results when we came from a final check sequence.
  const finalCheckResultsQuery = useLessonResults(finalCheckSequenceId, since);

  const courseTitle = courseOutlineQuery.data?.title ?? '';
  const totalPoints = gamificationQuery.data?.courses?.find(
    (c) => c.course_key === courseId,
  )?.points ?? 0;

  const finalCheckCorrectPct = finalCheckResultsQuery.data?.correct_percent ?? null;
  const finalCheckQuestions = finalCheckResultsQuery.data?.questions ?? 0;
  const finalCheckScore = finalCheckCorrectPct !== null && finalCheckQuestions > 0
    ? Math.round((finalCheckCorrectPct / 100) * finalCheckQuestions)
    : null;

  const parentCurriculum = curriculums?.find((c) => c.courses.some((course) => course.course_id === courseId));
  const completeMilestone = parentCurriculum?.milestones.complete ?? null;
  const earnedAt = completeMilestone?.reached_at ?? null;
  const earnedDate = earnedAt
    ? new Date(earnedAt).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
    : null;

  const coursesFinished = parentCurriculum?.courses_finished ?? 0;
  const coursesTotal = parentCurriculum?.courses_total ?? 0;

  const celebration = useBadgeCelebration(COURSE_CELEBRATION_SLOTS);
  const queryClient = useQueryClient();

  const { mutate: markSeen } = useMutation({
    mutationFn: (ids: string[]) => markBadgesSeen(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.badges() });
      queryClient.invalidateQueries({ queryKey: qk.curriculums() });
    },
  });

  // Mark any unseen badges seen when this screen appears.
  useEffect(() => {
    if (celebration?.awardId) {
      markSeen([celebration.awardId, ...celebration.alsoEarned.map((b) => b.id)]);
    }
  }, [celebration?.awardId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleContinue = () => navigate('/');
  const handleSeeBadges = () => navigate('/progress', { state: { tab: 'Badges' } });

  return (
    <div className="cp-page cp-page--scrollable">
      <WhiteArtPanel artSrc={courseArtBook} earned tintClass="cp-badge-seal--blue" />

      <main className="cp-content cp-content--centered">
        {/* Heading */}
        <div className="cpc-words">
          <p className="cpl-kicker">Course complete</p>
          <h1 className="cpl-title">{courseTitle}</h1>
          {earnedDate && (
            <p className="cpl-date">
              Earned
              {' '}
              {earnedDate}
            </p>
          )}
        </div>

        {/* Curriculum progress card (only when in a path) */}
        {parentCurriculum && coursesTotal > 0 && (
          <div className="cp-stats-card">
            <div className="cpc-path-head">
              <p className="cpc-path-name">{parentCurriculum.title}</p>
              <p className="cpc-path-count">
                {coursesFinished}
                {' '}
                of
                {' '}
                {coursesTotal}
                {' '}
                courses
              </p>
            </div>
            <CourseBadgeRow curriculum={parentCurriculum} badges={badgesData} />
          </div>
        )}

        {/* Results stats card */}
        <div className="cp-stats-card">
          {finalCheckScore !== null && finalCheckQuestions > 0 && (
            <StatsRow
              icon={iconCircleCheck}
              label="Final check"
              value={`${finalCheckScore} of ${finalCheckQuestions}`}
            />
          )}
          {totalPoints > 0 && (
            <StatsRow
              icon={iconLightning}
              label="Points"
              value={`+${totalPoints}`}
            />
          )}
        </div>

      </main>

      <Footer
        primaryLabel="Continue"
        secondaryLabel="See your badges"
        onPrimary={handleContinue}
        onSecondary={handleSeeBadges}
      />
    </div>
  );
};

// ── Retention Invite Page ──────────────────────────────────────────────────

export const RetentionInvitePage = () => {
  const { courseId = '' } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const { data: curriculums } = useCurriculums();
  const outlineQuery = useCourseOutline(courseId);

  const parentCurriculum = curriculums?.find((c) => c.knowledge_check.course_id === courseId);
  const knowledgeCheck = parentCurriculum?.knowledge_check ?? null;

  const notOpenYet = knowledgeCheck !== null && !knowledgeCheck.is_open;
  const opensOnDate = knowledgeCheck?.unlocks_at
    ? new Date(knowledgeCheck.unlocks_at).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
    : null;

  const allLessons = outlineQuery.data ? mapOutlineToLessons(outlineQuery.data) : [];
  const firstSequenceId = allLessons[0]?.sequenceId ?? null;

  const handleBack = () => navigate('/');
  const handleStartCheck = () => {
    if (firstSequenceId) {
      navigate(`/course/${courseId}/lesson/${firstSequenceId}/step/0`);
    } else {
      navigate(`/course/${courseId}`);
    }
  };

  const pathTitle = parentCurriculum?.title ?? 'your required courses';

  if (notOpenYet) {
    return (
      <div className="cp-page cp-page--scrollable">
        <WhiteArtPanel artSrc={badgeArtRetained} earned={false} tintClass="cp-badge-seal--blue" />

        <main className="cp-content cp-content--centered">
          <div className="cpc-words">
            <p className="cpl-kicker">30-day check</p>
            <h1 className="cpl-title">Come back in 30 days</h1>
            <p className="cpl-lead">
              {`Your ${pathTitle} check opens${opensOnDate ? ` on ${opensOnDate}` : ' 30 days after you finish'}.`}
            </p>
          </div>
        </main>

        <footer className="cp-footer">
          <button type="button" className="cp-footer__primary" onClick={handleBack}>
            Back to learning home
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="cp-page cp-page--scrollable">
      <WhiteArtPanel artSrc={badgeArtRetained} earned={false} tintClass="cp-badge-seal--blue" />

      <main className="cp-content cp-content--centered">
        <div className="cpc-words">
          <p className="cpl-kicker">30-day check</p>
          <h1 className="cpl-title">Still with you?</h1>
          <p className="cpl-lead">
            Five questions check what stayed with you from
            {' '}
            {pathTitle}
            . Get 4 of 5 right to earn the trophy, and try again as often as you need.
          </p>
        </div>
      </main>

      <Footer
        primaryLabel="Start 30-day check"
        secondaryLabel="Not now"
        onPrimary={handleStartCheck}
        onSecondary={handleBack}
      />
    </div>
  );
};

// ── Retention Check Result Page ────────────────────────────────────────────

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 10000;

export const RetentionCheckResultPage = () => {
  const { courseId = '', sequenceId = '' } = useParams<{ courseId: string; sequenceId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const since = (location.state as { since?: string } | null)?.since as string | undefined;

  const resultsQuery = useLessonResults(sequenceId, since);

  const curriculumsQuery = useCurriculums();
  const parentCurriculum = curriculumsQuery.data?.find(
    (c) => c.knowledge_check.course_id === courseId,
  );

  const correctPercent = resultsQuery.data?.correct_percent ?? null;
  const total = resultsQuery.data?.questions ?? 0;
  const score = correctPercent !== null && total > 0
    ? Math.round((correctPercent / 100) * total)
    : null;

  // Pass/fail is determined by whether the backend has recorded the Retained milestone.
  // This is the source of truth — it also works when `since` is absent (deep-link).
  const retainedReachedAt = parentCurriculum?.milestones?.retained?.reached_at ?? null;
  const passed = retainedReachedAt !== null;

  // --- Polling to handle Celery race ---
  // The Celery task that awards the retained milestone may not have run yet when this
  // page loads. If reached_at is null, poll the curriculums endpoint every 2 seconds
  // for up to 10 seconds before concluding the learner failed.
  const [pollingStarted, setPollingStarted] = useState(false);
  const [pollExpired, setPollExpired] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (retainedReachedAt || pollExpired) { return undefined; }
    setPollingStarted(true);
    const timeout = setTimeout(() => setPollExpired(true), POLL_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [retainedReachedAt, pollExpired]);

  useEffect(() => {
    if (!pollingStarted || retainedReachedAt || pollExpired) { return undefined; }
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: qk.curriculums() });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [pollingStarted, retainedReachedAt, pollExpired, queryClient]);

  // Show pending while Celery may still be awarding the milestone.
  const pending = !passed && !pollExpired;

  const earnedDate = retainedReachedAt
    ? new Date(retainedReachedAt).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
    : null;

  const celebration = useBadgeCelebration(RETENTION_CELEBRATION_SLOTS);

  const handleContinue = () => (
    celebration ? goToBadgeCelebration(navigate, celebration) : navigate('/')
  );
  const handleSeeBadges = () => navigate('/progress', { state: { tab: 'Badges' } });
  const handleReviewCourse = () => navigate(`/course/${courseId}`);
  const handleTryAgain = () => navigate(`/course/${courseId}/retention`);

  // Wait for lesson results when `since` is provided.
  // On error, fall through with score = null so the result page still shows pass/fail.
  if (since && resultsQuery.isLoading) {
    return <LoadingSkeleton />;
  }

  // Curriculums data not available yet — show loading instead of incorrect fail state.
  if (curriculumsQuery.isLoading) {
    return <LoadingSkeleton />;
  }

  // Curriculums API failed — show error rather than a misleading fail state.
  if (curriculumsQuery.isError) {
    return (
      <ErrorView
        title="Unable to load results"
        message="Please try again."
        onRetry={() => curriculumsQuery.refetch()}
      />
    );
  }

  // Celery task may not have run yet — show pending rather than incorrect "Worth another look".
  if (pending) {
    return <LoadingSkeleton />;
  }

  const scoreLabel = score !== null && total > 0 ? `${score} of ${total}` : '—';

  if (passed) {
    return (
      <div className="cp-page cp-page--scrollable">
        <WhiteArtPanel artSrc={badgeArtRetained} earned tintClass="cp-badge-seal--blue" />

        <main className="cp-content cp-content--centered">
          <div className="cpc-words">
            <p className="cpl-kicker">Badge earned</p>
            <h1 className="cpl-title">30-day check</h1>
            <p className="cpl-lead">
              You got
              {' '}
              {scoreLabel}
              {' '}
              right.
              {' '}
              What you learned stayed with you.
            </p>
            {earnedDate && (
              <p className="cpl-date">
                Earned
                {' '}
                {earnedDate}
              </p>
            )}
          </div>
        </main>

        <Footer
          primaryLabel="Continue"
          secondaryLabel="See your badges"
          onPrimary={handleContinue}
          onSecondary={handleSeeBadges}
        />
      </div>
    );
  }

  return (
    <div className="cp-page cp-page--scrollable">
      <WhiteArtPanel artSrc={badgeArtRetained} earned={false} tintClass="cp-badge-seal--blue" />

      <main className="cp-content cp-content--centered">
        <div className="cpc-words">
          <p className="cpl-kicker">30-day check</p>
          <h1 className="cpl-title">Worth another look</h1>
          <p className="cpl-lead">
            You got
            {' '}
            {scoreLabel}
            {' '}
            right. Review the missed topics, then try again, as often as you need.
          </p>
        </div>
      </main>

      <Footer
        primaryLabel="Review course"
        secondaryLabel="Try again"
        onPrimary={handleReviewCourse}
        onSecondary={handleTryAgain}
      />
    </div>
  );
};
