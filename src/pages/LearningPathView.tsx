import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCurriculums } from '../hooks/useCurriculums';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorView } from '../components/ui/ErrorView';
import type { LearnerCurriculum } from '../api/curriculum';

import iconBadgeCheck from '../assets/icons/icon-badge-check.svg';
import iconChevronRight from '../assets/icons/chevron-right.svg';
import './learning-path-view.scss';

// ── Back arrow ───────────────────────────────────────────

const ArrowLeft = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M19 12H5M5 12l7 7M5 12l7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

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

  const toGo = isRetained
    ? (curriculum.knowledge_check.is_open ? null : curriculum.courses_total - curriculum.courses_finished)
    : curriculum.courses_total - curriculum.courses_finished;

  return (
    <div className={`lp-milestone${earned ? ' lp-milestone--earned' : ''}`}>
      <div className="lp-milestone__disc">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className={`lp-milestone__img${earned ? '' : ' lp-milestone__img--locked'}`}
            aria-hidden="true"
          />
        ) : (
          <img
            src={iconBadgeCheck}
            alt=""
            className={`lp-milestone__icon${earned ? ' lp-milestone__icon--earned' : ''}`}
            aria-hidden="true"
          />
        )}
        {locked && (
          <span className="lp-milestone__lock" aria-label="locked">
            <LockIcon />
          </span>
        )}
      </div>
      <span className="lp-milestone__label">{title}</span>
      {earned && milestone?.reached_at ? (
        <span className="lp-milestone__sub">
          {new Date(milestone.reached_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </span>
      ) : isRetained && curriculum.knowledge_check.is_open ? (
        <span className="lp-milestone__sub">Open now</span>
      ) : toGo != null && toGo > 0 ? (
        <span className="lp-milestone__sub">{toGo} to go</span>
      ) : null}
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
  onClick: () => void;
}

const CourseCard = ({
  courseId, displayName, imageUrl, finished, isCurrent, onClick,
}: CourseCardProps) => (
  <button
    type="button"
    className={`lpv-course-card${finished ? ' lpv-course-card--complete' : ''}${isCurrent ? ' lpv-course-card--current' : ''}`}
    onClick={onClick}
    aria-label={`Open ${displayName ?? courseId}`}
  >
    <div className="lpv-course-card__thumb">
      {imageUrl ? (
        <img src={imageUrl} alt="" aria-hidden="true" className="lpv-course-card__img" />
      ) : (
        <div className="lpv-course-card__img-placeholder" aria-hidden="true" />
      )}
    </div>
    <div className="lpv-course-card__body">
      <span className="lpv-course-card__title">{displayName ?? courseId}</span>
      {finished && (
        <span className="lpv-course-card__status lpv-course-card__status--complete">Complete</span>
      )}
      {isCurrent && !finished && (
        <span className="lpv-course-card__status lpv-course-card__status--progress">In progress</span>
      )}
    </div>
    <img src={iconChevronRight} alt="" className="lpv-course-card__chevron" aria-hidden="true" />
  </button>
);

// ── Main component ────────────────────────────────────────

export const LearningPathView = () => {
  const navigate = useNavigate();
  const { curriculumId } = useParams<{ curriculumId: string }>();
  const {
    data: curriculums, isLoading, isError, refetch,
  } = useCurriculums();

  const curriculum = curriculums?.find((c) => c.uuid === curriculumId);

  const sortedCourses = curriculum
    ? curriculum.courses.slice().sort((a, b) => a.position - b.position)
    : [];

  const nextCourse = sortedCourses.find((c) => !c.finished);

  const isComplete = curriculum
    ? curriculum.courses_finished > 0 && curriculum.courses_finished === curriculum.courses_total
    : false;

  const badgeArt = curriculum?.milestones?.complete?.badge?.image_url ?? iconBadgeCheck;

  // ── Footer CTA logic ───────────────────────────────────
  type CtaState = 'start' | 'continue' | 'check' | 'home';

  const getCtaState = (): CtaState => {
    if (!curriculum) return 'home';
    const { courses_finished, courses_total, knowledge_check, milestones } = curriculum;
    if (courses_finished === 0) return 'start';
    if (courses_finished < courses_total) return 'continue';
    // All courses done
    const checkDone = milestones.retained?.reached_at != null;
    if (checkDone) return 'home';
    if (knowledge_check.exists && knowledge_check.is_open) return 'check';
    return 'home';
  };

  const ctaState = getCtaState();

  const checkLabel = curriculum?.knowledge_check?.display_name ?? '30-day check';

  const handleCta = () => {
    if (!curriculum) { navigate('/'); return; }
    if (ctaState === 'start' || ctaState === 'continue') {
      navigate(`/course/${nextCourse!.course_id}`);
    } else if (ctaState === 'check') {
      navigate(`/course/${curriculum.knowledge_check.course_id}`);
    } else {
      navigate('/');
    }
  };

  // Hero ring geometry — 96px, strokeWidth 4
  const RING = 96;
  const SW = 4;
  const cx = RING / 2;
  const r = cx - SW / 2;
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
          onClick={() => navigate(-1)}
        >
          <ArrowLeft />
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
          />
        </div>
      )}

      {!isLoading && !isError && !curriculum && (
        <div className="lpv-error">
          <ErrorView
            title="Learning path not found"
            message="This path may no longer be available."
            onRetry={() => navigate('/')}
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
                <circle cx={cx} cy={cx} r={r} stroke="white" strokeWidth={SW} strokeOpacity="0.5" />
                {progress > 0 && (
                  <circle
                    cx={cx}
                    cy={cx}
                    r={r}
                    stroke="var(--u-background-accent)"
                    strokeWidth={SW}
                    strokeLinecap="round"
                    strokeDasharray={circ}
                    strokeDashoffset={offset}
                    transform={`rotate(-90 ${cx} ${cx})`}
                  />
                )}
              </svg>
              <div className="lpv-hero__seal">
                <img
                  src={badgeArt}
                  alt=""
                  className={`lpv-hero__seal-icon${isComplete ? '' : ' lpv-hero__seal-icon--locked'}`}
                  aria-hidden="true"
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
                const isCurrentCourse = curriculum.courses_finished > 0
                  && course.course_id === nextCourse?.course_id;
                const courseTarget = `/course/${course.course_id}`;
                return (
                  <CourseCard
                    key={course.course_id}
                    courseId={course.course_id}
                    displayName={course.display_name}
                    imageUrl={course.image_url}
                    finished={course.finished}
                    isCurrent={isCurrentCourse}
                    onClick={() => navigate(courseTarget)}
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
