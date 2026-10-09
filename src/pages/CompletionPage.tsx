import React from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useCourseOutline } from '../hooks/useCourseOutline';
import { mapOutlineToLessons } from '../lib/outline-mapper';
import courseArtBook from '../assets/icons/course-art-book.svg';
import courseArtRow from '../assets/icons/course-art-row.svg';
import iconArrowLeft from '../assets/icons/icon-arrow-left.svg';
import iconCircleCheck from '../assets/icons/icon-circle-check.svg';
import chevronRight from '../assets/icons/chevron-right.svg';
import badgeArtRetained from '../assets/icons/badge-art-retained.svg';
import './completion-page.scss';

// ── Shared: Art panel header ───────────────────────────────────────────────

type ArtPanelSize = 'medium' | 'large';
type ArtPanelColor = 'green' | 'blue' | 'yellow';

interface ArtPanelProps {
  size?: ArtPanelSize;
  color?: ArtPanelColor;
  art: string;
  artAlt?: string;
  onBack: () => void;
}

const ArtPanel = ({
  size = 'medium', color = 'green', art, artAlt = '', onBack,
}: ArtPanelProps) => (
  <div className={`cp-art-panel cp-art-panel--${size} cp-art-panel--${color}`}>
    <div className="cp-art-panel__halo">
      <div className="cp-art-panel__disc">
        <img src={art} alt={artAlt} aria-hidden="true" className="cp-art-panel__art" />
      </div>
    </div>
    <button type="button" className="cp-art-panel__back" onClick={onBack} aria-label="Back">
      <img src={iconArrowLeft} alt="" aria-hidden="true" width={24} height={24} />
    </button>
  </div>
);

// ── Shared: Two-action footer ──────────────────────────────────────────────

interface FooterProps {
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
}

const Footer = ({
  primaryLabel, secondaryLabel, onPrimary, onSecondary,
}: FooterProps) => (
  <footer className="cp-footer">
    <button type="button" className="cp-footer__primary" onClick={onPrimary}>
      {primaryLabel}
    </button>
    <button type="button" className="cp-footer__secondary" onClick={onSecondary}>
      {secondaryLabel}
    </button>
  </footer>
);

// ── Shared: Progress bar ───────────────────────────────────────────────────

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
    </div>
    <div className="cp-progress-track">
      <div className="cp-progress-fill" style={{ width: `${percent}%` }} />
    </div>
  </div>
);

// ── Lesson Complete Page ───────────────────────────────────────────────────

interface LessonCompleteState {
  lessonTitle?: string;
  lessonNumber?: number;
  nextLessonTitle?: string;
  nextLessonSubtitle?: string;
  nextSequenceId?: string | null;
  isRepeat?: boolean;
  isLastLesson?: boolean;
  finalCheckSequenceId?: string | null;
}

export const LessonCompletePage = () => {
  const { courseId = '' } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LessonCompleteState) ?? {};

  const outlineQuery = useCourseOutline(courseId);
  const allLessons = outlineQuery.data ? mapOutlineToLessons(outlineQuery.data) : [];

  const lessonTitle = state.lessonTitle ?? 'Lesson complete';
  const lessonNumber = state.lessonNumber ?? 1;
  const nextSequenceId = state.nextSequenceId;
  const isRepeat = state.isRepeat ?? false;
  const isLastLesson = state.isLastLesson ?? false;
  const finalCheckSequenceId = state.finalCheckSequenceId;

  const totalCount = allLessons.length > 0 ? allLessons.length : 7;
  const completedCount = lessonNumber;
  const percent = totalCount > 0 ? Math.min(100, Math.round((completedCount / totalCount) * 100)) : 0;

  const kicker = `Lesson ${lessonNumber} ${isRepeat ? 'refreshed' : 'complete'}`;
  const lead = isRepeat
    ? "You've finished this lesson before. Your progress is saved."
    : 'Your progress is saved. Come back whenever you\'re ready.';

  const handleBack = () => navigate('/');
  const handleStartNext = () => {
    if (isLastLesson && finalCheckSequenceId) {
      navigate(`/course/${courseId}/lesson/${finalCheckSequenceId}/step/0`);
    } else if (nextSequenceId) {
      navigate(`/course/${courseId}/lesson/${nextSequenceId}/step/0`);
    } else {
      navigate(`/course/${courseId}`);
    }
  };

  const primaryLabel = isLastLesson ? 'Start final check' : `Start lesson ${lessonNumber + 1}`;

  return (
    <div className="cp-page cp-page--scrollable">
      <ArtPanel art={courseArtBook} color="blue" onBack={() => navigate(`/course/${courseId}`)} />

      <main className="cp-content">
        <div className="cpl-heading">
          <p className="cpl-kicker">{kicker}</p>
          <h1 className="cpl-title">{lessonTitle}</h1>
          <p className="cpl-lead">{lead}</p>
        </div>

        <ProgressBar
          completedCount={completedCount}
          totalCount={totalCount}
          percent={percent}
        />
      </main>

      <Footer
        primaryLabel={primaryLabel}
        secondaryLabel="Back to learning home"
        onPrimary={handleStartNext}
        onSecondary={handleBack}
      />
    </div>
  );
};

