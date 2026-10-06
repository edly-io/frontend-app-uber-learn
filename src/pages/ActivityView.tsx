import React, {
  useState, useCallback, useEffect, useMemo,
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getConfig } from '@edx/frontend-platform';
import { useSequence } from '../hooks/useSequence';
import { useProgress } from '../hooks/useProgress';
import { useCourseOutline } from '../hooks/useCourseOutline';
import { mapOutlineToLessons } from '../lib/outline-mapper';
import { useAssessmentSubmit } from '../hooks/useAssessmentSubmit';
import { recordActivity, AlreadyPassedError, AssessmentIncompleteError } from '../api/progress';
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

  const [isCompleted, setIsCompleted] = useState(false);
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);
  // Track correctness from plugin.completed so it can be forwarded to the Progress API.
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  // Set when recordActivity fails — shown as an inline error so the user can retry.
  const [activityRecordError, setActivityRecordError] = useState(false);

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
  const { data: progressData, isLoading: progressLoading } = useProgress(courseId);

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

  // Reset completion + loading state whenever the unit changes.
  // Also record this as the furthest-reached sequence so CourseOverview and
  // SaveAndResumePage can show accurate progress even when the LMS resume
  // block hasn't caught up (common with demo courses).
  useEffect(() => {
    setIsCompleted(false);
    setLastCorrect(null);
    setIsIframeLoaded(false);
    setActivityRecordError(false);
    if (sequenceId && courseId) {
      storeResumeSequence(courseId, sequenceId);
    }
  }, [sequenceId, unitIdx, courseId]);

  const currentUnit = units[unitIdx];

  const recordMutation = useMutation({
    mutationFn: (correct: boolean | null) => recordActivity({
      courseId,
      unitId: currentUnit?.id ?? '',
      correct,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.progress(courseId) });
    },
    onError: () => {
      setActivityRecordError(true);
    },
  });

  const handleCompleted = useCallback((correct: boolean | null) => {
    setLastCorrect(correct);
    setIsCompleted(true);
  }, []);

  // Called when the iframe finishes loading. Marks the frame visible and
  // auto-enables Continue for regular (non-assessment) content — standard
  // Open edX XBlocks don't send plugin.completed.
  // Guard: if progress is still loading we can't yet know whether this is an
  // assessment sequence, so defer the auto-enable until progress settles.
  const handleIframeLoad = useCallback(() => {
    setIsIframeLoaded(true);
    if (!progressLoading && !isAssessmentSequence) {
      setIsCompleted(true);
    }
  }, [progressLoading, isAssessmentSequence]);

  // Once progress resolves, if the iframe already loaded and this is not an
  // assessment sequence, enable Continue. Handles the race where the iframe
  // loads before the progress query returns.
  useEffect(() => {
    if (!progressLoading && isIframeLoaded && !isAssessmentSequence && !isCompleted) {
      setIsCompleted(true);
    }
  }, [progressLoading, isIframeLoaded, isAssessmentSequence, isCompleted]);

  const handleContinue = useCallback(async () => {
    if (!isCompleted) { return; }

    setActivityRecordError(false);

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
      // Last unit of an assessment sequence: record activity (non-blocking on
      // failure) then submit assessment and wait for the overlay.
      try {
        await recordMutation.mutateAsync(lastCorrect);
      } catch {
        // Activity record failed — set error but still submit assessment
        setActivityRecordError(true);
      }
      submitAssessmentResult(courseId, currentAssessmentType);
      return;
    }

    // Non-assessment: record activity, navigate only on success
    try {
      await recordMutation.mutateAsync(lastCorrect);
    } catch {
      // Error already handled by onError — stop here so the user can retry
      return;
    }

    if (nextIdx < units.length) {
      navigate(`/course/${courseId}/lesson/${sequenceId}/step/${nextIdx}`);
    } else {
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

  const overlayAssessmentType: OverlayAssessmentType | null = useMemo(() => {
    if (!assessmentResult && !assessmentError) { return null; }
    if (assessmentError instanceof AlreadyPassedError) { return 'already_passed'; }
    if (assessmentError instanceof AssessmentIncompleteError) { return 'assessment_incomplete'; }
    if (assessmentError) { return 'submission_error'; }
    return currentAssessmentType;
  }, [assessmentResult, assessmentError, currentAssessmentType]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
        <NavHeader title="Loading…" onBack={handleBack} onClose={handleClose} />
        <LoadingSkeleton lines={5} />
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
          onLoad={handleIframeLoad}
        />
      </main>

      {activityRecordError && (
        <p
          role="alert"
          style={{
            margin: '0 16px 8px',
            padding: '10px 14px',
            background: 'var(--u-background-negative-light, #fdf0f2)',
            color: 'var(--u-content-negative, #c8102e)',
            borderRadius: '8px',
            fontSize: '13px',
            lineHeight: 1.4,
          }}
        >
          Couldn&apos;t save your progress. Tap Continue to try again.
        </p>
      )}

      <ButtonDock
        onContinue={handleContinue}
        disabled={!isCompleted || isSubmitting || recordMutation.isPending}
        label={recordMutation.isPending ? 'Saving…' : isSubmitting ? 'Submitting…' : buttonLabel}
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
