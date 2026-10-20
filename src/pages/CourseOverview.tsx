import React from 'react';
import {
  useParams, useNavigate, useLocation, Navigate,
} from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getResumeBlock, getSequenceMetadata } from '../api/courseware';
import { getCourseMaxPoints } from '../api/gamification';
import { qk } from '../api/queries';
import { useCourseOutline } from '../hooks/useCourseOutline';
import { mapOutlineToLessons, findNextLessonIndex } from '../lib/outline-mapper';
import type { LessonDescriptor } from '../lib/outline-mapper';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { SlowLoadView } from '../components/slow-load-view/SlowLoadView';
import { useSlowLoad } from '../hooks/useSlowLoad';
import { useGamification } from '../hooks/useGamification';
import { useCurriculums } from '../hooks/useCurriculums';
import { useCourseProgressSummary } from '../hooks/useCourseProgressSummary';
import { useLearnCourses } from '../hooks/useLearnCourses';
import { useBadges } from '../hooks/useBadges';
import { NotEnrolledPage } from './NotEnrolledPage';
import { OfflineView } from '../components/offline-view/OfflineView';
import { useOffline } from '../hooks/useOffline';
import scenePhoto from '../assets/images/scene-safety-education.png';
import iconCheckWhite from '../assets/icons/icon-check-white.svg';
import iconLock from '../assets/icons/icon-lock.svg';
import iconNodeCurrent from '../assets/icons/icon-node-current.svg';
import iconChevronRight from '../assets/icons/chevron-right.svg';
import iconArrowLeft from '../assets/icons/icon-arrow-left.svg';
import courseArtBook from '../assets/icons/course-art-book.svg';
import './course-page.scss';

