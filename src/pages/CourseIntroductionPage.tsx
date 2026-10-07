import React from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getResumeBlock } from '../api/courseware';
import { qk } from '../api/queries';
import { useProgress } from '../hooks/useProgress';
import { useCourseOutline } from '../hooks/useCourseOutline';
import { mapOutlineToLessons } from '../lib/outline-mapper';
import { getStoredResumeIdx, getStoredResumeSequenceId } from '../lib/resume-storage';
import { NavHeader } from '../components/nav-header/NavHeader';
import './course-page.css';

// ── Alert icon ─────────────────────────────────────────────────────────────

const AlertIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      stroke="#b45309"
      strokeWidth="1.5"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line x1="12" y1="9" x2="12" y2="13" stroke="#b45309" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="12" cy="17" r="0.5" fill="#b45309" stroke="#b45309" strokeWidth="1" />
  </svg>
);

// ── CourseIntroductionPage ─────────────────────────────────────────────────

export const CourseIntroductionPage = () => {
  const { courseId = '' } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const handleBack = () => navigate(`/course/${courseId}`);
  const handleBegin = () => navigate(`/course/${courseId}/check/baseline`);

  return (
    <div className="course-page">
      <NavHeader title="Course introduction" onBack={handleBack} />

      <div className="course-scroll">
        <main className="course-content">
          <p className="ci-kicker">Before you begin</p>
          <h1 className="ci-title">Learn at your own pace</h1>
          <p className="ci-lead">
            This course includes sensitive topics. Pause whenever you need to;
            completed progress saves automatically.
          </p>

          <div className="ci-steps">
            <div className="ci-step">
              <span className="ci-step__num">01</span>
              <div className="ci-step__text">
                <p className="ci-step__title">Start with a quick check</p>
                <p className="ci-step__desc">
                  Five questions establish a baseline. They do not add or remove points.
                </p>
              </div>
            </div>
            <div className="ci-step">
              <span className="ci-step__num">02</span>
              <div className="ci-step__text">
                <p className="ci-step__title">Learn and practise</p>
                <p className="ci-step__desc">
                  Watch required videos, make decisions, and review the source guidance.
                </p>
              </div>
            </div>
            <div className="ci-step">
              <span className="ci-step__num">03</span>
              <div className="ci-step__text">
                <p className="ci-step__title">Confirm what you learned</p>
                <p className="ci-step__desc">
                  A five-question final check measures learning gain.
                </p>
              </div>
            </div>
          </div>

          <div className="ci-banner">
            <div className="ci-banner__icon-wrap">
              <AlertIcon />
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

  // Resume sequence priority: navigation state (from X button) > localStorage
  // (tracked whenever user enters ActivityView) > LMS resume block API.
  const storedSequenceId = getStoredResumeSequenceId(courseId);
  const apiSequenceId = resumeQuery.data?.sectionId ?? null;
  const apiResumeIdx = apiSequenceId ? allLessons.findIndex((l) => l.sequenceId === apiSequenceId) : -1;
  const storedResumeIdx = getStoredResumeIdx(courseId, allLessons);
  const effectiveResumeIdx = Math.max(apiResumeIdx, storedResumeIdx);
  const effectiveResumeSequenceId = effectiveResumeIdx >= 0
    ? allLessons[effectiveResumeIdx].sequenceId
    : (storedSequenceId ?? apiSequenceId);

  const resumeSequenceId = routeState.resumeSequenceId ?? effectiveResumeSequenceId;

  // Lesson counts derived from outline + resume position — reliable even when
  // the progress API returns zero (e.g. demo courses without activity tracking).
  const totalLessons = routeState.totalLessons ?? allLessons.length;
  const resumeIdx = resumeSequenceId
    ? allLessons.findIndex((l) => l.sequenceId === resumeSequenceId)
    : -1;
  const completedLessons = routeState.completedLessons
    ?? (resumeIdx > 0 ? resumeIdx : 0);

  // Fraction: prefer outline-derived, then progress API
  const derivedFraction = totalLessons > 0 && completedLessons > 0
    ? completedLessons / totalLessons
    : 0;
  const fraction = derivedFraction > 0
    ? derivedFraction
    : (routeState.fraction ?? progressData?.fraction ?? 0);

  // Activity counts from progress API (may be 0 if not tracked)
  const completedActivities = routeState.completedActivities ?? progressData?.completedActivities ?? 0;
  const totalActivities = routeState.totalActivities ?? progressData?.totalActivities ?? 0;

  // Show progress whenever user has a resume point or any completion
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

  const lessonsLead = completedLessons > 0 && totalLessons > 0
    ? `You completed ${completedLessons} of ${totalLessons} lessons. Come back whenever you’re ready.`
    : 'Your progress is saved. Come back whenever you’re ready.';
  const progressLead = totalActivities > 0
    ? `You completed ${completedActivities} of ${totalActivities} activities. Come back whenever you’re ready.`
    : lessonsLead;

  return (
    <div className="course-page">
      <NavHeader title="Progress saved" onBack={() => navigate(`/course/${courseId}`)} />

      <div className="course-scroll">
        <main className="course-content">
          <p className="sr-kicker">Progress saved</p>
          <h1 className="sr-title">Pick up where you left off</h1>
          <p className="sr-lead">
            {progressLead}
          </p>

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
