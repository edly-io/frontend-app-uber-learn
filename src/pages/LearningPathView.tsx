import React from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { useCurriculums } from '../hooks/useCurriculums';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorView } from '../components/ui/ErrorView';
import type { LearnerCurriculum } from '../api/curriculum';
import { getCourseOutline, type CourseOutline } from '../api/courseware';
import { qk } from '../api/queries';

import scenePhoto from '../assets/images/scene-safety-education.png';
import iconArrowLeft from '../assets/icons/icon-arrow-left.svg';
import iconBadgeCheck from '../assets/icons/icon-badge-check.svg';
import iconChevronRight from '../assets/icons/chevron-right.svg';
import './learning-path-view.scss';

// ── Outline-derived card data ─────────────────────────────

interface CourseCardInfo {
  category: string | null;
  nextLesson: string | null;
  totalLessons: number;
  progressFraction: number;
}

const EMPTY_INFO: CourseCardInfo = {
  category: null,
  nextLesson: null,
  totalLessons: 0,
  progressFraction: 0,
};

function extractCardInfo(outline: CourseOutline | undefined): CourseCardInfo {
  if (!outline) { return EMPTY_INFO; }

  // Walk sections in insertion order (matches course structure order from API)
  const orderedSeqs = Object.values(outline.sections).flatMap(
    (section) => section.sequenceIds
      .map((id) => outline.sequences[id])
      .filter(Boolean),
  );

  const totalLessons = orderedSeqs.length;
  const completedLessons = orderedSeqs.filter((s) => s.complete).length;
  const progressFraction = totalLessons > 0 ? completedLessons / totalLessons : 0;
  const nextLesson = orderedSeqs.find((s) => !s.complete)?.title ?? null;
  const category = Object.values(outline.sections)[0]?.title ?? null;

  return {
    category, nextLesson, totalLessons, progressFraction,
  };
}

// ── Lock icon ─────────────────────────────────────────────

const LockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <rect x="2" y="5" width="8" height="6" rx="1" fill="currentColor" />
    <path d="M4 5V3.5a2 2 0 0 1 4 0V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

// ── Milestone badge ───────────────────────────────────────

interface MilestoneBadgeProps {
  slot: 'complete' | 'retained';
  curriculum: LearnerCurriculum;
}