/** @deprecated The auto-resume redirect has been removed. This is a no-op kept for test compatibility. */
// eslint-disable-next-line @typescript-eslint/no-empty-function
export function resetResumedLocationKeys(): void {}

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
  _allLessons: LessonDescriptor[],
  courseComplete: boolean,
): LessonState {
  // Use the outline's per-sequence complete flag as the source of truth.
  // Do NOT derive completion from resume pointer position — a lesson before
  // the resume point is not necessarily complete (e.g. first visit, skipped).
  if (courseComplete || lesson.complete) { return 'complete'; }
  if (lesson.sequenceId === resumeSequenceId) { return 'current'; }
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

  // Upcoming — locked, not interactive
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

const SceneHeader = ({ onBack, imageUrl }: { onBack: () => void; imageUrl?: string | null }) => (
  <div className="cp-scene-header">
    <img
      src={imageUrl || scenePhoto}
      alt=""
      className="cp-scene-header__photo"
      onError={(e) => { (e.currentTarget as HTMLImageElement).src = scenePhoto; }}
    />
    <button type="button" className="cp-back-btn" onClick={onBack} aria-label="Back">
      <img src={iconArrowLeft} alt="" className="cp-back-btn__icon" />
    </button>
  </div>
);

const getPointsText = (
  maxPoints: number | null,
  pointsEarned: number,
  fraction: number,
  completedLessons: number,
): string => {
  if (maxPoints === null) { return `${pointsEarned} points earned`; }
  if (fraction > 0 || completedLessons > 0) { return `${Math.min(pointsEarned, maxPoints)} of ${maxPoints} points earned`; }
  return `Earn up to ${maxPoints} points`;
};

// ── CourseOverview page ────────────────────────────────────────────────────

export const CourseOverview = () => {
  const { courseId = '' } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const { data: enrolledCourses, isLoading: enrolledLoading } = useLearnCourses();
  const learnCourse = enrolledCourses?.find((c) => c.courseId === courseId);
  const isEnrolled = enrolledLoading || (enrolledCourses?.some((c) => c.courseId === courseId) ?? true);
  const isOffline = useOffline();

  const { data: gamification } = useGamification();
  const { data: curriculums } = useCurriculums();
  const { data: progressSummary } = useCourseProgressSummary(courseId);
  const { data: badgesData } = useBadges();
  const { data: maxPointsData } = useQuery({
    queryKey: qk.courseMaxPoints(courseId),
    queryFn: () => getCourseMaxPoints(courseId),
    enabled: Boolean(courseId),
    staleTime: 30 * 60_000,
  });

  const courseBadgeEntry = badgesData?.course_badges.find(
    (b) => b.source.type === 'course' && b.source.course_id === courseId,
  );
  const courseBadgeEarned = courseBadgeEntry?.awarded ?? false;
  const courseBadgeImageUrl = courseBadgeEntry?.badge.image_url ?? null;

  // Derive optional: course is optional when it does not belong to any curriculum.
  // Default to false (required) while curriculums are still loading to avoid a header flash.
  const parentCurriculum = curriculums?.find((c) => (
    c.courses.some((course) => course.course_id === courseId)
    || c.knowledge_check?.course_id === courseId
  ));
  const kicker = parentCurriculum ? `Required · ${parentCurriculum.title}` : null;
  const courseInCurriculum = parentCurriculum?.courses.find((c) => c.course_id === courseId);
  const courseDescription = courseInCurriculum?.description ?? null;
  const courseImageUrl = courseInCurriculum?.image_url || null;

  const resumeQuery = useQuery({
    queryKey: qk.resume(courseId),
    queryFn: () => getResumeBlock(courseId),
    enabled: Boolean(courseId),
    staleTime: 0,
  });

  const outlineQuery = useCourseOutline(courseId);
  const isSlowLoad = useSlowLoad(outlineQuery.isLoading || resumeQuery.isLoading);

  const earlyLessons = outlineQuery.data ? mapOutlineToLessons(outlineQuery.data) : [];
  const earlyNextIdx = findNextLessonIndex(earlyLessons);
  const continueSeqId = earlyNextIdx >= 0
    ? earlyLessons[earlyNextIdx].sequenceId
    : (resumeQuery.data?.sectionId ?? earlyLessons[0]?.sequenceId ?? '');

  // Pre-fetch the continue sequence's unit list so handleContinue can jump to the first
  // incomplete step without an extra round-trip on click. The button shows "Loading…" while
  // this is in-flight, acting as a race guard against tapping before units are ready.
  const continueSeqMetaQuery = useQuery({
    queryKey: qk.sequence(continueSeqId),
    queryFn: () => getSequenceMetadata(continueSeqId),
    enabled: Boolean(continueSeqId),
    staleTime: 5 * 60_000,
  });
  const isSequenceMetaLoading = continueSeqMetaQuery.isLoading && Boolean(continueSeqId);

  const stateRaw = location.state as { origin?: string; parentOrigin?: string } | null;
  const origin = stateRaw?.origin ?? null;
  const parentOrigin = stateRaw?.parentOrigin ?? null;

  const handleBack = () => {
    if (origin) {
      navigate(origin, parentOrigin ? { state: { origin: parentOrigin } } : undefined);
    } else {
      navigate('/');
    }
  };

  if (!isEnrolled) {
    return <NotEnrolledPage onClose={() => navigate('/')} />;
  }

  if (isOffline) {
    const courseTitle = outlineQuery.data?.title ?? '';
    return (
      <OfflineView
        title={courseTitle}
        onBack={handleBack}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (outlineQuery.isLoading || resumeQuery.isLoading) {
    if (isSlowLoad) {
      const courseDisplayName = parentCurriculum?.courses.find((c) => c.course_id === courseId)?.display_name ?? '';
      return (
        <SlowLoadView
          navTitle={courseDisplayName}
          onBack={handleBack}
          onRetry={() => { outlineQuery.refetch(); resumeQuery.refetch(); }}
        />
      );
    }
    return (
      <div className="course-page">
        <SceneHeader onBack={handleBack} imageUrl={courseImageUrl} />
        <div className="course-scroll">
          <LoadingSkeleton />
        </div>
        <footer className="course-footer">
          <button type="button" className="course-footer__primary course-footer__primary--loading" disabled>
            Loading…
          </button>
        </footer>
      </div>
    );
  }

  if (outlineQuery.isError) {
    const status = (outlineQuery.error as { response?: { status?: number } } | null)
      ?.response?.status;
    if (status === 404) {
      return <Navigate to={`/course/${courseId}/unavailable`} replace />;
    }
    const courseDisplayName = outlineQuery.data?.title
      ?? parentCurriculum?.courses.find((c) => c.course_id === courseId)?.display_name
      ?? '';
    return (
      <SlowLoadView
        navTitle={courseDisplayName}
        onBack={handleBack}
        onRetry={() => outlineQuery.refetch()}
      />
    );
  }

  const lessons = earlyLessons;
  const sections = groupBySection(lessons);

  const apiResumeSequenceId = resumeQuery.data?.sectionId ?? null;
  const fraction = progressSummary?.fraction ?? 0;
  const courseComplete = fraction >= 1;
  const pointsEarned = gamification?.courses?.find((c) => c.course_key === courseId)?.points ?? 0;
  const maxPoints = maxPointsData?.max_points ?? null;

  const resumeSequenceId = apiResumeSequenceId;

  // Lesson counts come from the outline's per-sequence `complete` flag. `fraction` is a
  // UNIT ratio from the progress API and must not be scaled into a lesson count.
  const totalLessons = lessons.length;
  const completedLessons = courseComplete
    ? totalLessons
    : lessons.filter((l) => l.complete).length;
  const nextLessonIdx = earlyNextIdx;

  const lessonState = origin ? { origin } : undefined;

  const getStepIdxFromMeta = (seqId: string): number => {
    // Use pre-fetched data when available (same query key); fall back to 0.
    const cached = queryClient.getQueryData<{ units: { complete: boolean }[] }>(qk.sequence(seqId));
    const units = cached?.units ?? [];
    const firstIncomplete = units.findIndex((u) => !u.complete);
    return Math.max(0, firstIncomplete);
  };

  const handleContinue = () => {
    if (courseComplete) {
      navigate(`/course/${courseId}/complete`);
      return;
    }
    // When the learner has progress, the LMS resume block may still point to an already-completed
    // lesson because BlockCompletion is only written when a unit's Continue is clicked. Jump to the
    // first lesson the outline reports as incomplete instead.
    if ((fraction > 0 || completedLessons > 0) && nextLessonIdx >= 0) {
      const targetLesson = lessons[nextLessonIdx];
      // nextStep is pre-computed by the backend batch API — no sequence API call needed.
      const backendStep = learnCourse?.nextLesson?.nextStep;
      const stepIdx = backendStep != null ? backendStep : getStepIdxFromMeta(targetLesson.sequenceId);
      navigate(`/course/${courseId}/lesson/${targetLesson.sequenceId}/step/${stepIdx}`, { state: lessonState });
      return;
    }
    if (resumeSequenceId) {
      const stepIdx = getStepIdxFromMeta(resumeSequenceId);
      navigate(`/course/${courseId}/lesson/${resumeSequenceId}/step/${stepIdx}`, { state: lessonState });
      return;
    }
    const firstLesson = lessons[0];
    if (firstLesson) {
      navigate(`/course/${courseId}/lesson/${firstLesson.sequenceId}/step/0`, { state: lessonState });
    }
  };

  const handleLessonClick = (sequenceId: string) => {
    navigate(`/course/${courseId}/lesson/${sequenceId}/step/0`, { state: lessonState });
  };

  const handleKcRetry = () => {
    const firstLesson = lessons[0];
    if (firstLesson) {
      navigate(`/course/${courseId}/lesson/${firstLesson.sequenceId}/step/0`, { state: lessonState });
    }
  };

  let ctaLabel = 'Start course';
  if (courseComplete) { ctaLabel = 'Review course'; } else if (learnCourse?.status !== 'not_started' || fraction > 0 || resumeSequenceId) { ctaLabel = 'Continue course'; }

  const showProgress = true;
  const isKnowledgeCheckCourse = parentCurriculum?.knowledge_check?.course_id === courseId;
  const retentionPassed = parentCurriculum?.milestones?.retained?.reached_at != null;
  const hideFooter = isKnowledgeCheckCourse && courseComplete && retentionPassed;
  const showKcRetry = isKnowledgeCheckCourse && courseComplete && !retentionPassed;

  return (
    <div className="course-page">
      <SceneHeader onBack={handleBack} imageUrl={courseImageUrl} />

      <div className="course-scroll">
        <main className="course-content">
          {/* Heading block */}
          <div className="course-heading">
            {kicker && <p className="cd-kicker">{kicker}</p>}
            <h1 className="cd-title">{outlineQuery.data?.title ?? 'Course'}</h1>
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
                  {completedLessons > 0 && (
                    <div
                      className="cd-progress-fill"
                      style={{ width: `${Math.round((completedLessons / Math.max(totalLessons, 1)) * 100)}%` }}
                    />
                  )}
                </div>
                {(maxPoints !== null ? maxPoints > 0 : pointsEarned > 0) && (
                  <p className="cd-progress-points">
                    {getPointsText(maxPoints, pointsEarned, fraction, completedLessons)}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="cd-course-progress__seal"
                aria-label={courseBadgeEarned ? 'Course badge earned — view' : 'View course badge'}
                onClick={() => navigate('/progress')}
              >
                <div className={`cd-badge-seal${courseBadgeEarned ? ' cd-badge-seal--earned' : ''}`}>
                  <img
                    src={courseBadgeImageUrl ?? courseArtBook}
                    alt=""
                    className={`cd-badge-seal__icon${courseBadgeImageUrl ? ' cd-badge-seal__icon--badge' : ''}`}
                    aria-hidden="true"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = courseArtBook; }}
                  />
                </div>
              </button>
            </div>
          )}

          {/* Units / path steps */}
          {sections.map((section, sectionIdx) => {
            const sectionLessonStates = section.lessons.map(
              (lesson) => getLessonState(lesson, resumeSequenceId, lessons, courseComplete),
            );
            const unitState = getUnitState(section.lessons, sectionLessonStates);
            return (
              <div key={section.sectionId} className="cp-unit-section">
                <UnitBanner
                  index={sectionIdx}
                  title={section.sectionTitle}
                  state={unitState}
                  lessonStates={sectionLessonStates}
                  totalLessons={section.lessons.length}
                />
                {section.lessons.map((lesson, lessonIdx) => {
                  const stepState = sectionLessonStates[lessonIdx];
                  const lineAbove = lessonIdx > 0;
                  const lineBelow = lessonIdx < section.lessons.length - 1;
                  return (
                    <PathStep
                      key={lesson.sequenceId}
                      title={lesson.lessonTitle}
                      state={stepState}
                      detail={stepState === 'complete' ? 'Complete' : ''}
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
            <p className="course-page__empty-note">
              No lessons are available yet.
            </p>
          )}
        </main>
      </div>

      {!hideFooter && (
        <footer className="course-footer">
          {showKcRetry ? (
            <button type="button" className="course-footer__primary" onClick={handleKcRetry}>
              Try final check again
            </button>
          ) : (
            <button
              type="button"
              className={`course-footer__primary${isSequenceMetaLoading ? ' course-footer__primary--loading' : ''}`}
              onClick={handleContinue}
              disabled={isSequenceMetaLoading}
            >
              {isSequenceMetaLoading ? 'Loading…' : ctaLabel}
            </button>
          )}
        </footer>
      )}
    </div>
  );
};
