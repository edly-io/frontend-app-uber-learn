import React from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useProgress } from '../hooks/useProgress';
import courseArtBook from '../assets/icons/course-art-book.svg';
import courseArtRow from '../assets/icons/course-art-row.svg';
import iconArrowLeft from '../assets/icons/icon-arrow-left.svg';
import iconLightning from '../assets/icons/icon-lightning.svg';
import iconCircleCheck from '../assets/icons/icon-circle-check.svg';
import ringTrack from '../assets/icons/ring-track.svg';
import ringProgress from '../assets/icons/ring-progress.svg';
import chevronRight from '../assets/icons/chevron-right.svg';
import badgeArtRetained from '../assets/icons/badge-art-retained.svg';
import './completion-page.css';

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
  nextSequenceId?: string | null;
  isRepeat?: boolean;
  stepsReviewed?: number;
  isLastLesson?: boolean;
  accuracyPercent?: number;
  finalCheckSequenceId?: string | null;
}

// Day labels for the This week widget
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const LessonCompletePage = () => {
  const { courseId = '' } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LessonCompleteState) ?? {};

  const { data: progressData } = useProgress(courseId);

  const lessonTitle = state.lessonTitle ?? 'Lesson complete';
  const lessonNumber = state.lessonNumber ?? 1;
  const pointsEarned = state.pointsEarned ?? 30;
  const nextLessonTitle = state.nextLessonTitle ?? '';
  const nextSequenceId = state.nextSequenceId;
  const isRepeat = state.isRepeat ?? false;
  const stepsReviewed = state.stepsReviewed ?? 4;
  const isLastLesson = state.isLastLesson ?? false;
  const accuracyPercent = state.accuracyPercent ?? 100;
  const finalCheckSequenceId = state.finalCheckSequenceId;

  const derivedTotal = progressData?.totalActivities
    ? Math.ceil(progressData.totalActivities / 5) : 7;
  const totalCount = derivedTotal;
  const completedCount = lessonNumber;
  const percent = totalCount > 0 ? Math.min(100, Math.round((completedCount / totalCount) * 100)) : 0;

  // Compute "this week" state from today's day of week (0 = Sun … 6 = Sat)
  // Map to M T W T F S S order (Mon-first)
  const todayJsDay = new Date().getDay(); // 0=Sun
  const todayIdx = todayJsDay === 0 ? 6 : todayJsDay - 1; // 0=Mon … 6=Sun

  const handleBack = () => navigate(`/course/${courseId}`);
  const handleStartNext = () => {
    if (isLastLesson && finalCheckSequenceId) {
      navigate(`/course/${courseId}/lesson/${finalCheckSequenceId}/step/0`);
    } else if (nextSequenceId) {
      navigate(`/course/${courseId}/lesson/${nextSequenceId}/step/0`);
    } else {
      navigate(`/course/${courseId}`);
    }
  };

  return (
    <div className="cp-page cp-page--scrollable">
      <ArtPanel art={courseArtBook} onBack={handleBack} />

      <main className="cp-content">
        {/* Heading */}
        <div className="cpl-heading">
          <p className="cpl-kicker">
            Lesson
            {' '}
            {lessonNumber}
            {' '}
            complete
          </p>
          <h1 className="cpl-title">{lessonTitle}</h1>
          {state.lessonDescription && (
            <p className="cpl-lead">{state.lessonDescription}</p>
          )}
        </div>

        {/* Result tiles */}
        {isRepeat ? (
          <>
            <div className="cpl-tiles">
              <div className="cpl-tile cpl-tile--neutral cpl-tile--single">
                <p className="cpl-tile__value">{stepsReviewed}</p>
                <p className="cpl-tile__label">steps reviewed</p>
              </div>
            </div>
            <p className="cpl-repeat-note">
              You&apos;ve finished this lesson before, so it adds no points.
            </p>
          </>
        ) : (
          <div className="cpl-tiles">
            <div className="cpl-tile cpl-tile--points">
              <img src={iconLightning} alt="" aria-hidden="true" className="cpl-tile__icon" />
              <p className="cpl-tile__value">
                +
                {pointsEarned}
              </p>
              <p className="cpl-tile__label">points</p>
            </div>
            <div className="cpl-tile cpl-tile--accuracy">
              <img src={iconCircleCheck} alt="" aria-hidden="true" className="cpl-tile__icon cpl-tile__icon--positive" />
              <p className="cpl-tile__value">
                {accuracyPercent}
                %
              </p>
              <p className="cpl-tile__label">correct</p>
            </div>
          </div>
        )}

        {/* This week widget */}
        <div className="cpl-week">
          <div className="cpl-week__goal">
            <div className="cpl-week__ring" aria-hidden="true">
              <img src={ringTrack} alt="" className="cpl-week__ring-layer" />
              <img src={ringProgress} alt="" className="cpl-week__ring-layer" />
              <span className="cpl-week__ring-label">2/2</span>
            </div>
            <div className="cpl-week__words">
              <p className="cpl-week__title">Goal met this week</p>
              <p className="cpl-week__subtitle">
                Your streak grows to 3 weeks when the week ends.
              </p>
            </div>
          </div>
          <div className="cpl-week__days" aria-label="Learning days this week">
            {DAY_LABELS.map((label, idx) => {
              const isPast = idx < todayIdx;
              const isToday = idx === todayIdx;
              // Mark past + today as "learned" for demo; upcoming days are empty
              const learned = isPast || isToday;
              return (
                // eslint-disable-next-line react/no-array-index-key
                <div key={idx} className="cpl-week__day-col">
                  <div
                    className={`cpl-week__dot ${learned ? 'cpl-week__dot--learned' : 'cpl-week__dot--upcoming'}`}
                    aria-hidden="true"
                  >
                    {learned && (
                      <img src={iconCircleCheck} alt="" className="cpl-week__dot-check" />
                    )}
                  </div>
                  <span className={`cpl-week__day-label${isToday ? ' cpl-week__day-label--today' : ''}`}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Course progress bar */}
        <ProgressBar
          completedCount={completedCount}
          totalCount={totalCount}
          percent={percent}
        />

        {/* Next lesson / final check card */}
        {(nextLessonTitle || isLastLesson) && (
          <button
            type="button"
            className="cpl-next-card"
            onClick={handleStartNext}
          >
            <div className="cpl-next-card__body">
              <p className="cpl-next-card__kicker">
                {isLastLesson ? 'Last step' : 'Next lesson'}
              </p>
              <p className="cpl-next-card__title">
                {isLastLesson ? 'Final check' : nextLessonTitle}
              </p>
              {(state.nextLessonSubtitle || isLastLesson) && (
                <p className="cpl-next-card__sub">
                  {isLastLesson ? '5 questions · about 3 min' : state.nextLessonSubtitle}
                </p>
              )}
            </div>
            <img src={chevronRight} alt="" aria-hidden="true" className="cpl-next-card__chevron" />
          </button>
        )}
      </main>

      <Footer
        primaryLabel={isLastLesson ? 'Start final check' : `Start lesson ${lessonNumber + 1}`}
        secondaryLabel="Back to course"
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
}

export const CourseCompletePage = () => {
  const { courseId = '' } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as CourseCompleteState) ?? {};

  const { data: progressData } = useProgress(courseId);

  const totalLessons = state.totalLessons
    ?? (progressData?.totalActivities ? Math.ceil(progressData.totalActivities / 5) : 7);
  const totalPoints = state.totalPoints ?? (progressData?.points?.earned ?? 360);

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

        {/* Course row */}
        <div className="cpc-course-row">
          <div className="cpc-course-row__tile">
            <img src={courseArtRow} alt="" aria-hidden="true" className="cpc-course-row__art" />
          </div>
          <div className="cpc-course-row__body">
            <p className="cpc-course-row__title">Sexual misconduct education</p>
            <p className="cpc-course-row__sub">Part of your total on Your progress</p>
          </div>
          <p className="cpc-course-row__points">
            +
            {totalPoints}
          </p>
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

  const { data: progressData } = useProgress(courseId);
  const retentionSeqId = state.retentionSequenceId
    ?? progressData?.assessments?.retention?.sequenceKey
    ?? null;
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
