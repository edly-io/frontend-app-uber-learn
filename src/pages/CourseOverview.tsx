import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getResumeBlock } from '../api/courseware';
import { qk } from '../api/queries';
import { useCourseOutline } from '../hooks/useCourseOutline';
import { useProgress } from '../hooks/useProgress';
import { mapOutlineToLessons } from '../lib/outline-mapper';
import type { LessonDescriptor } from '../lib/outline-mapper';
import { getStoredResumeIdx, getStoredResumeSequenceId } from '../lib/resume-storage';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorView } from '../components/ui/ErrorView';
import { RetryOverlay } from '../components/retry-overlay/RetryOverlay';
import { NavHeader } from '../components/nav-header/NavHeader';
import type { AssessmentState } from '../api/progress';
import './course-page.css';

// ── Types ──────────────────────────────────────────────────────────────────

type BlockedReason = NonNullable<AssessmentState['blockedReason']>;

interface BlockedAssessmentState {
  reason: BlockedReason;
  retryAfterSeconds: number;
  unlocksAt: string | null;
}

type LessonState = 'complete' | 'current' | 'upcoming';

interface LessonSection {
  sectionId: string;
  sectionTitle: string;
  lessons: LessonDescriptor[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function findBlockedAssessment(
  sequenceId: string,
  assessments: {
    baseline: AssessmentState | null;
    final: AssessmentState | null;
    retention: AssessmentState | null;
  } | undefined,
): BlockedAssessmentState | null {
  if (!assessments) { return null; }

  const candidates = [assessments.baseline, assessments.final, assessments.retention];
  const match = candidates.find(
    (a) => a !== null && a.sequenceKey === sequenceId && !a.canAttempt,
  );

  if (!match || !match.blockedReason) { return null; }

  return {
    reason: match.blockedReason,
    retryAfterSeconds: match.retryAfterSeconds,
    unlocksAt: match.unlocksAt,
  };
}

function groupBySection(lessons: LessonDescriptor[]): LessonSection[] {
  const map = new Map<string, LessonSection>();
  lessons.forEach((lesson) => {
    if (!map.has(lesson.sectionId)) {
      map.set(lesson.sectionId, {
        sectionId: lesson.sectionId,
        sectionTitle: lesson.sectionTitle,
        lessons: [],
      });
    }
    map.get(lesson.sectionId)!.lessons.push(lesson);
  });
  return Array.from(map.values());
}

function getLessonState(
  lesson: LessonDescriptor,
  resumeSequenceId: string | null,
  allLessons: LessonDescriptor[],
  courseComplete: boolean,
): LessonState {
  if (courseComplete) { return 'complete'; }
  if (!resumeSequenceId) { return 'upcoming'; }

  const resumeIdx = allLessons.findIndex((l) => l.sequenceId === resumeSequenceId);
  if (resumeIdx < 0) { return 'upcoming'; }

  if (lesson.sequenceId === resumeSequenceId) { return 'current'; }
  if (lesson.lessonIndex < resumeIdx) { return 'complete'; }
  return 'upcoming';
}

// ── Icons ──────────────────────────────────────────────────────────────────

const CompleteIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="12" fill="#0e8345" />
    <polyline
      points="7,12.5 10.5,16 17,9"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CurrentIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="11" stroke="#276ef1" strokeWidth="2" />
  </svg>
);

const UpcomingIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="11" stroke="#e8e8e8" strokeWidth="2" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M9 18L15 12L9 6" stroke="#878787" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ── Safety hero ────────────────────────────────────────────────────────────

const SafetyHero = () => (
  <div className="cd-hero" aria-hidden="true">
    <svg
      viewBox="0 0 390 180"
      preserveAspectRatio="xMidYMid slice"
      className="cd-hero__svg"
    >
      <rect width="390" height="180" fill="#002661" />
      {/* Concentric filled rings — lighter blue toward center */}
      <circle cx="195" cy="90" r="175" fill="#0a3070" />
      <circle cx="195" cy="90" r="135" fill="#0e3d85" />
      <circle cx="195" cy="90" r="100" fill="#134a9e" />
      <circle cx="195" cy="90" r="75" fill="#1a56b8" />
      {/* White stroke outlines on each ring for definition */}
      <circle cx="195" cy="90" r="175" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
      <circle cx="195" cy="90" r="135" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" />
      <circle cx="195" cy="90" r="100" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
      <circle cx="195" cy="90" r="75" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />
      {/* Center disc */}
      <circle cx="195" cy="90" r="52" fill="rgba(255,255,255,0.15)" />
      {/* Shield body */}
      <path
        d="M195 64 L217 72 L217 88 C217 100.5 207 110 195 114 C183 110 173 100.5 173 88 L173 72 Z"
        fill="white"
      />
      {/* Checkmark */}
      <polyline
        points="185,90 192,97 205,83"
        fill="none"
        stroke="#276ef1"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </div>
);

// ── Lesson row ─────────────────────────────────────────────────────────────

interface LessonRowProps {
  lesson: LessonDescriptor;
  state: LessonState;
  isLast: boolean;
  onClick: () => void;
}

const LessonRow = ({
  lesson, state, isLast, onClick,
}: LessonRowProps) => {
  const isClickable = state !== 'upcoming';
  const descText = state === 'complete'
    ? 'Complete'
    : state === 'current'
      ? 'In progress'
      : null;

  return (
    <button
      type="button"
      className={`cd-lesson-row${state === 'upcoming' ? ' cd-lesson-row--upcoming' : ''}`}
      onClick={isClickable ? onClick : undefined}
      disabled={state === 'upcoming'}
      aria-disabled={state === 'upcoming'}
    >
      <div className="cd-lesson-row__status">
        {state === 'complete' && <CompleteIcon />}
        {state === 'current' && <CurrentIcon />}
        {state === 'upcoming' && <UpcomingIcon />}
      </div>
      <div className="cd-lesson-row__content">
        <div className="cd-lesson-row__body">
          <p className={`cd-lesson-row__title${state === 'upcoming' ? ' cd-lesson-row__title--dim' : ''}`}>
            {lesson.lessonTitle}
          </p>
          {descText && (
            <p className={`cd-lesson-row__desc${state === 'upcoming' ? ' cd-lesson-row__desc--dim' : ''}`}>
              {descText}
            </p>
          )}
        </div>
        {isClickable && (
          <span className="cd-lesson-row__chevron">
            <ChevronRightIcon />
          </span>
        )}
        {!isLast && <div className="cd-lesson-row__divider" />}
      </div>
    </button>
  );
};

// ── CourseOverview page ────────────────────────────────────────────────────

export const CourseOverview = () => {
  const { courseId = '' } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [blockedAssessment, setBlockedAssessment] = useState<BlockedAssessmentState | null>(null);

  const resumeQuery = useQuery({
    queryKey: qk.resume(courseId),
    queryFn: () => getResumeBlock(courseId),
    enabled: Boolean(courseId),
    staleTime: 0,
  });

  const outlineQuery = useCourseOutline(courseId);
  const { data: progressData } = useProgress(courseId);

  if (outlineQuery.isLoading || resumeQuery.isLoading) {
    return (
      <div className="course-page">
        <NavHeader title="Course details" onBack={() => navigate('/')} />
        <div className="course-scroll">
          <LoadingSkeleton />
        </div>
        <footer className="course-footer">
          <button type="button" className="course-footer__primary" disabled style={{ opacity: 0.4 }}>
            Loading…
          </button>
        </footer>
      </div>
    );
  }

  if (outlineQuery.isError) {
    return (
      <ErrorView
        title="Could not load course"
        message="We could not retrieve the course outline. Please try again."
        onRetry={() => outlineQuery.refetch()}
      />
    );
  }

  const outline = outlineQuery.data;
  const lessons = outline ? mapOutlineToLessons(outline) : [];
  const sections = groupBySection(lessons);

  const apiResumeSequenceId = resumeQuery.data?.sectionId ?? null;
  const fraction = progressData?.fraction ?? 0;
  const completedCount = progressData?.completedActivities ?? 0;
  const totalActivities = progressData?.totalActivities ?? 0;
  const courseComplete = progressData?.courseComplete ?? false;
  const pointsEarned = progressData?.points?.earned ?? 0;
  const badgesCount = progressData?.badges?.length ?? 0;

  // Use the furthest-reached sequence: prefer localStorage (updated whenever the
  // user enters any ActivityView) over the API resume block (can lag or stay on
  // first visited sequence for demo courses).
  const apiResumeIdx = apiResumeSequenceId
    ? lessons.findIndex((r) => r.sequenceId === apiResumeSequenceId)
    : -1;
  const storedResumeIdx = getStoredResumeIdx(courseId, lessons);
  const effectiveResumeIdx = Math.max(apiResumeIdx, storedResumeIdx);
  const resumeSequenceId = effectiveResumeIdx >= 0
    ? lessons[effectiveResumeIdx].sequenceId
    : (getStoredResumeSequenceId(courseId) ?? apiResumeSequenceId);

  const resumeIdx = effectiveResumeIdx;
  const completedLessons = courseComplete
    ? lessons.length
    : resumeIdx > 0 ? resumeIdx : 0;

  const totalLessons = lessons.length;
  // Prefer outline-derived fraction when the progress API returns zero (demo courses).
  const derivedFraction = totalLessons > 0 && completedLessons > 0
    ? completedLessons / totalLessons : 0;
  const effectiveFraction = derivedFraction > 0 ? derivedFraction : fraction;
  const percentDisplay = `${Math.round(effectiveFraction * 100)}%`;

  const handleContinue = () => {
    if (courseComplete) {
      navigate(`/course/${courseId}/complete`);
      return;
    }
    if (resumeSequenceId) {
      // Check assessment routing first
      const assessments = progressData?.assessments;
      if (assessments) {
        if (assessments.baseline?.sequenceKey === resumeSequenceId && assessments.baseline.canAttempt) {
          navigate(`/course/${courseId}/check/baseline`);
          return;
        }
        if (assessments.final?.sequenceKey === resumeSequenceId && assessments.final.canAttempt) {
          navigate(`/course/${courseId}/check/final`);
          return;
        }
      }
      navigate(`/course/${courseId}/lesson/${resumeSequenceId}/step/0`);
      return;
    }
    // No progress — show course introduction
    navigate(`/course/${courseId}/intro`);
  };

  const handleLessonClick = (sequenceId: string) => {
    const blocked = findBlockedAssessment(sequenceId, progressData?.assessments);
    if (blocked) {
      setBlockedAssessment(blocked);
      return;
    }

    const assessments = progressData?.assessments;
    if (assessments) {
      if (assessments.baseline?.sequenceKey === sequenceId && assessments.baseline.canAttempt) {
        navigate(`/course/${courseId}/check/baseline`);
        return;
      }
      if (assessments.final?.sequenceKey === sequenceId && assessments.final.canAttempt) {
        navigate(`/course/${courseId}/check/final`);
        return;
      }
    }

    navigate(`/course/${courseId}/lesson/${sequenceId}/step/0`);
  };

  const ctaLabel = courseComplete
    ? 'View completion'
    : resumeSequenceId
      ? 'Continue course'
      : 'Start course';

  const factsText = [
    totalLessons > 0 ? `${totalLessons} lessons` : null,
    totalActivities > 0 ? `${totalActivities} activities` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="course-page">
      <NavHeader title="Course details" onBack={() => navigate('/')} />

      <div className="course-scroll">
        <SafetyHero />

        <main className="course-content">
          {/* Kicker */}
          <p className="cd-kicker">Required · Safety</p>

        {/* Title */}
        <h1 className="cd-title">{outline?.title ?? 'Course'}</h1>

        {/* Lead */}
        <p className="cd-lead">
          Practical guidance for respectful boundaries, awareness, and safe reporting.
        </p>

        {/* Progress — show whenever we have any completion signal */}
        {(fraction > 0 || completedLessons > 0) && (
          <div className="cd-progress">
            <div className="cd-progress-labels">
              <span className="cd-progress-label">
                {completedLessons > 0
                  ? `${completedLessons} of ${totalLessons} lessons complete`
                  : `0 of ${totalLessons} lessons complete`}
              </span>
              <span className="cd-progress-percent">{percentDisplay}</span>
            </div>
            <div className="cd-progress-track">
              <div className="cd-progress-fill" style={{ width: `${Math.round(effectiveFraction * 100)}%` }} />
            </div>
          </div>
        )}

        {/* Facts */}
        {factsText && <p className="cd-facts">{factsText}</p>}

        {/* Learning record card */}
        {(pointsEarned > 0 || badgesCount > 0) && (
          <button
            type="button"
            className="cd-record-card"
            onClick={() => navigate(`/course/${courseId}/rewards`)}
          >
            <div className="cd-record-card__body">
              <p className="cd-record-card__label">Shared across courses</p>
              <p className="cd-record-card__title">Your learning record</p>
              <p className="cd-record-card__desc">
                {[
                  pointsEarned > 0 ? `${pointsEarned} points from this course` : null,
                  badgesCount === 1 ? '1 badge earned' : badgesCount > 1 ? `${badgesCount} badges earned` : null,
                ].filter(Boolean).join(' · ')}
              </p>
            </div>
            <span className="cd-lesson-row__chevron">
              <ChevronRightIcon />
            </span>
          </button>
        )}

        {/* Lesson sections */}
        {sections.map((section) => (
          <div key={section.sectionId} className="cd-section">
            <h2 className="cd-section__heading">{section.sectionTitle}</h2>
            {section.lessons.map((lesson, idx) => {
              const state = getLessonState(lesson, resumeSequenceId, lessons, courseComplete);
              return (
                <LessonRow
                  key={lesson.sequenceId}
                  lesson={lesson}
                  state={state}
                  isLast={idx === section.lessons.length - 1}
                  onClick={() => handleLessonClick(lesson.sequenceId)}
                />
              );
            })}
          </div>
        ))}

          {lessons.length === 0 && (
            <p style={{ color: 'var(--u-content-secondary)', textAlign: 'center', padding: '2rem 0' }}>
              No lessons are available yet.
            </p>
          )}
        </main>
      </div>

      <footer className="course-footer">
        <button type="button" className="course-footer__primary" onClick={handleContinue}>
          {ctaLabel}
        </button>
      </footer>

      {blockedAssessment && (
        <RetryOverlay
          blockedReason={blockedAssessment.reason}
          retryAfterSeconds={blockedAssessment.retryAfterSeconds}
          unlocksAt={blockedAssessment.unlocksAt}
          onClose={() => setBlockedAssessment(null)}
        />
      )}
    </div>
  );
};
