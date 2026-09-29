import React from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { NavHeader } from '../components/nav-header/NavHeader';
import { useProgress } from '../hooks/useProgress';
import './completion-page.css';

// ── SVG icons (inlined, no external deps) ─────────────────────────────────

const PlusCircleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 5V19M5 12H19" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const ShieldCheckIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 3L4 6.5V12C4 16.1 7.3 19.9 12 21C16.7 19.9 20 16.1 20 12V6.5L12 3Z"
      fill="white"
      opacity="0.2"
    />
    <path
      d="M12 3L4 6.5V12C4 16.1 7.3 19.9 12 21C16.7 19.9 20 16.1 20 12V6.5L12 3Z"
      stroke="white"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path
      d="M8.5 12L11 14.5L15.5 10"
      stroke="white"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const LockIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <rect x="6" y="13" width="16" height="11" rx="2" fill="#767676" />
    <path
      d="M9.5 13V9.5C9.5 7.3 11.3 5.5 13.5 5.5H14.5C16.7 5.5 18.5 7.3 18.5 9.5V13"
      stroke="#767676"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <circle cx="14" cy="18" r="1.5" fill="white" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M9 6L15 12L9 18"
      stroke="#767676"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// ── Shared progress bar sub-component ─────────────────────────────────────

interface ProgressBarProps {
  completedCount: number;
  totalCount: number;
  percent: number;
}

const ProgressBar = ({ completedCount, totalCount, percent }: ProgressBarProps) => (
  <div className="cp-progress">
    <div className="cp-progress-labels">
      <span className="cp-progress-label">
        {completedCount}
        {' '}
        of
        {' '}
        {totalCount}
        {' '}
        lessons complete
      </span>
      <span className="cp-progress-percent">
        {percent}
        %
      </span>
    </div>
    <div className="cp-progress-track">
      <div className="cp-progress-fill" style={{ width: `${percent}%` }} />
    </div>
  </div>
);

// ── Lesson Complete Page ───────────────────────────────────────────────────

interface LessonCompleteState {
  lessonTitle?: string;
  lessonDescription?: string;
  lessonNumber?: number;
  pointsEarned?: number;
  accountTotal?: number;
  nextLessonTitle?: string;
  nextLessonSubtitle?: string;
  nextSequenceId?: string;
}

export const LessonCompletePage = () => {
  const { courseId = '' } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LessonCompleteState) ?? {};

  const { data: progressData } = useProgress(courseId);

  const lessonTitle = state.lessonTitle ?? 'Lesson complete';
  const lessonNumber = state.lessonNumber ?? 1;
  const pointsEarned = state.pointsEarned ?? 30;
  const accountTotal = state.accountTotal ?? (progressData?.points?.earned ?? pointsEarned);
  const nextLessonTitle = state.nextLessonTitle ?? 'Next lesson';
  const nextLessonSubtitle = state.nextLessonSubtitle ?? '';
  const nextSequenceId = state.nextSequenceId;

  // Use progress data for lesson count when available
  const completedActivities = progressData?.completedActivities;
  const totalActivities = progressData?.totalActivities;
  const derivedTotal = totalActivities ? Math.ceil(totalActivities / 5) : 7;
  const totalCount = derivedTotal;
  const completedCount = lessonNumber;
  const percent = totalCount > 0 ? Math.min(100, Math.round((completedCount / totalCount) * 100)) : 0;

  const handleBack = () => navigate(`/course/${courseId}`);
  const handleStartNext = () => {
    if (nextSequenceId) {
      navigate(`/course/${courseId}/lesson/${nextSequenceId}/step/0`);
    } else {
      navigate(`/course/${courseId}`);
    }
  };

  return (
    <div className="cp-page">
      <NavHeader title={lessonTitle} onBack={handleBack} />

      <main className="cp-content">
        {/* Check result card */}
        <div className="cp-result-card cp-result-card--positive">
          <p className="cp-result-kicker">
            Lesson
            {' '}
            {lessonNumber}
            {' '}
            complete
          </p>
          <p className="cp-result-title">{lessonTitle}</p>
          {state.lessonDescription && (
            <p className="cp-result-body">{state.lessonDescription}</p>
          )}
        </div>

        {/* Progress bar */}
        <ProgressBar
          completedCount={completedCount}
          totalCount={totalCount}
          percent={percent}
        />

        {/* Milestone: points earned */}
        <div className="cp-milestone cp-milestone--positive">
          <div className="cp-milestone__mark" aria-hidden="true">
            <PlusCircleIcon />
          </div>
          <div className="cp-milestone__body">
            <p className="cp-milestone__title">
              Lesson complete ·
              {' '}
              +
              {pointsEarned}
              {' '}
              points
            </p>
            <p className="cp-milestone__subtitle">
              Your account-level total is now
              {' '}
              {accountTotal}
              {' '}
              points.
            </p>
          </div>
        </div>

        {/* Next lesson */}
        <button
          type="button"
          className="cp-milestone cp-milestone--next"
          onClick={handleStartNext}
        >
          <div className="cp-milestone__body">
            <p className="cp-milestone__kicker">Next lesson</p>
            <p className="cp-milestone__title">{nextLessonTitle}</p>
            {nextLessonSubtitle && (
              <p className="cp-milestone__subtitle-dim">{nextLessonSubtitle}</p>
            )}
          </div>
          <ChevronRightIcon />
        </button>
      </main>

      <footer className="cp-footer">
        <button type="button" className="cp-footer__primary" onClick={handleStartNext}>
          Start lesson
          {' '}
          {lessonNumber + 1}
        </button>
        <button type="button" className="cp-footer__secondary" onClick={handleBack}>
          Back to course
        </button>
      </footer>
    </div>
  );
};