const MilestoneBadge = ({ slot, curriculum }: MilestoneBadgeProps) => {
  const milestone = curriculum.milestones[slot];
  const earned = milestone?.reached_at != null;
  const isRetained = slot === 'retained';
  const locked = isRetained && !curriculum.knowledge_check.is_open && !earned;
  const imageUrl = milestone?.badge?.image_url ?? null;
  const title = milestone?.badge?.title ?? (isRetained ? '30-day check' : 'Path badge');

  let toGo: number | null;
  if (isRetained) {
    toGo = curriculum.knowledge_check.is_open ? null : curriculum.courses_total - curriculum.courses_finished;
  } else {
    toGo = curriculum.courses_total - curriculum.courses_finished;
  }

  const lockedCls = locked ? ' lp-milestone__img--locked' : '';

  return (
    <div className="lp-milestone">
      <div className="lp-milestone__art">
        <img
          src={imageUrl ?? iconBadgeCheck}
          alt=""
          className={imageUrl ? `lp-milestone__img${lockedCls}` : `lp-milestone__icon${lockedCls}`}
          aria-hidden="true"
          onError={(e) => {
            const img = e.currentTarget;
            img.src = iconBadgeCheck;
            img.className = `lp-milestone__icon${lockedCls}`;
          }}
        />
      </div>
      <span className="lp-milestone__label">{title}</span>
      {earned && milestone?.reached_at && (
        <span className="lp-milestone__sub">
          {new Date(milestone.reached_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </span>
      )}
      {!earned && isRetained && curriculum.knowledge_check.is_open && (
        <span className="lp-milestone__sub">Open now</span>
      )}
      {!earned && isRetained && !curriculum.knowledge_check.is_open && curriculum.knowledge_check.unlocks_at && (
        <span className="lp-milestone__sub">
          {`Unlocks on ${new Date(curriculum.knowledge_check.unlocks_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
        </span>
      )}
      {!earned && !isRetained && toGo != null && toGo > 0 && (
        <span className="lp-milestone__sub">{toGo} to go</span>
      )}
      {locked && (
        <span className="lp-milestone__lock" aria-label="locked">
          <LockIcon />
        </span>
      )}
    </div>
  );
};

// ── Course card ───────────────────────────────────────────

interface CourseCardProps {
  courseId: string;
  displayName: string | null;
  imageUrl: string | null;
  finished: boolean;
  isCurrent: boolean;
  info: CourseCardInfo;
  onClick: () => void;
}

const CourseCard = ({
  courseId, displayName, imageUrl, finished, isCurrent, info, onClick,
}: CourseCardProps) => {
  const [imgFailed, setImgFailed] = React.useState(false);
  const showImg = imageUrl && !imgFailed;
  const pct = Math.round(info.progressFraction * 100);

  return (
    <button
      type="button"
      className={`lpv-course-card${finished ? ' lpv-course-card--complete' : ''}${isCurrent ? ' lpv-course-card--current' : ''}`}
      onClick={onClick}
      aria-label={`Open ${displayName ?? courseId}`}
    >
      <div className="lpv-course-card__thumb">
        {showImg ? (
          <img
            src={imageUrl!}
            alt=""
            aria-hidden="true"
            className="lpv-course-card__img"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <img src={scenePhoto} alt="" className="lpv-course-card__img" aria-hidden="true" />
        )}
      </div>
      <div className="lpv-course-card__body">
        {info.category && (
          <span className="lpv-course-card__category">{info.category}</span>
        )}
        <span className="lpv-course-card__title">{displayName ?? courseId}</span>
        {finished && (
          <span className="lpv-course-card__status lpv-course-card__status--complete">Complete</span>
        )}
        {isCurrent && !finished && (
          <>
            {info.nextLesson ? (
              <span className="lpv-course-card__status lpv-course-card__status--next">
                Next: {info.nextLesson}
              </span>
            ) : (
              <span className="lpv-course-card__status lpv-course-card__status--progress">In progress</span>
            )}
            <div
              className="lpv-course-card__bar-wrap"
              role="progressbar"
              aria-label="Course progress"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="lpv-course-card__bar-fill" style={{ width: `${pct}%` }} />
            </div>
          </>
        )}
        {!isCurrent && !finished && info.totalLessons > 0 && (
          <span className="lpv-course-card__status">
            {info.totalLessons} {info.totalLessons === 1 ? 'lesson' : 'lessons'}
          </span>
        )}
      </div>
      <img src={iconChevronRight} alt="" className="lpv-course-card__chevron" aria-hidden="true" />
    </button>
  );
};

// ── Main component ────────────────────────────────────────

export const LearningPathView = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { curriculumId } = useParams<{ curriculumId: string }>();
  const {
    data: curriculums, isLoading, isError, refetch,
  } = useCurriculums();

  const curriculum = curriculums?.find((c) => c.uuid === curriculumId);

  const sortedCourses = curriculum
    ? curriculum.courses.slice().sort((a, b) => a.position - b.position)
    : [];

  const nextCourse = sortedCourses.find((c) => !c.finished);

  // Fetch outlines for all courses in parallel to power category chip,
  // "Next: …", total lesson count, and progress fraction on each card.
  const outlineQueries = useQueries({
    queries: sortedCourses.map((course) => ({
      queryKey: qk.outline(course.course_id),
      queryFn: () => getCourseOutline(course.course_id),
      enabled: Boolean(curriculum),
      staleTime: 5 * 60_000,
    })),
  });

  // Build a course_id → CardInfo lookup
  const cardInfoMap: Record<string, CourseCardInfo> = {};
  sortedCourses.forEach((course, idx) => {
    cardInfoMap[course.course_id] = extractCardInfo(outlineQueries[idx]?.data);
  });

  const isComplete = curriculum
    ? curriculum.courses_finished > 0 && curriculum.courses_finished === curriculum.courses_total
    : false;

  const badgeArt = curriculum?.milestones?.complete?.badge?.image_url ?? iconBadgeCheck;

  // ── Footer CTA logic ───────────────────────────────────
  type CtaState = 'start' | 'continue' | 'check' | 'home';

  const getCtaState = (): CtaState => {
    if (!curriculum) { return 'home'; }
    const {
      courses_finished: coursesFinished,
      courses_total: coursesTotal,
      knowledge_check: knowledgeCheck,
      milestones,
    } = curriculum;
    if (coursesFinished === 0) { return 'start'; }
    if (coursesFinished < coursesTotal) { return 'continue'; }
    const checkDone = milestones.retained?.reached_at != null;
    if (checkDone) { return 'home'; }
    if (knowledgeCheck.exists && knowledgeCheck.is_open) { return 'check'; }
    return 'home';
  };

  const ctaState = getCtaState();
  const checkLabel = curriculum?.knowledge_check?.display_name ?? '30-day check';

  const lpvOrigin = (location.state as { origin?: string } | null)?.origin ?? null;
  const courseNavState = { origin: location.pathname, ...(lpvOrigin ? { parentOrigin: lpvOrigin } : {}) };

  const handleCta = () => {
    if (!curriculum) { navigate('/'); return; }
    if (ctaState === 'start' || ctaState === 'continue') {
      navigate(`/course/${nextCourse!.course_id}`, { state: courseNavState });
    } else if (ctaState === 'check') {
      navigate(`/course/${curriculum.knowledge_check.course_id}`, { state: courseNavState });
    } else {
      navigate('/');
    }
  };

  // Hero ring geometry — 96px, strokeWidth 4
  // r=40: track inner edge at 10px from container edge, exactly touching the disc outer edge (top/left: 10px)
  // so the SVG white track + disc white border read as one unified ring (Figma 757:8583)
  const RING = 96;
  const SW = 4;
  const cx = RING / 2;
  const r = 40;
  const circ = 2 * Math.PI * r;
  const progress = curriculum && curriculum.courses_total > 0
    ? Math.min(1, curriculum.courses_finished / curriculum.courses_total)
    : 0;
  const offset = circ * (1 - progress);

  return (
    <div className="lpv-page">
      {/* Nav */}
      <header className="lpv-nav">
        <button
          type="button"
          className="lpv-nav__back"
          aria-label="Go back"
          onClick={() => {
            const rawOrigin = (location.state as { origin?: string } | null)?.origin;
            // Validate origin is an internal path before navigating to it.
            const safeOrigin = typeof rawOrigin === 'string' && rawOrigin.startsWith('/') ? rawOrigin : null;
            if (safeOrigin) {
              navigate(safeOrigin);
            } else if (location.key === 'default') {
              navigate('/');
            } else {
              navigate(-1);
            }
          }}
        >
          <img src={iconArrowLeft} alt="" aria-hidden="true" className="lpv-nav__back-icon" />
        </button>
      </header>

      {isLoading && (
        <div className="lpv-loading">
          <LoadingSkeleton />
        </div>
      )}

      {isError && (
        <div className="lpv-error">
          <ErrorView
            title="Could not load learning path"
            message="Please try again."
            onRetry={() => { refetch(); }}
            embedded
          />
        </div>
      )}

      {!isLoading && !isError && !curriculum && (
        <div className="lpv-error">
          <ErrorView
            title="Learning path not found"
            message="This path may no longer be available."
            onRetry={() => navigate('/')}
            embedded
          />
        </div>
      )}

      {curriculum && (
        <>
          {/* Hero */}
          <div className="lpv-hero">
            <div className="lpv-hero__body">
              <span className="lpv-hero__kicker">Learning path</span>
              <h1 className="lpv-hero__title">{curriculum.title}</h1>
              <span className="lpv-hero__progress">
                {curriculum.courses_finished} of {curriculum.courses_total} courses done
              </span>
            </div>
            <div className="lpv-hero__ring" aria-hidden="true">
              <svg viewBox={`0 0 ${RING} ${RING}`} fill="none" className="lpv-hero__svg">
                {/* track — white at full opacity so it reads against the lime tint */}
                <circle cx={cx} cy={cx} r={r} stroke="var(--u-background-primary)" strokeWidth={SW} />
                {progress > 0 && (
                  <circle
                    cx={cx}
                    cy={cx}
                    r={r}
                    stroke="var(--u-background-accent)"
                    strokeWidth={SW * 2}
                    strokeLinecap="round"
                    strokeDasharray={circ}
                    strokeDashoffset={offset}
                    transform={`rotate(-90 ${cx} ${cx})`}
                  />
                )}
              </svg>
              {/* desaturate the whole disc (background + art) until the badge is earned */}
              <div className={`lpv-hero__seal${isComplete ? '' : ' lpv-hero__seal--not-yet'}`}>
                <img
                  src={badgeArt}
                  alt=""
                  className="lpv-hero__seal-icon"
                  aria-hidden="true"
                  onError={(e) => { e.currentTarget.src = iconBadgeCheck; }}
                />
              </div>
            </div>
          </div>

          {/* Milestones — complete + retained only */}
          <div className="lpv-milestones">
            {(['complete', 'retained'] as const).map((slot) => (
              <MilestoneBadge key={slot} slot={slot} curriculum={curriculum} />
            ))}
          </div>

          {/* Courses */}
          <div className="lpv-courses-section">
            <h2 className="lpv-section-title">Courses</h2>
            <div className="lpv-courses-list">
              {sortedCourses.map((course) => {
                const info = cardInfoMap[course.course_id] ?? EMPTY_INFO;
                // A course is "current" (in-progress) when it's the next unfinished
                // course AND the outline shows at least one completed lesson.
                const isCurrentCourse = course.course_id === nextCourse?.course_id
                  && info.progressFraction > 0;
                const courseTarget = `/course/${course.course_id}`;
                return (
                  <CourseCard
                    key={course.course_id}
                    courseId={course.course_id}
                    displayName={course.display_name}
                    imageUrl={course.image_url}
                    finished={course.finished}
                    isCurrent={isCurrentCourse}
                    info={info}
                    onClick={() => navigate(courseTarget, { state: courseNavState })}
                  />
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <footer className="lpv-footer">
            <button type="button" className="btn-primary" onClick={handleCta}>
              {ctaState === 'start' && 'Start course'}
              {ctaState === 'continue' && 'Continue course'}
              {ctaState === 'check' && `Start ${checkLabel}`}
              {ctaState === 'home' && 'Back to learning home'}
            </button>
          </footer>
        </>
      )}
    </div>
  );
};
