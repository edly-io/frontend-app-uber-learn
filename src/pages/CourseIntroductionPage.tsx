import React from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getResumeBlock } from '../api/courseware';
import { qk } from '../api/queries';
import { useProgress } from '../hooks/useProgress';
import { useCourseOutline } from '../hooks/useCourseOutline';
import { mapOutlineToLessons } from '../lib/outline-mapper';
import { getStoredResumeIdx, getStoredResumeSequenceId } from '../lib/resume-storage';
import iconArrowLeft from '../assets/icons/icon-arrow-left.svg';
import iconAlert from '../assets/icons/icon-alert.svg';
import courseArtToolbox from '../assets/icons/course-art-toolbox.svg';
import courseArtBook from '../assets/icons/course-art-book.svg';
import './course-page.css';

// ── Shared art panel header ────────────────────────────────────────────────

const ArtPanel = ({
  art, color, onBack,
}: { art: string; color: 'blue' | 'green'; onBack: () => void }) => (
  <div className={`cp-art-panel cp-art-panel--${color}`}>
    <div className="cp-art-panel__halo">
      <div className="cp-art-panel__disc">
        <img src={art} alt="" className="cp-art-panel__art" />
      </div>
    </div>
    <button type="button" className="cp-back-btn" onClick={onBack} aria-label="Back">
      <img src={iconArrowLeft} alt="" className="cp-back-btn__icon" />
    </button>
  </div>
);

// ── CourseIntroductionPage ─────────────────────────────────────────────────

export const CourseIntroductionPage = () => {
  const { courseId = '' } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const handleBack = () => navigate(`/course/${courseId}`);
  const handleBegin = () => navigate(`/course/${courseId}/check/baseline`);

  return (
    <div className="course-page">
      <ArtPanel art={courseArtToolbox} color="blue" onBack={handleBack} />

      <div className="course-scroll">
        <main className="course-content">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p className="ci-kicker">Before you begin</p>
            <h1 className="ci-title">Learn at your own pace</h1>
            <p className="ci-lead">
              This course includes sensitive topics. Pause whenever you need to;
              completed progress saves automatically.
            </p>
          </div>

          <div className="cp-numbered-steps">
            <div className="cp-numbered-step">
              <div className="cp-numbered-step__num-wrap">
                <span className="cp-numbered-step__num">01</span>
              </div>
              <div className="cp-numbered-step__body">
                <p className="cp-numbered-step__title">Start with a quick check</p>
                <p className="cp-numbered-step__desc">
                  Five questions establish a baseline. They do not add or remove points.
                </p>
              </div>
            </div>
            <div className="cp-numbered-step">
              <div className="cp-numbered-step__num-wrap">
                <span className="cp-numbered-step__num">02</span>
              </div>
              <div className="cp-numbered-step__body">
                <p className="cp-numbered-step__title">Learn and practise</p>
                <p className="cp-numbered-step__desc">
                  Watch required videos, make decisions, and review the source guidance.
                </p>
              </div>
            </div>
            <div className="cp-numbered-step">
              <div className="cp-numbered-step__num-wrap">
                <span className="cp-numbered-step__num">03</span>
              </div>
              <div className="cp-numbered-step__body">
                <p className="cp-numbered-step__title">Confirm what you learned</p>
                <p className="cp-numbered-step__desc">
                  A five-question final check measures learning gain.
                </p>
              </div>
            </div>
          </div>

          <div className="ci-banner">
            <div className="ci-banner__icon-wrap">
              <img src={iconAlert} alt="" className="ci-banner__icon" />
            </div>
            <div className="ci-banner__body">
              <p className="ci-banner__title">Take care of yourself</p>
              <p className="ci-banner__desc">
                Support and reporting resources remain available throughout the course.
              </p>
            </div>
          </div>
        </main>
      </div>

      <footer className="course-footer">
        <button type="button" className="course-footer__primary" onClick={handleBegin}>
          Begin quick check
        </button>
        <button type="button" className="course-footer__secondary" onClick={handleBack}>
          Back to course
        </button>
      </footer>
    </div>
  );
};

// ── SaveAndResumePage ──────────────────────────────────────────────────────

