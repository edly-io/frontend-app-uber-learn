import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { BadgeSlot } from '../api/curriculum';
import { useBadgeCelebration, goToBadgeCelebration } from '../hooks/useBadgeCelebration';
import { useCourseOutline } from '../hooks/useCourseOutline';
import { useCourseProgressSummary } from '../hooks/useCourseProgressSummary';
import { useGamification } from '../hooks/useGamification';
import { useCurriculums } from '../hooks/useCurriculums';
import { getLessonResults } from '../api/gamification';
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
import courseArtBook from '../assets/icons/course-art-book.svg';
import badgeArtRetained from '../assets/icons/badge-art-retained.svg';
import './completion-page.scss';

const LESSON_CELEBRATION_SLOTS: readonly BadgeSlot[] = ['complete'];
const COURSE_CELEBRATION_SLOTS: readonly BadgeSlot[] = ['complete'];
const RETENTION_CELEBRATION_SLOTS: readonly BadgeSlot[] = ['retained'];

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
  const progressQuery = useCourseProgressSummary(courseId);
  const { data: gamificationData } = useGamification();

  const resultsQuery = useQuery({
    queryKey: qk.lessonResults(sequenceId, since ?? ''),
    queryFn: () => getLessonResults(sequenceId, since!),
    enabled: Boolean(sequenceId) && Boolean(since),
    staleTime: Infinity,
    retry: 1,
  });

  const allLessons = outlineQuery.data ? mapOutlineToLessons(outlineQuery.data) : [];
  const currentLessonIdx = allLessons.findIndex((l) => l.sequenceId === sequenceId);
  const lessonNumber = currentLessonIdx >= 0 ? currentLessonIdx + 1 : 1;
  const courseTitle = outlineQuery.data?.title ?? '';
  const lessonCount = allLessons.length;
  const nextLesson = currentLessonIdx >= 0 ? (allLessons[currentLessonIdx + 1] ?? null) : null;
  const nextSequenceId = nextLesson?.sequenceId ?? null;
  const isLastLesson = currentLessonIdx >= 0 && currentLessonIdx === allLessons.length - 1;

  const isRepeat = resultsQuery.data?.already_completed_before ?? false;
  const pointsEarned = resultsQuery.data?.points_earned ?? 0;
  const correctPercent = resultsQuery.data?.correct_percent ?? null;
  const questions = resultsQuery.data?.questions ?? 0;
  const correctCount = correctPercent !== null && questions > 0
    ? Math.round((correctPercent / 100) * questions)
    : null;

  // Use outline-based lesson counts (sequences) rather than the progress API's unit (step) counts,
  // which would overcount steps within a lesson as separate "lessons".
  const outlineCounts = outlineQuery.data ? countLessons(outlineQuery.data) : null;
  const completedUnits = outlineCounts?.completed ?? lessonNumber;
  const totalUnits = outlineCounts?.total ?? lessonCount;
  const progressFraction = progressQuery.data?.fraction ?? 0;
  const progressPercent = Math.round(progressFraction * 100);

  const thisWeek = gamificationData?.this_week;
  const weekGoal = thisWeek?.goal ?? 0;
  const weekDays = thisWeek?.learning_days ?? 0;
  const goalMet = thisWeek?.status === 'goal_met';
  let weekLabel: string | null = null;
  if (weekGoal > 0) {
    weekLabel = goalMet
      ? `Goal met, ${weekDays} of ${weekGoal} days`
      : `${weekDays} of ${weekGoal} days`;
  }

  const celebration = useBadgeCelebration(LESSON_CELEBRATION_SLOTS);

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
    } else {
      navigate(`/course/${courseId}`);
    }
  };
  const handlePrimary = () => (celebration ? goToBadgeCelebration(navigate, celebration) : handleStartNext());
  const handleSecondary = () => navigate(`/course/${courseId}`);

  const nextLessonLabel = isLastLesson ? 'Continue' : `Start lesson ${lessonNumber + 1}`;
  const primaryLabel = celebration ? 'See your badge' : nextLessonLabel;

  const headingText = isCourseRefreshed ? 'Course refreshed' : 'Lesson complete';
  const subtitleText = isCourseRefreshed
    ? `${courseTitle} · all ${lessonCount} lessons`
    : `${courseTitle} · Lesson ${lessonNumber} of ${lessonCount}`;
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

        {/* Points — only shown when `since` was provided (results are scoped to this attempt) */}
        {since && pointsEarned > 0 && (
          <div className="cpl-points">
            <div className="cpl-points__figure">
              <img src={iconLightning} alt="" aria-hidden="true" className="cpl-points__icon" />
              <span className="cpl-points__value">
                +
                {pointsEarned}
              </span>
            </div>
            <p className="cpl-points__label">{pointsLabel}</p>
          </div>
        )}

        {/* Stats card */}
        <div className="cp-stats-card">
          {since && correctCount !== null && questions > 0 && (
            <StatsRow
              icon={iconCircleCheck}
              label="Right first time"
              value={`${correctCount} of ${questions}`}
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

        {/* Next lesson card (only when not repeat and there is a next lesson) */}
        {!isRepeat && nextLesson && (
          <div className="cpl-next-card">
            <div className="cpl-next-card__body">
              <p className="cpl-next-card__kicker">Next lesson</p>
              <p className="cpl-next-card__title">{nextLesson.lessonTitle}</p>
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

  const courseOutlineQuery = useCourseOutline(courseId);
  const gamificationQuery = useGamification();
  const { data: curriculums } = useCurriculums();

  const courseTitle = courseOutlineQuery.data?.title ?? '';
  const totalPoints = gamificationQuery.data?.courses?.find(
    (c) => c.course_key === courseId,
  )?.points ?? 0;

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

  const handleContinue = () => navigate('/');
  const handleSeeBadges = () => (
    celebration
      ? goToBadgeCelebration(navigate, celebration)
      : navigate('/progress', { state: { tab: 'Badges' } })
  );

  return (
    <div className="cp-page cp-page--scrollable">
      <WhiteArtPanel artSrc={courseArtBook} earned tintClass="cp-badge-seal--blue" />

      <main className="cp-content cp-content--centered">
        {/* Heading */}
        <div className="cpc-words">
          <p className="cpl-kicker">Course complete</p>
          <h1 className="cpl-title">{courseTitle}</h1>
          {earnedDate && (
            <p className="cpl-subtitle">
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
          </div>
        )}

        {/* Results stats card */}
        <div className="cp-stats-card">
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
            <h1 className="cpl-title">{opensOnDate ? `Come back on ${opensOnDate}` : 'Come back in 30 days'}</h1>
            <p className="cpl-lead">
              {opensOnDate
                ? `Your 30-day check opens on ${opensOnDate}.`
                : 'Your 30-day check is not yet open.'}
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

  const resultsQuery = useQuery({
    queryKey: qk.lessonResults(sequenceId, since ?? ''),
    queryFn: () => getLessonResults(sequenceId, since!),
    enabled: Boolean(sequenceId) && Boolean(since),
    staleTime: Infinity,
    retry: 1,
  });

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
  if (since && resultsQuery.isLoading) {
    return <LoadingSkeleton />;
  }

  if (resultsQuery.isError) {
    return (
      <ErrorView
        title="Unable to load results"
        message="Please try again."
        onRetry={() => resultsQuery.refetch()}
      />
    );
  }

  // Curriculums data not available yet — show loading instead of incorrect fail state.
  if (curriculumsQuery.isLoading) {
    return <LoadingSkeleton />;
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
