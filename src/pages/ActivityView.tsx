import React, {
  useState, useCallback, useEffect, useMemo, useRef,
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getConfig } from '@edx/frontend-platform';
import { useSequence } from '../hooks/useSequence';
import { useProgress } from '../hooks/useProgress';
import { useCourseOutline } from '../hooks/useCourseOutline';
import { mapOutlineToLessons } from '../lib/outline-mapper';
import { useAssessmentSubmit } from '../hooks/useAssessmentSubmit';
import { recordActivity, AlreadyPassedError } from '../api/progress';
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

type AssessmentSequenceType = 'baseline' | 'final' | 'retention';

function detectAssessmentSequenceType(
  sequenceId: string,
  assessments: {
    baseline: { sequenceKey: string | null } | null;
    final: { sequenceKey: string | null } | null;
    retention: { sequenceKey: string | null } | null;
  } | null | undefined,
): AssessmentSequenceType | null {
  if (!assessments || !sequenceId) { return null; }
  if (assessments.baseline?.sequenceKey === sequenceId) { return 'baseline'; }
  if (assessments.final?.sequenceKey === sequenceId) { return 'final'; }
  if (assessments.retention?.sequenceKey === sequenceId) { return 'retention'; }
  return null;
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
  // Track correctness from plugin.completed so it can be forwarded to the Progress API.
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);

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

  // Read assessments from the progress query to detect assessment sequences.
  const { data: progressData, isSuccess: isProgressLoaded } = useProgress(courseId);

  // Course outline — needed to find the next sequence after this one
  const outlineQuery = useCourseOutline(courseId);
  const allLessons = outlineQuery.data ? mapOutlineToLessons(outlineQuery.data) : [];
  const currentLessonIdx = allLessons.findIndex((l) => l.sequenceId === sequenceId);
  const nextLesson = currentLessonIdx >= 0 ? allLessons[currentLessonIdx + 1] : null;

  // Determine if this sequence is an assessment sequence
  const currentAssessmentType = useMemo(
    () => detectAssessmentSequenceType(sequenceId, progressData?.assessments ?? null),
    [sequenceId, progressData?.assessments],
  );
  const isAssessmentSequence = currentAssessmentType !== null;

  const {
    submit: submitAssessmentResult,
    isSubmitting,
    result: assessmentResult,
    error: assessmentError,
    resetResult,
  } = useAssessmentSubmit();

  // Reset correctness whenever the unit changes.
  // Also record this as the furthest-reached sequence so CourseOverview and
  // SaveAndResumePage can show accurate progress even when the LMS resume
  // block hasn't caught up (common with demo courses).
  useEffect(() => {
    setLastCorrect(null);
    if (sequenceId && courseId) {
      storeResumeSequence(courseId, sequenceId);
    }
  }, [sequenceId, unitIdx, courseId]);

  const currentUnit = units[unitIdx];
  const currentUnitId = currentUnit?.id ?? null;

  // Each visit to a step gets its own number, so coming back to a step (A → B → A before B
  // showed) still shows the spinner while that step's iframe reloads.
  const visitRef = useRef<{ unitId: string | null; visit: number }>({ unitId: null, visit: 0 });
  if (visitRef.current.unitId !== currentUnitId) {
    visitRef.current = { unitId: currentUnitId, visit: visitRef.current.visit + 1 };
  }
  const currentVisit = visitRef.current.visit;
  const isIframeLoaded = currentUnitId !== null && shownVisit === currentVisit;

  // Worked out on every render rather than stored, so it follows the progress query: regular
  // content completes once it is shown, but only after progress has loaded and confirmed this is
  // not an assessment sequence. Assessment steps need plugin.completed. If progress loads (or
  // turns out to be an assessment) after the content showed, the button locks again.
  const isCompleted = currentUnitId !== null && (
    completedUnitId === currentUnitId
    || (isProgressLoaded && !isAssessmentSequence && isIframeLoaded)
  );

  const recordMutation = useMutation({
    mutationFn: (correct: boolean | null) => recordActivity({
      courseId,
      unitId: currentUnit?.id ?? '',
      correct,
    }),
    onSuccess: () => {
      // Invalidate progress so the progress bar and assessment keys stay current
      queryClient.invalidateQueries({ queryKey: qk.progress(courseId) });
    },
  });

  const handleCompleted = useCallback((correct: boolean | null) => {
    // eslint-disable-next-line no-console
    console.debug('[ActivityView] plugin.completed received, correct=', correct);
    setLastCorrect(correct);
    setCompletedUnitId(currentUnitId);
  }, [currentUnitId]);

  // Called when the unit's content is on screen: its iframe's load event or, in lightweight mode,
  // the iframe's first plugin.resize if that comes first (load also waits for e.g. a video's first
  // frame, which can take seconds on mobile). Marks the frame visible, which also completes
  // regular (non-assessment) content — standard Open edX XBlocks don't send plugin.completed.
  // Lightweight mode is per site: MFE_CONFIG_OVERRIDES["uber-learn"].UBER_LIGHTWEIGHT_IFRAMES
  // (see tutor-contrib-uber), the same flag that trims what the LMS loads in these iframes.
  // The flag must be a JSON boolean: the string "true" leaves it off.
  const isLightweightMode = getConfig().UBER_LIGHTWEIGHT_IFRAMES === true;
  const handleContentShown = useCallback(() => {
    setShownVisit(currentVisit);
  }, [currentVisit]);

  const handleContinue = useCallback(() => {
    if (!isCompleted) { return; }

    // Notify iframe of continue click so XBlocks can trigger submission
    const frame = document.querySelector<HTMLIFrameElement>('.content-iframe-frame');
    if (frame?.contentWindow) {
      frame.contentWindow.postMessage(
        { type: 'uber.continueClicked', version: 1 },
        getLmsOrigin(),
      );
    }

    const nextIdx = unitIdx + 1;
    const isLastUnit = nextIdx >= units.length;

    if (isLastUnit && isAssessmentSequence && currentAssessmentType) {
      // Last unit of an assessment sequence: submit the assessment, do not navigate yet.
      // Record the activity first, then submit assessment.
      recordMutation.mutate(lastCorrect);
      submitAssessmentResult(courseId, currentAssessmentType);
      return;
    }

    // Non-assessment: record activity and navigate
    recordMutation.mutate(lastCorrect);

    if (nextIdx < units.length) {
      navigate(`/course/${courseId}/lesson/${sequenceId}/step/${nextIdx}`);
    } else {
      // Last unit in a non-assessment sequence — navigate to lesson complete page
      navigate(`/course/${courseId}/lesson-complete`, {
        state: {
          lessonTitle: sequence?.title ?? 'Lesson',
          lessonNumber: currentLessonIdx >= 0 ? currentLessonIdx + 1 : 1,
          pointsEarned: 30,
          accountTotal: (progressData?.points?.earned ?? 0) + 30,
          nextSequenceId: nextLesson?.sequenceId ?? null,
          nextLessonTitle: nextLesson?.lessonTitle ?? '',
          nextLessonSubtitle: nextLesson?.sectionTitle ?? '',
        },
      });
    }
  }, [
    isCompleted,
    lastCorrect,
    recordMutation,
    unitIdx,
    units.length,
    isAssessmentSequence,
    currentAssessmentType,
    courseId,
    sequenceId,
    navigate,
    submitAssessmentResult,
    sequence,
    progressData,
    currentLessonIdx,
    nextLesson,
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

  // Determine overlay assessment type — 409 maps to already_passed
  const overlayAssessmentType: OverlayAssessmentType | null = useMemo(() => {
    if (!assessmentResult && !assessmentError) { return null; }
    if (assessmentError instanceof AlreadyPassedError) { return 'already_passed'; }
    return currentAssessmentType;
  }, [assessmentResult, assessmentError, currentAssessmentType]);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden',
      }}
      >
        <NavHeader title="Loading…" onBack={handleBack} />
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
  const lessonKicker = allLessons.length > 0 && currentLessonIdx >= 0
    ? `LESSON ${currentLessonIdx + 1} / ${allLessons.length}`
    : undefined;

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
        title={lessonTitle}
        onBack={handleBack}
        kicker={lessonKicker}
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