// ── Course Complete Page ───────────────────────────────────────────────────

interface CourseCompleteState {
  courseTitle?: string;
  totalLessons?: number;
  totalPoints?: number;
}

export const CourseCompletePage = () => {
  const { courseId = '' } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as CourseCompleteState) ?? {};

  const { data: progressData } = useProgress(courseId);

  const courseTitle = state.courseTitle ?? 'Course complete';
  const totalLessons = state.totalLessons
    ?? (progressData?.totalActivities ? Math.ceil(progressData.totalActivities / 5) : 7);
  const totalPoints = state.totalPoints ?? (progressData?.points?.earned ?? 250);

  const earnedBadges = progressData?.badges ?? [];
  const thoroughBadge = earnedBadges.find((b) => b.badgeType === 'thorough');
  const badgeName = thoroughBadge ? 'Thorough' : 'Thorough';

  const handleBack = () => navigate(`/course/${courseId}`);
  const handleViewProgress = () => navigate('/progress');

  return (
    <div className="cp-page">
      <NavHeader title={courseTitle} onBack={handleBack} />

      <main className="cp-content">
        {/* Check result card */}
        <div className="cp-result-card cp-result-card--positive">
          <p className="cp-result-kicker">Course complete</p>
          <p className="cp-result-title">You completed the course</p>
          <p className="cp-result-body">
            You completed all
            {' '}
            {totalLessons}
            {' '}
            lessons in this course.
          </p>
        </div>

        {/* Progress: 100% */}
        <ProgressBar
          completedCount={totalLessons}
          totalCount={totalLessons}
          percent={100}
        />

        {/* Milestone: contribution recorded */}
        <div className="cp-milestone cp-milestone--positive">
          <div className="cp-milestone__mark" aria-hidden="true">
            <PlusCircleIcon />
          </div>
          <div className="cp-milestone__body">
            <p className="cp-milestone__title">Course contribution recorded</p>
            <p className="cp-milestone__subtitle">
              {totalPoints}
              {' '}
              points from this course are in your shared record.
            </p>
          </div>
        </div>

        {/* Badge unlocked */}
        <div className="cp-badge-section">
          <h2 className="cp-badge-section__heading">Badge unlocked</h2>
          <div className="cp-badge-row">
            <div className="cp-badge-art cp-badge-art--positive" aria-hidden="true">
              <ShieldCheckIcon />
            </div>
            <div className="cp-badge-body">
              <p className="cp-badge-name">{badgeName}</p>
              <p className="cp-badge-desc">Earned across Uber Learn</p>
            </div>
          </div>
        </div>

        {/* Commitment */}
        <div className="cp-commitment">
          <p className="cp-commitment__title">Your commitment</p>
          <p className="cp-commitment__body">
            Keep conversations respectful, follow stated boundaries, and report concerns safely.
          </p>
        </div>
      </main>

      <footer className="cp-footer">
        <button type="button" className="cp-footer__primary" onClick={handleViewProgress}>
          View learning progress
        </button>
        <button type="button" className="cp-footer__secondary" onClick={handleBack}>
          Back to course
        </button>
      </footer>
    </div>
  );
};

// ── Retention Invite Page ──────────────────────────────────────────────────

interface RetentionInviteState {
  courseName?: string;
  retentionSequenceId?: string;
}

export const RetentionInvitePage = () => {
  const { courseId = '' } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as RetentionInviteState) ?? {};

  const courseName = state.courseName ?? 'this course';
  const retentionSequenceId = state.retentionSequenceId;

  const { data: progressData } = useProgress(courseId);
  const retentionSeqId = retentionSequenceId
    ?? progressData?.assessments?.retention?.sequenceKey
    ?? null;

  const handleBack = () => navigate(`/course/${courseId}`);
  const handleStartCheck = () => {
    if (retentionSeqId) {
      navigate(`/course/${courseId}/lesson/${retentionSeqId}/step/0`);
    } else {
      navigate(`/course/${courseId}`);
    }
  };

  return (
    <div className="cp-page">
      <NavHeader title="Retention check" onBack={handleBack} />

      <main className="cp-content">
        <p className="cp-kicker">30 days on · Not scored for points</p>
        <h1 className="cp-big-title">Still with you?</h1>
        <p className="cp-lead">
          Five new questions check what stayed with you from
          {' '}
          {courseName}
          .
        </p>

        {/* Retained badge (locked) */}
        <div className="cp-badge-row cp-badge-row--bordered">
          <div className="cp-badge-art cp-badge-art--locked" aria-hidden="true">
            <LockIcon />
          </div>
          <div className="cp-badge-body">
            <p className="cp-badge-name cp-badge-name--secondary">Retained</p>
            <p className="cp-badge-desc">
              Answer at least four of five questions correctly to earn it.
              You can review the course and try again if needed.
            </p>
          </div>
        </div>
      </main>

      <footer className="cp-footer">
        <button type="button" className="cp-footer__primary" onClick={handleStartCheck}>
          Start retention check
        </button>
        <button type="button" className="cp-footer__secondary" onClick={handleBack}>
          Not now
        </button>
      </footer>
    </div>
  );
};
