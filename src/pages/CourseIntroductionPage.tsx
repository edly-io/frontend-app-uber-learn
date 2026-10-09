import React from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getResumeBlock } from '../api/courseware';
import { qk } from '../api/queries';
import { useCourseOutline } from '../hooks/useCourseOutline';
import { mapOutlineToLessons } from '../lib/outline-mapper';
import { getStoredResumeIdx, getStoredResumeSequenceId } from '../lib/resume-storage';
import iconArrowLeft from '../assets/icons/icon-arrow-left.svg';
import iconAlert from '../assets/icons/icon-alert.svg';
import courseArtToolbox from '../assets/icons/course-art-toolbox.svg';
import courseArtBook from '../assets/icons/course-art-book.svg';
import './course-page.scss';

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
  const outlineQuery = useCourseOutline(courseId);

  const handleBack = () => navigate(`/course/${courseId}`);

  const handleBegin = () => {
    const lessons = outlineQuery.data ? mapOutlineToLessons(outlineQuery.data) : [];
    const firstLesson = lessons[0];
    if (firstLesson) {
      navigate(`/course/${courseId}/lesson/${firstLesson.sequenceId}/step/0`);
    } else {
      navigate(`/course/${courseId}`);
    }
  };

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
                <p className="cp-numbered-step__title">Learn and practise</p>
                <p className="cp-numbered-step__desc">
                  Watch required videos, make decisions, and review the source guidance.
                </p>
              </div>
            </div>
            <div className="cp-numbered-step">
              <div className="cp-numbered-step__num-wrap">
                <span className="cp-numbered-step__num">02</span>
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
        <button
          type="button"
          className="course-footer__primary"
          onClick={handleBegin}
          disabled={outlineQuery.isLoading}
        >
          Start course
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
    : (routeState.fraction ?? 0);

  const hasProgress = completedLessons > 0 || fraction > 0 || Boolean(resumeSequenceId);

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
      <ArtPanel art={courseArtBook} color="blue" onBack={() => navigate(`/course/${courseId}`)} />

      <div className="course-scroll">
        <main className="course-content">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p className="sr-kicker">{outlineQuery.data?.title ?? ''}</p>
            <h1 className="sr-title">Progress saved</h1>
            <p className="sr-lead">
              {resumeIdx >= 0
                ? `Lesson ${resumeIdx + 1} keeps your place. Come back whenever you're ready.`
                : "Your progress is saved. Come back whenever you're ready."}
            </p>
          </div>

          {hasProgress && totalLessons > 0 && (
            <div className="sr-progress">
              <div className="sr-progress-labels">
                <span className="sr-progress-label">
                  {`${completedLessons} of ${totalLessons} lessons complete`}
                </span>
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
          {resumeIdx >= 0 ? `Resume lesson ${resumeIdx + 1}` : 'Resume where you left off'}
        </button>
        <button type="button" className="course-footer__secondary" onClick={handleHome}>
          Back to learning home
        </button>
      </footer>
    </div>
  );
};
