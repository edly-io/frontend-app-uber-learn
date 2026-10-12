import React, { useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

// Tracks location keys that have already triggered auto-resume to prevent
// back navigation from the lesson screen from re-firing the redirect.
const resumedLocationKeys = new Set<string>();

export function resetResumedLocationKeys(): void {
  resumedLocationKeys.clear();
}
import { useQuery } from '@tanstack/react-query';
import { getResumeBlock } from '../api/courseware';
import { qk } from '../api/queries';
import { useCourseOutline } from '../hooks/useCourseOutline';
import { mapOutlineToLessons } from '../lib/outline-mapper';
import type { LessonDescriptor } from '../lib/outline-mapper';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorView } from '../components/ui/ErrorView';
import { useGamification } from '../hooks/useGamification';
import { useCurriculums } from '../hooks/useCurriculums';
import { useCourseProgressSummary } from '../hooks/useCourseProgressSummary';
import scenePhoto from '../assets/images/scene-safety-education.png';
import iconCheckWhite from '../assets/icons/icon-check-white.svg';
import iconLock from '../assets/icons/icon-lock.svg';
import iconNodeCurrent from '../assets/icons/icon-node-current.svg';
import iconChevronRight from '../assets/icons/chevron-right.svg';
import iconArrowLeft from '../assets/icons/icon-arrow-left.svg';
import courseArtBook from '../assets/icons/course-art-book.svg';
import courseArtSteering from '../assets/icons/course-art-steering.svg';
import './course-page.scss';

// ── Types ──────────────────────────────────────────────────────────────────

type LessonState = 'complete' | 'current' | 'upcoming';

type UnitState = 'done' | 'current' | 'upcoming';

interface LessonSection {
  sectionId: string;
  sectionTitle: string;
  lessons: LessonDescriptor[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

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

  // Upcoming — still clickable so learners can open any lesson
  return (
    <button type="button" className="cp-path-step" onClick={onClick}>
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
    </button>
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
  const location = useLocation();

  const { data: gamification } = useGamification();
  const { data: curriculums } = useCurriculums();
  const { data: progressSummary } = useCourseProgressSummary(courseId);

  // Derive optional: course is optional when it does not belong to any curriculum.
  // Default to false (required) while curriculums are still loading to avoid a header flash.
  const isOptional = curriculums !== undefined
    ? !curriculums.some((c) => c.courses.some((course) => course.course_id === courseId))
    : false;
  const parentCurriculum = curriculums?.find((c) => c.courses.some((course) => course.course_id === courseId));
  let kicker: string;
  if (isOptional) {
    kicker = 'Optional';
  } else if (parentCurriculum) {
    kicker = `Required · ${parentCurriculum.title}`;
  } else {
    kicker = 'Required';
  }
  const courseDescription = parentCurriculum?.courses.find((c) => c.course_id === courseId)?.description ?? null;
  const config = {
    optional: isOptional,
    // TODO: no API provides per-course art — using a shared default
    art: courseArtSteering,
    kicker,
  };

  const resumeQuery = useQuery({
    queryKey: qk.resume(courseId),
    queryFn: () => getResumeBlock(courseId),
    enabled: Boolean(courseId),
    staleTime: 0,
  });

  const outlineQuery = useCourseOutline(courseId);

  // Auto-navigate returning users to their last position — must be before early returns.
  // Guard against re-firing when the learner navigates *back* from a lesson:
  // React Router preserves the same location.key on back navigation, so keying
  // on courseId+location.key ensures we fire at most once per history entry.
  const isCourseFinished = parentCurriculum?.courses.find((c) => c.course_id === courseId)?.finished === true;
  const apiResumeSequenceIdForEffect = resumeQuery.data?.sectionId ?? null;
  const resumeKey = `${courseId}:${location.key}`;
  useEffect(() => {
    if (apiResumeSequenceIdForEffect && !resumedLocationKeys.has(resumeKey) && !isCourseFinished) {
      resumedLocationKeys.add(resumeKey);
      navigate(`/course/${courseId}/lesson/${apiResumeSequenceIdForEffect}/step/0`, { replace: true });
    }
  }, [apiResumeSequenceIdForEffect, courseId, isCourseFinished, navigate, resumeKey]);

  const handleBack = () => navigate(-1);

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
    const courseDisplayName = outlineQuery.data?.title
      ?? parentCurriculum?.courses.find((c) => c.course_id === courseId)?.display_name
      ?? 'Course';
    return (
      <ErrorView
        title="Could not load course"
        message="We could not retrieve the course outline. Please try again."
        onRetry={() => outlineQuery.refetch()}
        navTitle={courseDisplayName}
        onBack={handleBack}
      />
    );
  }

  const outline = outlineQuery.data;
  const lessons = outline ? mapOutlineToLessons(outline) : [];
  const sections = groupBySection(lessons);

  const apiResumeSequenceId = resumeQuery.data?.sectionId ?? null;
  const fraction = progressSummary?.fraction ?? 0;
  const courseComplete = fraction >= 1;
  const pointsEarned = gamification?.courses?.find((c) => c.course_key === courseId)?.points ?? 0;

  const resumeSequenceId = apiResumeSequenceId;

  const totalLessons = lessons.length;
  const completedLessons = courseComplete
    ? totalLessons
    : Math.round(fraction * totalLessons);

  const handleContinue = () => {
    if (courseComplete) {
      navigate(`/course/${courseId}/complete`);
      return;
    }
    if (resumeSequenceId) {
      navigate(`/course/${courseId}/lesson/${resumeSequenceId}/step/0`);
      return;
    }
    navigate(`/course/${courseId}/intro`);
  };

  const handleLessonClick = (sequenceId: string) => {
    navigate(`/course/${courseId}/lesson/${sequenceId}/step/0`);
  };

  let ctaLabel = 'Start course';
  if (courseComplete) { ctaLabel = 'Review course'; } else if (resumeSequenceId) { ctaLabel = 'Continue course'; }

  const showProgress = !config.optional;
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
            {courseDescription && <p className="cd-lead">{courseDescription}</p>}
          </div>

          {/* Course progress row */}
          {showProgress && (
            <div className="cd-course-progress">
              <div className="cd-course-progress__bar-col">
                <p className="cd-progress-label">
                  {`${completedLessons} of ${totalLessons} lesson${totalLessons !== 1 ? 's' : ''} complete`}
                </p>
                <div className="cd-progress-track">
                  {fraction > 0 && (
                    <div
                      className="cd-progress-fill"
                      style={{ width: `${Math.round(fraction * 100)}%` }}
                    />
                  )}
                </div>
                {gamification?.lifetime_points != null && gamification.lifetime_points > 0 ? (
                  <p className="cd-progress-points">
                    {`${gamification.lifetime_points} points earned`}
                  </p>
                ) : (
                  <p className="cd-progress-points">Earn points</p>
                )}
              </div>
              <button
                type="button"
                className="cd-course-progress__seal"
                aria-label="View course badge"
                onClick={() => navigate('/progress')}
              >
                <div className="cd-badge-seal">
                  <img src={courseArtBook} alt="" className="cd-badge-seal__icon" aria-hidden="true" />
                </div>
              </button>
            </div>
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
            const sectionLessonStates = section.lessons.map(
              (lesson) => getLessonState(lesson, resumeSequenceId, lessons, courseComplete),
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

    </div>
  );
};
