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
import type { AssessmentState } from '../api/progress';
import scenePhoto from '../assets/images/scene-safety-education.png';
import iconCheckWhite from '../assets/icons/icon-check-white.svg';
import iconLock from '../assets/icons/icon-lock.svg';
import iconNodeCurrent from '../assets/icons/icon-node-current.svg';
import iconChevronRight from '../assets/icons/chevron-right.svg';
import iconArrowLeft from '../assets/icons/icon-arrow-left.svg';
import courseArtSteering from '../assets/icons/course-art-steering.svg';
import courseArtLime from '../assets/icons/course-art-lime.svg';
import courseArtMagenta from '../assets/icons/course-art-magenta.svg';
import courseArtPurple from '../assets/icons/course-art-purple.svg';
import './course-page.css';

// ── Types ──────────────────────────────────────────────────────────────────

type BlockedReason = NonNullable<AssessmentState['blockedReason']>;

interface BlockedAssessmentState {
  reason: BlockedReason;
  retryAfterSeconds: number;
  unlocksAt: string | null;
}

type LessonState = 'complete' | 'current' | 'upcoming';

type UnitState = 'done' | 'current' | 'upcoming';

interface LessonSection {
  sectionId: string;
  sectionTitle: string;
  lessons: LessonDescriptor[];
}

// ── Static course config ───────────────────────────────────────────────────

interface CourseConfig {
  optional: boolean;
  art: string;
  kicker: string;
}

const COURSE_CONFIG: Record<string, CourseConfig> = {
  'getting-started':    { optional: true, art: courseArtSteering, kicker: 'Optional' },
  'vehicle-maintenance': { optional: true, art: courseArtPurple,   kicker: 'Optional' },
  'tough-situations':   { optional: true, art: courseArtMagenta,   kicker: 'Optional' },
};

const DEFAULT_CONFIG: CourseConfig = {
  optional: false,
  art: courseArtLime,
  kicker: 'Required · Safety',
};

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
      map.set(lesson.sectionId, { sectionId: lesson.sectionId, sectionTitle: lesson.sectionTitle, lessons: [] });
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

function getUnitState(_lessons: LessonDescriptor[], lessonStates: LessonState[]): UnitState {
  if (lessonStates.every((s) => s === 'complete')) { return 'done'; }
  if (lessonStates.some((s) => s === 'current')) { return 'current'; }
  const doneCount = lessonStates.filter((s) => s === 'complete').length;
  if (doneCount > 0) { return 'current'; }
  return 'upcoming';
}

// ── Path step component ────────────────────────────────────────────────────

interface PathStepProps {
  title: string;
  state: LessonState;
  detail: string;
  lineAbove: boolean;
  lineBelow: boolean;
  onClick?: () => void;
}

const PathStep = ({
  title, state, detail, lineAbove, lineBelow, onClick,
}: PathStepProps) => {
  if (state === 'current') {
    return (
      <div className="cp-path-step">
        <div className="cp-path-step__rail">
          <div className="cp-path-step__rail-above cp-path-step__rail-above--sm">
            {lineAbove && <div className="cp-path-step__rail-line" />}
          </div>
          <div className="cp-path-step__node-current">
            <img src={iconNodeCurrent} alt="" className="cp-path-step__node-current-img" />
          </div>
          <div className="cp-path-step__rail-below">
            {lineBelow && <div className="cp-path-step__rail-line" />}
          </div>
        </div>
        <div className="cp-up-next-wrap">
          <button type="button" className="cp-up-next-card" onClick={onClick}>
            <div className="cp-up-next-card__body">
              <p className="cp-up-next-card__label">Up next</p>
              <p className="cp-up-next-card__title">{title}</p>
              <p className="cp-up-next-card__detail">{detail || 'In progress'}</p>
            </div>
            <img src={iconChevronRight} alt="" className="cp-path-step__chevron-img" />
          </button>
        </div>
      </div>
    );
  }

  const isComplete = state === 'complete';

  if (isComplete) {
    return (
      <button type="button" className="cp-path-step" onClick={onClick}>
        <div className="cp-path-step__rail">
          <div className="cp-path-step__rail-above">
            {lineAbove && <div className="cp-path-step__rail-line" />}
          </div>
          <div className="cp-path-step__node cp-path-step__node--complete">
            <img src={iconCheckWhite} alt="" className="cp-path-step__node-icon" />
          </div>
          <div className="cp-path-step__rail-below">
            {lineBelow && <div className="cp-path-step__rail-line" />}
          </div>
        </div>
        <div className="cp-path-step__body">
          <p className="cp-path-step__title">{title}</p>
          <p className="cp-path-step__detail cp-path-step__detail--complete">Complete</p>
        </div>
        <div className="cp-path-step__chevron-wrap">
          <img src={iconChevronRight} alt="" className="cp-path-step__chevron-img" />
        </div>
      </button>
    );
  }

  // Upcoming
  return (
    <div className="cp-path-step">
      <div className="cp-path-step__rail">
        <div className="cp-path-step__rail-above">
          {lineAbove && <div className="cp-path-step__rail-line" />}
        </div>
        <div className="cp-path-step__node cp-path-step__node--upcoming">
          <img src={iconLock} alt="" className="cp-path-step__node-icon" />
        </div>
        <div className="cp-path-step__rail-below">
          {lineBelow && <div className="cp-path-step__rail-line" />}
        </div>
      </div>
      <div className="cp-path-step__body cp-path-step__body--dim">
        <p className="cp-path-step__title">{title}</p>
        {detail && <p className="cp-path-step__detail">{detail}</p>}
      </div>
    </div>
  );
};

