import React, {
  useState, useCallback, useEffect, useRef,
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { getConfig } from '@edx/frontend-platform';
import { useSequence } from '../hooks/useSequence';
import { useCourseOutline } from '../hooks/useCourseOutline';
import { useCurriculums } from '../hooks/useCurriculums';
import { mapOutlineToLessons } from '../lib/outline-mapper';
import { getLmsOrigin } from '../lib/lms';
import { saveSequencePosition } from '../api/progress';
import { getGamificationSummary } from '../api/gamification';
import { qk } from '../api/queries';
import { ContentIFrame } from '../components/content-iframe/ContentIFrame';
import { ButtonDock } from '../components/button-dock/ButtonDock';
import { NavHeader } from '../components/nav-header/NavHeader';
import { StepIndicator } from '../components/step-indicator/StepIndicator';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorView } from '../components/ui/ErrorView';
import { OfflineView } from '../components/offline-view/OfflineView';

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

  // Capture server_time once when the lesson mounts (not on every window focus) so the
  // `since` value for the lesson results endpoint stays stable for the duration of the lesson.
  // Using server_time (not device clock) prevents a fast device clock from making a first run
  // look like a repeat.
  const serverTimeRef = useRef<string | null>(null);
  useEffect(() => {
    serverTimeRef.current = null; // reset on new lesson
    queryClient.fetchQuery({
      queryKey: qk.gamification(),
      queryFn: getGamificationSummary,
      staleTime: 0,
    }).then((data) => {
      if (serverTimeRef.current === null && data?.server_time) {
        serverTimeRef.current = data.server_time;
      }
    }).catch(() => {
      // Falls back to device clock — serverTimeRef stays null,
      // CompletionPage will skip the results query when since is absent.
    });
  }, [sequenceId, queryClient]); // re-fetch when a new lesson loads

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

  // Detect if this course is the 30-day retention check for any curriculum.
  // If so, completing the last lesson routes to retention-result instead of lesson-complete.
  const { data: curriculums } = useCurriculums();
  const isRetentionCourse = curriculums?.some((c) => c.knowledge_check.course_id === courseId) ?? false;

  const currentUnit = units[unitIdx];
  const currentUnitId = currentUnit?.id ?? null;

  // Gate Continue on plugin.completed for units that require interaction:
  // standard CAPA (contentType === 'problem') and graded custom XBlocks like
  // sortable/DnD-v2 (graded === true). Plain HTML/text units auto-enable once shown.
  const isProblemUnit = currentUnit?.contentType === 'problem' || currentUnit?.graded === true;

  // Reset correctness whenever the unit changes.
  useEffect(() => {
    lastCorrectRef.current = null;
  }, [sequenceId, unitIdx]);

  // Each visit to a step gets its own number, so coming back to a step (A → B → A before B
  // showed) still shows the spinner while that step's iframe reloads.
  const visitRef = useRef<{ unitId: string | null; visit: number }>({ unitId: null, visit: 0 });
  if (visitRef.current.unitId !== currentUnitId) {
    visitRef.current = { unitId: currentUnitId, visit: visitRef.current.visit + 1 };
  }
  const currentVisit = visitRef.current.visit;
  const isIframeLoaded = currentUnitId !== null && shownVisit === currentVisit;

  // A step is complete when its iframe sent plugin.completed, or when it is a problem unit the
  // learner already completed on an earlier visit, or when it is any other unit and its content
  // is on screen.
  const isCompleted = currentUnitId !== null && (
    completedUnitId === currentUnitId
    || (isProblemUnit ? Boolean(currentUnit?.complete) : isIframeLoaded)
  );

  const handleCompleted = useCallback((correct: boolean | null) => {
    lastCorrectRef.current = correct;
    setCompletedUnitId(currentUnitId);
  }, [currentUnitId]);

  // Called when the unit's content is on screen: its iframe's load event or, in lightweight mode,
  // the iframe's first plugin.resize if that comes first.
  // Lightweight mode: MFE_CONFIG_OVERRIDES["uber-learn"].UBER_LIGHTWEIGHT_IFRAMES (JSON boolean).
  const isLightweightMode = getConfig().UBER_LIGHTWEIGHT_IFRAMES === true;
  const handleContentShown = useCallback(() => {
    setShownVisit(currentVisit);
  }, [currentVisit]);

  const handleContinue = useCallback(async () => {
    if (!isCompleted) { return; }

    // Notify iframe of continue click so XBlocks can trigger submission.
    // Await one microtask tick so the XBlock message handler runs before the
    // iframe unmounts — prevents a race where navigate tears down the frame
    // before the message is processed.
    const frame = document.querySelector<HTMLIFrameElement>('.content-iframe-frame');
    if (frame?.contentWindow) {
      frame.contentWindow.postMessage(
        { type: 'uber.continueClicked', version: 1 },
        getLmsOrigin(),
      );
      await Promise.resolve();
    }

    // Save current position on the LMS (fire-and-forget — enables resume, doesn't block nav)
    saveSequencePosition(courseId, sequenceId, unitIdx).catch(() => {});

    const nextIdx = unitIdx + 1;

    if (nextIdx < units.length) {
      navigate(`/course/${courseId}/lesson/${sequenceId}/step/${nextIdx}`);
    } else {
      // Invalidate gamification cache so Points/Streak tabs reflect new totals.
      queryClient.invalidateQueries({ queryKey: qk.gamification() });
      // Invalidate course progress so the progress bar reflects the new completion immediately.
      queryClient.invalidateQueries({ queryKey: qk.courseProgress(courseId) });

      if (isRetentionCourse && !nextLesson) {
        // Last lesson of a retention check course: go to the result page.
        // Pass `since` when available so the result page can scope its
        // getLessonResults call to this attempt only.
        navigate(
          `/course/${courseId}/retention-result/${sequenceId}`,
          serverTimeRef.current ? { state: { since: serverTimeRef.current } } : undefined,
        );
      } else {
        // Regular lesson: navigate to lesson-complete and pass `since` so results
        // are scoped to this attempt (not a previous one by the same learner).
        navigate(
          `/course/${courseId}/lesson-complete/${sequenceId}`,
          serverTimeRef.current ? { state: { since: serverTimeRef.current } } : undefined,
        );
      }
    }
  }, [
    isCompleted,
    unitIdx,
    units.length,
    courseId,
    sequenceId,
    navigate,
    nextLesson,
    isRetentionCourse,
    queryClient,
  ]);

  // Back arrow: step back within the lesson; if on step 0, try browser history
  // first, then fall back to the course overview (handles deep-link launches
  // where window.history is empty and navigate(-1) would do nothing).
  const handleBack = useCallback(() => {
    if (unitIdx > 0) {
      navigate(`/course/${courseId}/lesson/${sequenceId}/step/${unitIdx - 1}`);
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(`/course/${courseId}`);
    }
  }, [navigate, courseId, sequenceId, unitIdx]);

  // X close button: exit to save-and-resume page. No router state needed —
  // SaveAndResumePage fetches progress and resume position from APIs.
  const handleClose = useCallback(() => {
    navigate(`/course/${courseId}/resume`);
  }, [navigate, courseId]);

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

  const buttonLabel = unitIdx < units.length - 1 ? 'Continue' : 'Finish';

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
        disabled={!isCompleted}
        label={buttonLabel}
      />

    </div>
  );
};
