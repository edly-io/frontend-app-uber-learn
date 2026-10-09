import React, {
  useState, useCallback, useEffect, useMemo, useRef,
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { getConfig } from '@edx/frontend-platform';
import { useSequence } from '../hooks/useSequence';
import { useCourseOutline } from '../hooks/useCourseOutline';
import { mapOutlineToLessons } from '../lib/outline-mapper';
import { useAssessmentSubmit } from '../hooks/useAssessmentSubmit';
import { AlreadyPassedError, AssessmentIncompleteError, recordActivity } from '../api/progress';
import { getLessonResults } from '../api/gamification';
import { useGamification } from '../hooks/useGamification';
import { qk } from '../api/queries';
import { ContentIFrame } from '../components/content-iframe/ContentIFrame';
import { ButtonDock } from '../components/button-dock/ButtonDock';
import { NavHeader } from '../components/nav-header/NavHeader';
import { StepIndicator } from '../components/step-indicator/StepIndicator';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorView } from '../components/ui/ErrorView';
import {
  AssessmentResultOverlay,
  type OverlayAssessmentType,
} from '../components/assessment-result-overlay/AssessmentResultOverlay';
import { OfflineView } from '../components/offline-view/OfflineView';
import { storeResumeSequence } from '../lib/resume-storage';

function getLmsOrigin(): string {
  return new URL(getConfig().LMS_BASE_URL).origin;
}