// ── Unit banner component ──────────────────────────────────────────────────

interface UnitBannerProps {
  index: number;
  title: string;
  state: UnitState;
  lessonStates: LessonState[];
  totalLessons: number;
}

const UnitBanner = ({
  index, title, state, lessonStates, totalLessons,
}: UnitBannerProps) => {
  const doneCount = lessonStates.filter((s) => s === 'complete').length;
  let statusText: string;
  if (state === 'done') {
    statusText = `${doneCount} of ${totalLessons} done`;
  } else if (state === 'current') {
    statusText = `${doneCount} of ${totalLessons} done`;
  } else {
    statusText = `${totalLessons} lesson${totalLessons !== 1 ? 's' : ''}`;
  }

  return (
    <div className={`cp-unit-banner cp-unit-banner--${state}`}>
      <div className="cp-unit-banner__words">
        <p className="cp-unit-banner__label">Unit {index + 1}</p>
        <p className="cp-unit-banner__name">{title}</p>
      </div>
      <p className="cp-unit-banner__status">{statusText}</p>
    </div>
  );
};

// ── Scene header ──────────────────────────────────────────────────────────

const SceneHeader = ({ onBack }: { onBack: () => void }) => (
  <div className="cp-scene-header">
    <img src={scenePhoto} alt="" className="cp-scene-header__photo" />
    <button type="button" className="cp-back-btn" onClick={onBack} aria-label="Back">
      <img src={iconArrowLeft} alt="" className="cp-back-btn__icon" />
    </button>
  </div>
);

// ── Art panel header ──────────────────────────────────────────────────────

const ArtPanel = ({
  art, color, onBack,
}: { art: string; color: 'blue' | 'green'; onBack: () => void }) => (
  <div className={`cp-art-panel cp-art-panel--${color}`}>
    <div className="cp-art-panel__halo">
      <div className="cp-art-panel__disc">
        <img src={art} alt="" className="cp-art-panel__art" />
      </div>
    </div>
    <button type="button" className="cp-back-btn" onClick={onBack} aria-label="Back">
      <img src={iconArrowLeft} alt="" className="cp-back-btn__icon" />
    </button>
  </div>
);

// ── CourseOverview page ────────────────────────────────────────────────────

