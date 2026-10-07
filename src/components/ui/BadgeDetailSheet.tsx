import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { LearnerCurriculum } from '../../api/curriculum';

import iconBadgeCheck from '../../assets/icons/icon-badge-check.svg';
import './badge-detail-sheet.css';

// ── Types ─────────────────────────────────────────────────

type CourseBadgeData = {
  kind: 'course';
  courseId: string;
  title: string;
  description: string;
  art: string;
  tintColor: string;
  progress: string; // e.g. "2 of 7 lessons done"
  earned: boolean;
  earnedDate?: string;
};

type PathBadgeData = {
  kind: 'path';
  curriculum: LearnerCurriculum;
};

export type SheetBadgeData = CourseBadgeData | PathBadgeData;

interface BadgeDetailSheetProps {
  data: SheetBadgeData | null;
  onClose: () => void;
}

// ── SealRing ──────────────────────────────────────────────

const SealRing = ({ size, progress, art, tintColor, earned }: {
  size: number; progress: number; art: string; tintColor: string; earned: boolean;
}) => {
  const r = (size - 12) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(1, progress));
  return (
    <div className="bds-seal-ring" style={{ width: size, height: size }}>
      <svg className="bds-seal-ring__svg" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={c} cy={c} r={r} stroke="var(--u-border-opaque)" strokeWidth="4" fill="none" />
        {progress > 0 && (
          <circle
            cx={c} cy={c} r={r}
            stroke="var(--u-background-accent)"
            strokeWidth="4" fill="none"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${c} ${c})`}
          />
        )}
      </svg>
      <div
        className="bds-seal-ring__inner"
        style={{ background: earned ? tintColor : 'var(--u-background-tertiary)' }}
      >
        <img
          src={art}
          alt=""
          className={`bds-seal-ring__art${earned ? '' : ' bds-seal-ring__art--locked'}`}
          aria-hidden="true"
        />
      </div>
    </div>
  );
};

// ── Course badge sheet ────────────────────────────────────

const CourseBadgeSheet = ({ data, onClose }: { data: CourseBadgeData; onClose: () => void }) => {
  const navigate = useNavigate();
  const handleContinue = () => {
    onClose();
    navigate(`/course/${data.courseId}`);
  };

  return (
    <div className="bds-content">
      <SealRing
        size={88}
        progress={data.earned ? 1 : 0.3}
        art={data.art}
        tintColor={data.tintColor}
        earned={data.earned}
      />
      <p className="bds-type-label">Course badge</p>
      <h2 className="bds-title">{data.title}</h2>
      <p className="bds-desc">{data.description}</p>
      {data.earned && data.earnedDate ? (
        <p className="bds-progress">Earned {data.earnedDate}</p>
      ) : (
        <p className="bds-progress">{data.progress}</p>
      )}
      {!data.earned && (
        <button type="button" className="btn-primary bds-cta" onClick={handleContinue}>
          Continue course
        </button>
      )}
    </div>
  );
};

// ── Path badge sheet ──────────────────────────────────────

const TrophyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M10 13c-3.314 0-6-2.686-6-6V3h12v4c0 3.314-2.686 6-6 6Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <path d="M4 5H2v2c0 1.657 1.343 3 3 3M16 5h2v2c0 1.657-1.343 3-3 3M10 13v4M7 17h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const PathBadgeSheet = ({ data, onClose }: { data: PathBadgeData; onClose: () => void }) => {
  const navigate = useNavigate();
  const { curriculum } = data;
  const complete = curriculum.milestones.complete;
  const retained = curriculum.milestones.retained;
  const isComplete = complete.reached_at !== null;
  const thirtyDayOpen = curriculum.knowledge_check.is_open;
  const thirtyDayEarned = retained.reached_at !== null;

  const progress = `${curriculum.courses_passed} of ${curriculum.courses_total} courses done`;
  const badgeTitle = complete.badge?.title ?? `${curriculum.title} complete`;
  const badgeDesc = `Earned when you finish all ${curriculum.courses_total} courses in ${curriculum.title}.`;

  const handleSeePath = () => {
    onClose();
    navigate(`/learning-path/${curriculum.uuid}`);
  };

  return (
    <div className="bds-content">
      <SealRing
        size={88}
        progress={curriculum.courses_total > 0 ? curriculum.courses_passed / curriculum.courses_total : 0}
        art={complete.badge?.image_url ?? iconBadgeCheck}
        tintColor="var(--u-learning-course-tint-blue)"
        earned={isComplete}
      />
      <p className="bds-type-label">Path badge</p>
      <h2 className="bds-title">{badgeTitle}</h2>
      <p className="bds-desc">{badgeDesc}</p>
      <p className="bds-progress">{isComplete ? `Earned ${new Date(complete.reached_at!).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : progress}</p>

      {/* 30-day check info */}
      {!thirtyDayEarned && (
        <div className="bds-thirty-card">
          <div className="bds-thirty-card__icon">
            <TrophyIcon />
          </div>
          <div className="bds-thirty-card__body">
            <p className="bds-thirty-card__title">30-day check</p>
            <p className="bds-thirty-card__desc">
              {thirtyDayOpen
                ? 'Your 30-day check is open. Passing it earns a second badge.'
                : 'Opens 30 days after you finish the path. Passing it earns a second badge.'}
            </p>
          </div>
        </div>
      )}

      <button type="button" className="btn-primary bds-cta" onClick={handleSeePath}>
        See path
      </button>
    </div>
  );
};

// ── Main component ────────────────────────────────────────

export const BadgeDetailSheet = ({ data, onClose }: BadgeDetailSheetProps) => {
  if (!data) return null;

  return (
    <>
      <div className="bds-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="bds-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={data.kind === 'path' ? data.curriculum.title : data.title}
      >
        <div className="bds-handle" aria-hidden="true" />
        {data.kind === 'course' && <CourseBadgeSheet data={data} onClose={onClose} />}
        {data.kind === 'path' && <PathBadgeSheet data={data} onClose={onClose} />}
      </div>
    </>
  );
};