// ── Course Complete Page ───────────────────────────────────────────────────

interface CourseCompleteState {
  courseTitle?: string;
  totalLessons?: number;
  totalPoints?: number;
  badgeImageUrl?: string;
  badgeEarnedDate?: string;
}

export const CourseCompletePage = () => {
  const { courseId = '' } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as CourseCompleteState) ?? {};

  const courseOutlineQuery = useCourseOutline(courseId);
  const courseAllLessons = courseOutlineQuery.data ? mapOutlineToLessons(courseOutlineQuery.data) : [];

  const totalLessons = state.totalLessons
    ?? (courseAllLessons.length > 0 ? courseAllLessons.length : 7);
  const totalPoints = state.totalPoints ?? 360;
  const badgeImageUrl = state.badgeImageUrl ?? null;
  const badgeEarnedDate = state.badgeEarnedDate ?? null;

  const handleBack = () => navigate(`/course/${courseId}`);
  const handleViewProgress = () => navigate('/progress');

  return (
    <div className="cp-page cp-page--scrollable">
      <ArtPanel size="large" art={courseArtBook} onBack={handleBack} />

      <main className="cp-content">
        {/* Heading */}
        <div className="cpc-heading">
          <h1 className="cpl-title">You completed the course</h1>
          <p className="cpl-lead">
            All
            {' '}
            {totalLessons === 7 ? 'seven' : totalLessons}
            {' '}
            lessons and the final check are done.
          </p>
        </div>

        {/* Badge row — only shown when a badge was earned */}
        {badgeImageUrl && badgeEarnedDate && (
          <button
            type="button"
            className="cpc-course-row cpc-course-row--tappable"
            onClick={handleViewProgress}
            aria-label="View course badge"
          >
            <div className="cpc-course-row__tile">
              <img src={badgeImageUrl} alt="" aria-hidden="true" className="cpc-course-row__art" />
            </div>
            <div className="cpc-course-row__body">
              <p className="cpc-course-row__title">Course badge</p>
              <p className="cpc-course-row__sub cpc-course-row__sub--earned">
                Earned
                {' '}
                {badgeEarnedDate}
              </p>
            </div>
            <img src={chevronRight} alt="" aria-hidden="true" className="cpc-course-row__chevron" />
          </button>
        )}

        {/* Course summary row — not tappable */}
        <div className="cpc-course-row">
          <div className="cpc-course-row__tile">
            <img src={courseArtRow} alt="" aria-hidden="true" className="cpc-course-row__art" />
          </div>
          <div className="cpc-course-row__body">
            <p className="cpc-course-row__title">Sexual misconduct education</p>
            <p className="cpc-course-row__sub">Part of your total on Your progress</p>
          </div>
          <span className="cpc-course-row__points">
            +
            {totalPoints}
          </span>
        </div>

        {/* Commitment card */}
        <div className="cpc-commitment">
          <p className="cpc-commitment__title">Your commitment</p>
          <p className="cpc-commitment__body">
            Keep conversations respectful, follow stated boundaries, and report concerns safely.
          </p>
        </div>
      </main>

      <Footer
        primaryLabel="See your progress"
        secondaryLabel="Back to course"
        onPrimary={handleViewProgress}
        onSecondary={handleBack}
      />
    </div>
  );
};

// ── Retention Invite Page ──────────────────────────────────────────────────

interface RetentionInviteState {
  courseName?: string;
  retentionSequenceId?: string;
  notOpenYet?: boolean;
  opensOnDate?: string;
}