export const CourseOverview = () => {
  const { courseId = '' } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [blockedAssessment, setBlockedAssessment] = useState<BlockedAssessmentState | null>(null);

  const config = COURSE_CONFIG[courseId] ?? DEFAULT_CONFIG;

  const resumeQuery = useQuery({
    queryKey: qk.resume(courseId),
    queryFn: () => getResumeBlock(courseId),
    enabled: Boolean(courseId),
    staleTime: 0,
  });

  const outlineQuery = useCourseOutline(courseId);
  const { data: progressData } = useProgress(courseId);

  const handleBack = () => navigate('/');

  if (outlineQuery.isLoading || resumeQuery.isLoading) {
    return (
      <div className="course-page">
        {config.optional
          ? <ArtPanel art={config.art} color="blue" onBack={handleBack} />
          : <SceneHeader onBack={handleBack} />}
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
  const courseComplete = progressData?.courseComplete ?? false;
  const pointsEarned = progressData?.points?.earned ?? 0;

  const apiResumeIdx = apiResumeSequenceId
    ? lessons.findIndex((r) => r.sequenceId === apiResumeSequenceId)
    : -1;
  const storedResumeIdx = getStoredResumeIdx(courseId, lessons);
  const effectiveResumeIdx = Math.max(apiResumeIdx, storedResumeIdx);
  const resumeSequenceId = effectiveResumeIdx >= 0
    ? lessons[effectiveResumeIdx].sequenceId
    : (getStoredResumeSequenceId(courseId) ?? apiResumeSequenceId);

  const completedLessons = courseComplete
    ? lessons.length
    : effectiveResumeIdx > 0 ? effectiveResumeIdx : 0;
  const totalLessons = lessons.length;
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
    ? 'Review course'
    : resumeSequenceId
      ? 'Continue course'
      : 'Start course';

  const showProgress = (effectiveFraction > 0 || completedLessons > 0) && !config.optional;
  const showLearningRecord = pointsEarned > 0 && !config.optional;

  return (
    <div className="course-page">
      {config.optional
        ? <ArtPanel art={config.art} color="blue" onBack={handleBack} />
        : <SceneHeader onBack={handleBack} />}

      <div className="course-scroll">
        <main className="course-content">
          {/* Heading block */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p className="cd-kicker">{config.kicker}</p>
            <h1 className="cd-title">{outline?.title ?? 'Course'}</h1>
            <p className="cd-lead">
              {'Practical guidance for respectful boundaries, awareness, and safe reporting.'}
            </p>
          </div>

          {/* Progress */}
          {showProgress && (
            <div className="cd-progress">
              <div className="cd-progress-labels">
                <span className="cd-progress-label">
                  {`${completedLessons} of ${totalLessons} lesson${totalLessons !== 1 ? 's' : ''} complete`}
                </span>
                <span className="cd-progress-percent">{percentDisplay}</span>
              </div>
              <div className="cd-progress-track">
                <div className="cd-progress-fill" style={{ width: `${Math.round(effectiveFraction * 100)}%` }} />
              </div>
            </div>
          )}

          {/* Facts */}
          {totalLessons > 0 && (
            <p className="cd-facts">
              {`${totalLessons} lesson${totalLessons !== 1 ? 's' : ''}`}
            </p>
          )}

          {/* Learning record card */}
          {showLearningRecord && (
            <button
              type="button"
              className="cp-record-card"
              onClick={() => navigate(`/course/${courseId}/rewards`)}
            >
              <div className="cp-record-card__body">
                <p className="cp-record-card__title">{pointsEarned} points from this course</p>
                <p className="cp-record-card__desc">Part of your total on Your progress</p>
              </div>
              <img src={iconChevronRight} alt="" className="cp-record-card__chevron" />
            </button>
          )}

          {/* Lessons section heading for optional */}
          {config.optional && lessons.length > 0 && (
            <p className="cp-lessons-heading">Lessons</p>
          )}

          {/* Units / path steps */}
          {sections.map((section, sectionIdx) => {
            const sectionLessonStates = section.lessons.map((lesson) =>
              getLessonState(lesson, resumeSequenceId, lessons, courseComplete),
            );
            const unitState = getUnitState(section.lessons, sectionLessonStates);
            const showUnitBanner = !config.optional && sections.length >= 1;

            return (
              <div key={section.sectionId} className="cp-unit-section">
                {showUnitBanner && (
                  <UnitBanner
                    index={sectionIdx}
                    title={section.sectionTitle}
                    state={unitState}
                    lessonStates={sectionLessonStates}
                    totalLessons={section.lessons.length}
                  />
                )}
                {section.lessons.map((lesson, lessonIdx) => {
                  const lessonState = sectionLessonStates[lessonIdx];
                  const lineAbove = lessonIdx > 0;
                  const lineBelow = lessonIdx < section.lessons.length - 1;
                  return (
                    <PathStep
                      key={lesson.sequenceId}
                      title={lesson.lessonTitle}
                      state={lessonState}
                      detail={lessonState === 'complete' ? 'Complete' : ''}
                      lineAbove={lineAbove}
                      lineBelow={lineBelow}
                      onClick={() => handleLessonClick(lesson.sequenceId)}
                    />
                  );
                })}
              </div>
            );
          })}

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
