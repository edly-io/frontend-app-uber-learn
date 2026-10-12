import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { LearnerCurriculum } from '../../api/curriculum';
import { getResumeBlock } from '../../api/courseware';
import { qk } from '../../api/queries';
import { useCourseProgressSummary } from '../../hooks/useCourseProgressSummary';
import { useCourseOutline } from '../../hooks/useCourseOutline';
import { countLessons } from '../../lib/outline-mapper';
import { useFocusTrap } from '../../hooks/useFocusTrap';

import iconBadgeCheck from '../../assets/icons/icon-badge-check.svg';
import iconTrophyEarned from '../../assets/icons/badge-art-trophy-earned.svg';
import iconTrophyLocked from '../../assets/icons/badge-art-retained.svg';
import './badge-detail-sheet.scss';

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

// ── TrophyArt ─────────────────────────────────────────────

const TrophyArt = ({ earned, size }: { earned: boolean; size: number }) => (
  <img
    src={earned ? iconTrophyEarned : iconTrophyLocked}
    width={size}
    height={size}
    alt=""
    aria-hidden="true"
  />
);

// ── SealRing ──────────────────────────────────────────────

const SealRing = ({
  size, progress, art, tintColor, earned, thirtyState,
}: {
  size: number; progress: number; art: string; tintColor: string; earned: boolean;
  thirtyState?: 'locked' | 'earned';
}) => {
  const strokeWidth = 3;
  const c = size / 2;
  const r = c - strokeWidth / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(1, progress));
  return (
    <div className="bds-seal-ring" style={{ width: size, height: size }}>
      <svg className="bds-seal-ring__svg" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={c} cy={c} r={r} stroke="var(--u-border-opaque)" strokeWidth={strokeWidth} fill="none" />
        {progress > 0 && (
          <circle
            cx={c}
            cy={c}
            r={r}
            stroke="var(--u-background-accent)"
            strokeWidth={strokeWidth}
            fill="none"
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
      {thirtyState && (
        <div className={`bds-seal-ring__thirty${thirtyState === 'earned' ? ' bds-seal-ring__thirty--earned' : ''}`} aria-hidden="true">
          <TrophyArt earned={thirtyState === 'earned'} size={16} />
        </div>
      )}
    </div>
  );
};

// ── Course badge sheet ────────────────────────────────────

const CourseBadgeSheet = ({ data, onClose }: { data: CourseBadgeData; onClose: () => void }) => {
  const navigate = useNavigate();
  const progressQuery = useCourseProgressSummary(data.courseId);
  const outlineQuery = useCourseOutline(data.courseId);
  const fraction = data.earned ? 1 : (progressQuery.data?.fraction ?? 0);
  const isInProgress = !data.earned && fraction > 0;

  // Fetch resume block only when the course is in-progress.
  const resumeQuery = useQuery({
    queryKey: qk.resume(data.courseId),
    queryFn: () => getResumeBlock(data.courseId),
    enabled: isInProgress,
    staleTime: 60_000,
  });

  const handleContinue = () => {
    onClose();
    const resumeSeqId = resumeQuery.data?.sectionId;
    if (isInProgress && resumeSeqId) {
      navigate(`/course/${data.courseId}/lesson/${resumeSeqId}/step/0`);
    } else {
      navigate(`/course/${data.courseId}`);
    }
  };

  // Fix 9: prefer the badge's API description when available.
  // Fix 6: otherwise derive from the outline's lesson count (sequences, not XBlock units).
  const lessonCount = outlineQuery.data ? countLessons(outlineQuery.data).total : null;
  const descText = data.description
    || (lessonCount
      ? `Earned when you finish all ${lessonCount} lessons.`
      : 'Earned when you finish all lessons.');

  let ctaLabel: string;
  if (data.earned) {
    ctaLabel = 'Review course';
  } else if (isInProgress) {
    ctaLabel = 'Continue course';
  } else {
    ctaLabel = 'See course';
  }

  return (
    <div className="bds-content">
      <SealRing
        size={88}
        progress={fraction}
        art={data.art}
        tintColor={data.tintColor}
        earned={data.earned}
      />
      <p className="bds-type-label">Course badge</p>
      <h2 className="bds-title">{data.title}</h2>
      <p className="bds-desc">{descText}</p>
      {data.earned && data.earnedDate && (
        <p className="bds-progress">Earned {data.earnedDate}</p>
      )}
      <button type="button" className="btn-primary bds-cta" onClick={handleContinue}>
        {ctaLabel}
      </button>
    </div>
  );
};

// ── Path badge sheet ──────────────────────────────────────

const PathBadgeSheet = ({ data, onClose }: { data: PathBadgeData; onClose: () => void }) => {
  const navigate = useNavigate();
  const { curriculum } = data;
  const { complete } = curriculum.milestones;
  const { retained } = curriculum.milestones;
  const isComplete = complete.reached_at !== null;
  const thirtyDayOpen = curriculum.knowledge_check.is_open;
  const thirtyDayEarned = retained.reached_at !== null;

  const progress = `${curriculum.courses_finished} of ${curriculum.courses_total} courses done`;
  const badgeTitle = complete.badge?.title ?? `${curriculum.title} complete`;
  const badgeDesc = `Earned when you finish all ${curriculum.courses_total} courses in ${curriculum.title}.`;

  // When the retention check is open and not yet passed, the CTA launches the check course.
  const checkIsActionable = isComplete && thirtyDayOpen && !thirtyDayEarned;
  const knowledgeCheckCourseId = curriculum.knowledge_check.course_id;

  const handleCta = () => {
    onClose();
    if (checkIsActionable && knowledgeCheckCourseId) {
      navigate(`/course/${knowledgeCheckCourseId}`);
    } else {
      navigate(`/learning-path/${curriculum.uuid}`);
    }
  };

  // 30-day check card text and trophy colour depend on retained state.
  let thirtyDesc: string;
  if (thirtyDayEarned) {
    const retainedDate = new Date(retained.reached_at!).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    thirtyDesc = `Passed on ${retainedDate}.`;
  } else if (checkIsActionable) {
    thirtyDesc = 'Your 30-day check is open. Passing it earns a second badge.';
  } else {
    thirtyDesc = 'Opens 15 or 30 days after you finish the path. Passing it earns a second badge.';
  }

  return (
    <div className="bds-content">
      <SealRing
        size={88}
        progress={curriculum.courses_total > 0 ? curriculum.courses_finished / curriculum.courses_total : 0}
        art={complete.badge?.image_url ?? iconBadgeCheck}
        tintColor="var(--u-learning-course-tint-blue)"
        earned={isComplete}
        thirtyState={thirtyDayEarned ? 'earned' : 'locked'}
      />
      <p className="bds-type-label">Path badge</p>
      <h2 className="bds-title">{badgeTitle}</h2>
      <p className="bds-desc">{badgeDesc}</p>
      <p className="bds-progress">{isComplete ? `Earned ${new Date(complete.reached_at!).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : progress}</p>

      {/* 30-day check card: shown on all complete paths; colour and text vary by retained state */}
      {isComplete && (
        <div className="bds-thirty-card">
          <div className="bds-thirty-card__disc">
            <TrophyArt earned={thirtyDayEarned} size={22} />
          </div>
          <div className="bds-thirty-card__body">
            <p className="bds-thirty-card__title">30-day check</p>
            <p className="bds-thirty-card__desc">{thirtyDesc}</p>
          </div>
        </div>
      )}

      <button type="button" className="btn-primary bds-cta" onClick={handleCta}>
        {checkIsActionable ? 'Start 30-day check' : 'See path'}
      </button>
    </div>
  );
};

// ── Main component ────────────────────────────────────────

export const BadgeDetailSheet = ({ data, onClose }: BadgeDetailSheetProps) => {
  const sheetRef = useRef<HTMLDivElement>(null);

  // WCAG 2.1 SC 2.4.3 / SC 2.1.2: trap focus and handle Escape when open.
  // Callers must pass a stable onClose reference (memoised with useCallback).
  useFocusTrap(sheetRef, data !== null, onClose);

  if (!data) { return null; }

  return (
    <>
      <div className="bds-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
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
