import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurriculums } from '../hooks/useCurriculums';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorView } from '../components/ui/ErrorView';
import type { LearnerCurriculum } from '../api/curriculum';

import iconChevronRight from '../assets/icons/chevron-right.svg';
import iconBadgeCheck from '../assets/icons/icon-badge-check.svg';

import './all-learning-paths.scss';

// ── Back arrow ────────────────────────────────────────────

const ArrowLeft = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M19 12H5M5 12l7 7M5 12l7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ── Path card ─────────────────────────────────────────────

const formatCompletionDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const day = d.getDate();
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  return `${day} ${month}`;
};

const PathCard = ({ curriculum, onClick }: { curriculum: LearnerCurriculum; onClick: () => void }) => {
  const sortedCourses = curriculum.courses.slice().sort((a, b) => a.position - b.position);
  const nextCourse = sortedCourses.find((c) => !c.finished);
  const isComplete = curriculum.courses_finished > 0
    && curriculum.courses_finished === curriculum.courses_total;
  const badgeArt = curriculum.milestones.complete?.badge?.image_url ?? iconBadgeCheck;
  const completeMilestone = curriculum.milestones.complete;
  const completionLabel = isComplete && completeMilestone?.badge?.title && completeMilestone?.reached_at
    ? `${completeMilestone.badge.title} · ${formatCompletionDate(completeMilestone.reached_at)}`
    : null;

  const size = 56;
  const strokeWidth = 3;
  const cx = size / 2;
  const r = cx - strokeWidth / 2;
  const circ = 2 * Math.PI * r;
  const progress = curriculum.courses_total > 0
    ? Math.min(1, curriculum.courses_finished / curriculum.courses_total)
    : 0;
  const offset = circ * (1 - progress);

  return (
    <button type="button" className="path-card" onClick={onClick} aria-label={`View ${curriculum.title}`}>
      <div className="path-card__seal">
        <svg className="path-card__ring" viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden="true">
          <circle cx={cx} cy={cx} r={r} stroke="var(--u-border-opaque)" strokeWidth={strokeWidth} />
          {progress > 0 && (
            <circle
              cx={cx}
              cy={cx}
              r={r}
              stroke="var(--u-background-accent)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${cx} ${cx})`}
            />
          )}
        </svg>
        <div className="path-card__seal-inner">
          <img
            src={badgeArt}
            alt=""
            className={`path-card__seal-art${isComplete ? '' : ' path-card__seal-art--locked'}`}
            aria-hidden="true"
          />
        </div>
      </div>
      <div className="path-card__body">
        <span className="path-card__title">{curriculum.title}</span>
        <div className="path-card__meta">
          <span className="path-card__progress">
            {curriculum.courses_finished} of {curriculum.courses_total} courses done
          </span>
          {completionLabel ? (
            <span className="path-card__next">{completionLabel}</span>
          ) : nextCourse ? (
            <span className="path-card__next">
              Next: {nextCourse.display_name ?? nextCourse.course_id}
            </span>
          ) : null}
        </div>
      </div>
      <img src={iconChevronRight} alt="" className="path-card__chevron" aria-hidden="true" />
    </button>
  );
};

// ── Section header ────────────────────────────────────────

const SectionHeader = ({ title, count }: { title: string; count: number }) => (
  <div className="alp-section-header">
    <h2 className="alp-section-title">{title}</h2>
    <span className="alp-section-count">{count === 1 ? '1 path' : `${count} paths`}</span>
  </div>
);

// ── Empty state illustration ──────────────────────────────

const EmptyIllustration = () => (
  <div className="alp-empty__art" aria-hidden="true">
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="8" width="40" height="48" rx="4" fill="var(--u-background-secondary)" stroke="var(--u-border-opaque)" strokeWidth="1.5" />
      <rect x="22" y="4" width="20" height="8" rx="4" fill="var(--u-background-secondary)" stroke="var(--u-border-opaque)" strokeWidth="1.5" />
      <rect x="20" y="24" width="24" height="2.5" rx="1.25" fill="var(--u-border-opaque)" />
      <rect x="20" y="31" width="18" height="2.5" rx="1.25" fill="var(--u-border-opaque)" />
      <rect x="20" y="38" width="20" height="2.5" rx="1.25" fill="var(--u-border-opaque)" />
      <circle cx="17" cy="25.25" r="2" fill="var(--u-content-accent)" />
      <circle cx="17" cy="32.25" r="2" fill="var(--u-border-opaque)" />
      <circle cx="17" cy="39.25" r="2" fill="var(--u-border-opaque)" />
    </svg>
  </div>
);

// ── Main page ─────────────────────────────────────────────

export const AllLearningPathsPage = () => {
  const navigate = useNavigate();
  const {
    data: curriculums, isLoading, isError, refetch,
  } = useCurriculums();

  const hasPaths = !isLoading && !isError && curriculums && curriculums.length > 0;
  const isEmpty = !isLoading && !isError && (!curriculums || curriculums.length === 0);

  return (
    <div className="alp-page">
      <header className="alp-nav">
        <button
          type="button"
          className="alp-nav__back"
          aria-label="Go back"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft />
        </button>
      </header>

      {isLoading && (
        <div className="alp-loading">
          <LoadingSkeleton />
        </div>
      )}

      {isError && (
        <div className="alp-content">
          <ErrorView
            title="Could not load learning paths"
            message="Please try again."
            onRetry={() => { refetch(); }}
          />
        </div>
      )}

      {isEmpty && (
        <>
          <div className="alp-empty">
            <EmptyIllustration />
            <h1 className="alp-empty__title">No learning paths yet</h1>
            <p className="alp-empty__desc">
              Uber adds paths based on where and how you drive. Until then, every course is open to you.
            </p>
          </div>
          <footer className="alp-footer">
            <button type="button" className="btn-primary" onClick={() => navigate('/library')}>
              See all courses
            </button>
          </footer>
        </>
      )}

      {hasPaths && (() => {
        const all = curriculums!;
        const inProgress = all.filter(
          (c) => c.courses_finished > 0 && c.courses_finished < c.courses_total,
        );
        const yourPaths = all.filter(
          (c) => c.courses_finished === 0 || c.courses_finished === c.courses_total,
        );
        return (
          <>
            <div className="alp-content">
              <h1 className="alp-heading">Learning paths</h1>
              <p className="alp-subheading">Picked for where and how you drive.</p>

              {inProgress.length > 0 && (
                <>
                  <SectionHeader title="In progress" count={inProgress.length} />
                  <div className="path-list alp-path-list">
                    {inProgress.map((c) => (
                      <PathCard
                        key={c.uuid}
                        curriculum={c}
                        onClick={() => navigate(`/learning-path/${c.uuid}`)}
                      />
                    ))}
                  </div>
                </>
              )}

              {yourPaths.length > 0 && (
                <>
                  <SectionHeader title="Your paths" count={yourPaths.length} />
                  <div className="path-list alp-path-list">
                    {yourPaths.map((c) => (
                      <PathCard
                        key={c.uuid}
                        curriculum={c}
                        onClick={() => navigate(`/learning-path/${c.uuid}`)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
            <footer className="alp-footer">
              <button type="button" className="btn-primary" onClick={() => navigate('/')}>
                Back to learning home
              </button>
            </footer>
          </>
        );
      })()}
    </div>
  );
};