export const RetentionInvitePage = () => {
  const { courseId = '' } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as RetentionInviteState) ?? {};

  const retentionSeqId = state.retentionSequenceId ?? null;
  const notOpenYet = state.notOpenYet ?? false;
  const opensOnDate = state.opensOnDate ?? '4 December 2026';

  const handleBack = () => navigate(`/course/${courseId}`);
  const handleStartCheck = () => {
    if (retentionSeqId) {
      navigate(`/course/${courseId}/lesson/${retentionSeqId}/step/0`);
    } else {
      navigate(`/course/${courseId}`);
    }
  };

  if (notOpenYet) {
    return (
      <div className="cp-page cp-page--scrollable">
        <ArtPanel color="blue" art={badgeArtRetained} onBack={handleBack} />

        <main className="cp-content">
          <div className="cpl-heading">
            <h1 className="cpl-title">Come back in 30 days</h1>
            <p className="cpr-not-open-lead">
              Your 30-day check opens on
              {' '}
              {opensOnDate}
              .
            </p>
          </div>

          <div className="cpr-badge-row">
            <img src={badgeArtRetained} alt="" aria-hidden="true" className="cpr-badge-row__art" />
            <div className="cpr-badge-row__body">
              <p className="cpr-badge-row__title">Retained</p>
              <p className="cpr-badge-row__desc">
                Answer four of five correctly to earn it. If you miss some,
                review those topics and try again, as often as you need.
              </p>
            </div>
          </div>
        </main>

        <footer className="cp-footer">
          <button type="button" className="cp-footer__primary" onClick={handleBack}>
            Back to learning home
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="cp-page cp-page--scrollable">
      <ArtPanel color="blue" art={badgeArtRetained} onBack={handleBack} />

      <main className="cp-content">
        {/* Heading */}
        <div className="cpl-heading">
          <h1 className="cpl-title">Still with you?</h1>
          <p className="cpl-lead">
            Five questions check what stayed with you from your required courses.
          </p>
        </div>

        {/* Badge row */}
        <div className="cpr-badge-row">
          <img src={badgeArtRetained} alt="" aria-hidden="true" className="cpr-badge-row__art" />
          <div className="cpr-badge-row__body">
            <p className="cpr-badge-row__title">Retained</p>
            <p className="cpr-badge-row__desc">
              Answer four of five correctly to earn it. If you miss some,
              review those topics and try again, as often as you need.
            </p>
          </div>
        </div>
      </main>

      <Footer
        primaryLabel="Start 30-day check"
        secondaryLabel="Not now"
        onPrimary={handleStartCheck}
        onSecondary={handleBack}
      />
    </div>
  );
};

// ── Retention Check Result Page ────────────────────────────────────────────

interface RetentionCheckResultState {
  passed?: boolean;
  score?: number;
  total?: number;
}

export const RetentionCheckResultPage = () => {
  const { courseId = '' } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as RetentionCheckResultState) ?? {};

  const score = state.score ?? 4;
  const total = state.total ?? 5;
  const passed = state.passed ?? score >= Math.ceil(total * 0.8);

  const handleBack = () => navigate(`/course/${courseId}`);
  const handleViewBadge = () => navigate('/progress');
  const handleReviewCourse = () => navigate(`/course/${courseId}`);
  const handleTryAgain = () => navigate(`/course/${courseId}/retention`);

  if (passed) {
    return (
      <div className="cp-page cp-page--scrollable">
        <ArtPanel color="yellow" art={badgeArtRetained} onBack={handleBack} />

        <main className="cp-content">
          <h1 className="cpl-title">You retained the key ideas</h1>

          <div className="cpr-tile-row">
            <div className="cpr-tile cpr-tile--positive">
              <img src={iconCircleCheck} alt="" aria-hidden="true" className="cpr-tile__icon cpr-tile__icon--positive" />
              <p className="cpr-tile__value">
                {score}
                /
                {total}
              </p>
              <p className="cpr-tile__label">correct</p>
            </div>
          </div>
        </main>

        <footer className="cp-footer">
          <button type="button" className="cp-footer__primary" onClick={handleViewBadge}>
            Save result and view badge
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="cp-page cp-page--scrollable">
      <ArtPanel color="yellow" art={badgeArtRetained} onBack={handleBack} />

      <main className="cp-content">
        <h1 className="cpl-title">Worth another look</h1>

        <div className="cpr-tile-row">
          <div className="cpr-tile cpr-tile--neutral">
            <p className="cpr-tile__value">
              {score}
              /
              {total}
            </p>
            <p className="cpr-tile__label">correct</p>
          </div>
        </div>

        <p className="cpr-result-note">
          Review the missed topics, then try again, as often as you need.
        </p>
      </main>

      <Footer
        primaryLabel="Review course"
        secondaryLabel="Try again"
        onPrimary={handleReviewCourse}
        onSecondary={handleTryAgain}
      />
    </div>
  );
};