export const ActivityView = () => {
  const {
    courseId = '',
    sequenceId = '',
    unitIdx: unitIdxParam = '0',
  } = useParams<{ courseId: string; sequenceId: string; unitIdx: string }>();

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const unitIdx = parseInt(unitIdxParam, 10);

  // Completion and visibility are tied to the step rather than kept as booleans reset in an
  // effect: the effect only runs after the first render of a new step, so for that render the
  // previous step's "completed"/"loaded" state would leak through (enabled Continue, no spinner).
  // completedUnitId: the unit whose iframe sent plugin.completed. shownVisit: the visit (below)
  // whose iframe content is on screen.
  const [completedUnitId, setCompletedUnitId] = useState<string | null>(null);
  const [shownVisit, setShownVisit] = useState<number | null>(null);
  const lastCorrectRef = useRef<boolean | null>(null);

  // Capture server_time when the lesson mounts so it can be used as the `since`
  // value for the lesson results endpoint. Using server_time (not device clock)
  // prevents a fast device clock from making a first run look like a repeat.
  const { data: gamificationData } = useGamification();
  const serverTimeRef = useRef<string>(new Date().toISOString());
  useEffect(() => {
    if (gamificationData?.server_time) {
      serverTimeRef.current = gamificationData.server_time;
    }
  // Only capture on mount (sequenceId change = new lesson)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sequenceId]);

  // Network availability — drives the offline error screen
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  const {
    sequence, units, isLoading, isError, error,
  } = useSequence(sequenceId);

  // Course outline — needed to find the next sequence after this one
  const outlineQuery = useCourseOutline(courseId);
  const allLessons = outlineQuery.data ? mapOutlineToLessons(outlineQuery.data) : [];
  const currentLessonIdx = allLessons.findIndex((l) => l.sequenceId === sequenceId);
  const nextLesson = currentLessonIdx >= 0 ? allLessons[currentLessonIdx + 1] : null;

  const currentAssessmentType = null;
  const isAssessmentSequence = false;

  const {
    submit: submitAssessmentResult,
    isSubmitting,
    result: assessmentResult,
    error: assessmentError,
    resetResult,
  } = useAssessmentSubmit();

  const currentUnit = units[unitIdx];
  const currentUnitId = currentUnit?.id ?? null;

  // Gate Continue on plugin.completed for units that require interaction:
  // standard CAPA (contentType === 'problem') and graded custom XBlocks like
  // sortable/DnD-v2 (graded === true). Plain HTML/text units auto-enable once shown.
  const isProblemUnit = currentUnit?.contentType === 'problem' || currentUnit?.graded === true;

  // Reset correctness whenever the unit changes, so an answer from a previous
  // step is never recorded against this one.
  // Also record this as the furthest-reached sequence so CourseOverview and
  // SaveAndResumePage can show accurate progress even when the LMS resume
  // block hasn't caught up (common with demo courses).
  useEffect(() => {
    lastCorrectRef.current = null;
    if (sequenceId && courseId) {
      storeResumeSequence(courseId, sequenceId);
    }
  }, [sequenceId, unitIdx, courseId]);

  // Each visit to a step gets its own number, so coming back to a step (A → B → A before B
  // showed) still shows the spinner while that step's iframe reloads.
  const visitRef = useRef<{ unitId: string | null; visit: number }>({ unitId: null, visit: 0 });
  if (visitRef.current.unitId !== currentUnitId) {
    visitRef.current = { unitId: currentUnitId, visit: visitRef.current.visit + 1 };
  }
  const currentVisit = visitRef.current.visit;
  const isIframeLoaded = currentUnitId !== null && shownVisit === currentVisit;

  // Worked out on every render rather than stored. A step is complete when its iframe sent
  // plugin.completed, or when it is a problem unit the learner already completed on an earlier
  // visit (CAPA XBlocks may not re-fire plugin.completed on revisit), or when it is any other
  // unit and its content is on screen. Problem units otherwise wait for plugin.completed, even
  // after their content shows.
  const isCompleted = currentUnitId !== null && (
    completedUnitId === currentUnitId
    || (isProblemUnit ? Boolean(currentUnit?.complete) : (!isAssessmentSequence && isIframeLoaded))
  );

  const handleCompleted = useCallback((correct: boolean | null) => {
    lastCorrectRef.current = correct;
    setCompletedUnitId(currentUnitId);
  }, [currentUnitId]);

  // Called when the unit's content is on screen: its iframe's load event or, in lightweight mode,
  // the iframe's first plugin.resize if that comes first (load also waits for e.g. a video's first
  // frame, which can take seconds on mobile). Marks the frame visible, which also completes
  // non-problem content (HTML, video, ...) — standard Open edX XBlocks don't send plugin.completed.
  // Lightweight mode is per site: MFE_CONFIG_OVERRIDES["uber-learn"].UBER_LIGHTWEIGHT_IFRAMES
  // (see tutor-contrib-uber), the same flag that trims what the LMS loads in these iframes.
  // The flag must be a JSON boolean: the string "true" leaves it off.
  const isLightweightMode = getConfig().UBER_LIGHTWEIGHT_IFRAMES === true;
  const handleContentShown = useCallback(() => {
    setShownVisit(currentVisit);
  }, [currentVisit]);

  const handleContinue = useCallback(async () => {
    if (!isCompleted) { return; }

    // Notify iframe of continue click so XBlocks can trigger submission
    const frame = document.querySelector<HTMLIFrameElement>('.content-iframe-frame');
    if (frame?.contentWindow) {
      frame.contentWindow.postMessage(
        { type: 'uber.continueClicked', version: 1 },
        getLmsOrigin(),
      );
    }

    // Record activity on the backend (fire-and-forget — don't block navigation on failure)
    if (currentUnit) {
      recordActivity({
        courseId,
        unitId: currentUnit.id,
        correct: lastCorrectRef.current,
      }).catch(() => {});
    }

    const nextIdx = unitIdx + 1;
    const isLastUnit = nextIdx >= units.length;

    if (isLastUnit && isAssessmentSequence && currentAssessmentType) {
      submitAssessmentResult(courseId, currentAssessmentType);
      return;
    }

    if (nextIdx < units.length) {
      navigate(`/course/${courseId}/lesson/${sequenceId}/step/${nextIdx}`);
    } else {
      // Fetch real points/accuracy from the backend before showing the completion screen.
      // Falls back to safe defaults if the request fails (e.g. no connectivity).
      let isRepeat = false;

      try {
        const results = await getLessonResults(sequenceId, serverTimeRef.current);
        isRepeat = results.already_completed_before;
      } catch {
        // Network failure or 404 (lesson not yet in DB) — proceed with defaults
      }

      // Advance the stored resume point to the next lesson so the catalog
      // shows "Continue" (not "Start") as soon as this lesson finishes.
      if (nextLesson) {
        storeResumeSequence(courseId, nextLesson.sequenceId);
      }

      // Invalidate gamification cache so Points/Streak tabs reflect new totals.
      queryClient.invalidateQueries({ queryKey: qk.gamification() });

      navigate(`/course/${courseId}/lesson-complete`, {
        state: {
          lessonTitle: sequence?.title ?? 'Lesson',
          lessonNumber: currentLessonIdx >= 0 ? currentLessonIdx + 1 : 1,
          nextSequenceId: nextLesson?.sequenceId ?? null,
          nextLessonTitle: nextLesson?.lessonTitle ?? '',
          nextLessonSubtitle: nextLesson?.sectionTitle ?? '',
          isRepeat,
        },
      });
    }
  }, [
    isCompleted,
    currentUnit,
    unitIdx,
    units.length,
    isAssessmentSequence,
    currentAssessmentType,
    courseId,
    sequenceId,
    navigate,
    submitAssessmentResult,
    sequence,
    currentLessonIdx,
    nextLesson,
    queryClient,
  ]);

  // Back arrow: step back within the lesson; if on step 0, go to course overview
  const handleBack = useCallback(() => {
    if (unitIdx > 0) {
      navigate(`/course/${courseId}/lesson/${sequenceId}/step/${unitIdx - 1}`);
    } else {
      navigate(`/course/${courseId}`);
    }
  }, [navigate, courseId, sequenceId, unitIdx]);

  // X close button: exit to save-and-resume page. Pass current position so
  // SaveAndResumePage can display accurate progress without waiting on the API.
  const handleClose = useCallback(() => {
    navigate(`/course/${courseId}/resume`, {
      state: {
        resumeSequenceId: sequenceId,
        completedLessons: currentLessonIdx > 0 ? currentLessonIdx : 0,
        totalLessons: allLessons.length,
      },
    });
  }, [navigate, courseId, sequenceId, currentLessonIdx, allLessons.length]);

  const handleOverlayClose = useCallback(() => {
    resetResult();
    navigate(`/course/${courseId}`);
  }, [resetResult, navigate, courseId]);

  const overlayAssessmentType: OverlayAssessmentType | null = useMemo(() => {
    if (!assessmentResult && !assessmentError) { return null; }
    if (assessmentError instanceof AlreadyPassedError) { return 'already_passed'; }
    if (assessmentError instanceof AssessmentIncompleteError) { return 'assessment_incomplete'; }
    if (assessmentError) { return 'submission_error'; }
    return currentAssessmentType;
  }, [assessmentResult, assessmentError, currentAssessmentType]);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden',
      }}
      >
        <NavHeader title="Loading…" onBack={handleBack} onClose={handleClose} />
        <LoadingSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorView
        title="Could not load lesson"
        message={error?.message ?? 'Please try again.'}
        onRetry={() => queryClient.invalidateQueries({ queryKey: qk.sequence(sequenceId) })}
      />
    );
  }

  if (!currentUnit) {
    return (
      <ErrorView
        title="Step not found"
        message="This step does not exist in the current lesson."
        onRetry={handleBack}
      />
    );
  }

  const lessonTitle = sequence?.title ?? 'Lesson';
  const lessonNavTitle = allLessons.length > 0 && currentLessonIdx >= 0
    ? `Lesson ${currentLessonIdx + 1} of ${allLessons.length}`
    : lessonTitle;

  // Show the Figma offline screen when the device loses connectivity
  if (isOffline) {
    return (
      <OfflineView
        title={lessonTitle}
        onBack={handleBack}
        onRetry={() => {
          if (navigator.onLine) {
            setIsOffline(false);
          }
        }}
      />
    );
  }

  const isLastUnit = unitIdx >= units.length - 1;

  // eslint-disable-next-line no-nested-ternary
  const buttonLabel = isAssessmentSequence && isLastUnit
    ? 'Submit'
    : unitIdx < units.length - 1 ? 'Continue' : 'Finish';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      overflow: 'hidden',
    }}
    >
      <NavHeader
        title={lessonNavTitle}
        onBack={handleBack}
        onClose={handleClose}
      />

      <StepIndicator current={unitIdx} total={units.length} />

      <main style={{
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
      >
        {!isIframeLoaded && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--u-background-primary)',
              zIndex: 1,
            }}
            aria-hidden="true"
          >
            <div className="content-iframe-spinner" />
          </div>
        )}
        <ContentIFrame
          key={currentUnit.id}
          usageKey={currentUnit.id}
          onCompleted={handleCompleted}
          onContentReady={isLightweightMode ? handleContentShown : undefined}
          onLoad={handleContentShown}
        />
      </main>

      <ButtonDock
        onContinue={handleContinue}
        disabled={!isCompleted || isSubmitting}
        label={isSubmitting ? 'Submitting…' : buttonLabel}
      />

      {/* Assessment result overlay — shown when submission resolves */}
      {overlayAssessmentType && (
        <AssessmentResultOverlay
          assessmentType={overlayAssessmentType}
          attempt={assessmentResult?.attempt ?? null}
          badgesAwardedNow={assessmentResult?.badgesAwardedNow ?? []}
          onClose={handleOverlayClose}
        />
      )}

    </div>
  );
};