interface SaveAndResumeState {
  completedActivities?: number;
  totalActivities?: number;
  completedLessons?: number;
  totalLessons?: number;
  fraction?: number;
  resumeSequenceId?: string;
}

export const SaveAndResumePage = () => {
  const { courseId = '' } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state as SaveAndResumeState) ?? {};

  const { data: progressData } = useProgress(courseId);
  const outlineQuery = useCourseOutline(courseId);
  const resumeQuery = useQuery({
    queryKey: qk.resume(courseId),
    queryFn: () => getResumeBlock(courseId),
    enabled: Boolean(courseId),
    staleTime: 0,
  });

  const allLessons = outlineQuery.data ? mapOutlineToLessons(outlineQuery.data) : [];

  const storedSequenceId = getStoredResumeSequenceId(courseId);
  const apiSequenceId = resumeQuery.data?.sectionId ?? null;
  const apiResumeIdx = apiSequenceId ? allLessons.findIndex((l) => l.sequenceId === apiSequenceId) : -1;
  const storedResumeIdx = getStoredResumeIdx(courseId, allLessons);
  const effectiveResumeIdx = Math.max(apiResumeIdx, storedResumeIdx);
  const effectiveResumeSequenceId = effectiveResumeIdx >= 0
    ? allLessons[effectiveResumeIdx].sequenceId
    : (storedSequenceId ?? apiSequenceId);

  const resumeSequenceId = routeState.resumeSequenceId ?? effectiveResumeSequenceId;

  const totalLessons = routeState.totalLessons ?? allLessons.length;
  const resumeIdx = resumeSequenceId
    ? allLessons.findIndex((l) => l.sequenceId === resumeSequenceId)
    : -1;
  const completedLessons = routeState.completedLessons
    ?? (resumeIdx > 0 ? resumeIdx : 0);

  const derivedFraction = totalLessons > 0 && completedLessons > 0
    ? completedLessons / totalLessons
    : 0;
  const fraction = derivedFraction > 0
    ? derivedFraction
    : (routeState.fraction ?? progressData?.fraction ?? 0);

  const completedActivities = routeState.completedActivities ?? progressData?.completedActivities ?? 0;
  const totalActivities = routeState.totalActivities ?? progressData?.totalActivities ?? 0;

  const hasProgress = completedLessons > 0 || fraction > 0 || Boolean(resumeSequenceId);
  const percentDisplay = `${Math.round(fraction * 100)}%`;

  const handleResume = () => {
    if (!resumeSequenceId) {
      navigate(`/course/${courseId}`);
      return;
    }
    navigate(`/course/${courseId}/lesson/${resumeSequenceId}/step/0`);
  };

  const handleHome = () => navigate('/');

  return (
    <div className="course-page">
      <ArtPanel art={courseArtBook} color="green" onBack={() => navigate(`/course/${courseId}`)} />

      <div className="course-scroll">
        <main className="course-content">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p className="sr-kicker">Progress saved</p>
            <h1 className="sr-title">Pick up where you left off</h1>
            <p className="sr-lead">
              {totalActivities > 0
                ? `You completed ${completedActivities} of ${totalActivities} activities. Come back whenever you're ready.`
                : completedLessons > 0 && totalLessons > 0
                  ? `You completed ${completedLessons} of ${totalLessons} lessons. Come back whenever you're ready.`
                  : "Your progress is saved. Come back whenever you're ready."}
            </p>
          </div>

          {hasProgress && totalLessons > 0 && (
            <div className="sr-progress">
              <div className="sr-progress-labels">
                <span className="sr-progress-label">
                  {`${completedLessons} of ${totalLessons} lessons complete`}
                </span>
                <span className="sr-progress-percent">{percentDisplay}</span>
              </div>
              <div className="sr-progress-track">
                <div className="sr-progress-fill" style={{ width: `${Math.round(fraction * 100)}%` }} />
              </div>
            </div>
          )}
        </main>
      </div>

      <footer className="course-footer">
        <button type="button" className="course-footer__primary" onClick={handleResume}>
          Resume where you left off
        </button>
        <button type="button" className="course-footer__secondary" onClick={handleHome}>
          Back to learning home
        </button>
      </footer>
    </div>
  );
};
