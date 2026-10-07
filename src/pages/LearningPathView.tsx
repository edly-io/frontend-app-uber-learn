import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCurriculums } from '../hooks/useCurriculums';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorView } from '../components/ui/ErrorView';
import type { LearnerCurriculum } from '../api/curriculum';

import iconBadgeCheck from '../assets/icons/icon-badge-check.svg';
import iconCircleCheck from '../assets/icons/icon-circle-check.svg';
import './learning-path-view.css';

// ── Back arrow ───────────────────────────────────────────

const ArrowLeft = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M19 12H5M5 12l7 7M5 12l7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ── Milestone badges ──────────────────────────────────────

interface MilestoneBadgeProps {
  slot: 'halfway' | 'complete' | 'retained';
  curriculum: LearnerCurriculum;
}

const MILESTONE_LABEL: Record<string, string> = {
  halfway: 'Road ready',
  complete: 'Complete',
  retained: '30-day check',
};

const MilestoneBadge = ({ slot, curriculum }: MilestoneBadgeProps) => {
  const milestone = curriculum.milestones[slot];
  const earned = milestone.reached_at !== null;
  const locked = slot === 'retained' && !curriculum.knowledge_check.is_open && !earned;
  const imageUrl = milestone.badge?.image_url ?? null;
  const title = milestone.badge?.title ?? MILESTONE_LABEL[slot];

  return (
    <div className={`lp-milestone${earned ? ' lp-milestone--earned' : ''}`}>
      <div className="lp-milestone__disc">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="lp-milestone__img" aria-hidden="true" />
        ) : (
          <img
            src={earned ? iconCircleCheck : iconBadgeCheck}
            alt=""
            className={`lp-milestone__icon${earned ? ' lp-milestone__icon--earned' : ''}`}
            aria-hidden="true"
          />
        )}
        {locked && (
          <span className="lp-milestone__lock" aria-label="locked">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="2" y="5" width="8" height="6" rx="1" fill="currentColor" />
              <path d="M4 5V3.5a2 2 0 0 1 4 0V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </span>
        )}
      </div>
      <span className="lp-milestone__label">{title}</span>
      {earned && milestone.reached_at && (
        <span className="lp-milestone__sub">
          {new Date(milestone.reached_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </span>
      )}
      {!earned && slot === 'retained' && (
        <span className="lp-milestone__sub">
          {curriculum.knowledge_check.is_open ? 'Open now' : `${curriculum.courses_total - curriculum.courses_passed} to go`}
        </span>
      )}
      {!earned && slot !== 'retained' && (
        <span className="lp-milestone__sub">
          {curriculum.courses_total - curriculum.courses_passed} to go
        </span>
      )}
    </div>
  );
};

// ── Course row ────────────────────────────────────────────

interface CourseRowProps {
  courseId: string;
  displayName: string | null;
  passed: boolean;
  position: number;
  onClick: () => void;
}

const CourseRow = ({ courseId, displayName, passed, position, onClick }: CourseRowProps) => (
  <button type="button" className={`lpv-course-row${passed ? ' lpv-course-row--passed' : ''}`} onClick={onClick}>
    <div className="lpv-course-row__ring">
      {passed ? (
        <img src={iconCircleCheck} alt="" className="lpv-course-row__check" aria-hidden="true" />
      ) : (
        <span className="lpv-course-row__num">{position}</span>
      )}
    </div>
    <span className="lpv-course-row__title">{displayName ?? courseId}</span>
    {passed && <span className="lpv-course-row__status">Complete</span>}
  </button>
);

// ── Main component ────────────────────────────────────────

export const LearningPathView = () => {
  const navigate = useNavigate();
  const { curriculumId } = useParams<{ curriculumId: string }>();
  const { data: curriculums, isLoading, isError, refetch } = useCurriculums();

  const curriculum = curriculums?.find((c) => c.uuid === curriculumId);

  const sortedCourses = curriculum
    ? curriculum.courses.slice().sort((a, b) => a.position - b.position)
    : [];

  const nextCourse = sortedCourses.find((c) => !c.passed);

  const handleContinue = () => {
    if (nextCourse) {
      navigate(`/course/${nextCourse.course_id}`);
    }
  };

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
          <LoadingSkeleton lines={4} />
        </div>
      )}

      {isError && (
        <div className="lpv-error">
          <ErrorView
            title="Could not load learning path"
            message="Please try again."
            onRetry={() => void refetch()}
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
                {curriculum.courses_passed} of {curriculum.courses_total} courses done
              </span>
            </div>
            <div className="lpv-hero__ring" aria-hidden="true">
              <svg viewBox="0 0 88 88" fill="none" className="lpv-hero__svg">
                <circle cx="44" cy="44" r="38" stroke="var(--u-border-opaque)" strokeWidth="4" />
                {curriculum.courses_total > 0 && (
                  <circle
                    cx="44" cy="44" r="38"
                    stroke="var(--u-content-accent)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 38}`}
                    strokeDashoffset={`${2 * Math.PI * 38 * (1 - curriculum.courses_passed / curriculum.courses_total)}`}
                    transform="rotate(-90 44 44)"
                  />
                )}
              </svg>
              <div className="lpv-hero__seal">
                <img src={iconBadgeCheck} alt="" className="lpv-hero__seal-icon" aria-hidden="true" />
              </div>
            </div>
          </div>

          {/* Milestones */}
          <div className="lpv-milestones">
            {(['halfway', 'complete', 'retained'] as const).map((slot) => (
              <MilestoneBadge key={slot} slot={slot} curriculum={curriculum} />
            ))}
          </div>

          {/* Courses */}
          <div className="lpv-courses-section">
            <h2 className="lpv-section-title">Courses</h2>
            <div className="lpv-courses-list">
              {sortedCourses.map((course) => (
                <CourseRow
                  key={course.course_id}
                  courseId={course.course_id}
                  displayName={course.display_name}
                  passed={course.passed}
                  position={course.position}
                  onClick={() => navigate(`/course/${course.course_id}`)}
                />
              ))}
            </div>
          </div>

          {/* Footer */}
          <footer className="lpv-footer">
            {nextCourse ? (
              <button type="button" className="btn-primary" onClick={handleContinue}>
                Continue course
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={() => navigate('/')}>
                Back to home
              </button>
            )}
          </footer>
        </>
      )}
    </div>
  );
};
