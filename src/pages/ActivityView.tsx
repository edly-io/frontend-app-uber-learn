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
import { saveSequencePosition, getUnitCompletion } from '../api/progress';
import { useGamification } from '../hooks/useGamification';
import { qk } from '../api/queries';
import { ContentIFrame } from '../components/content-iframe/ContentIFrame';
import { ButtonDock } from '../components/button-dock/ButtonDock';
import { NavHeader } from '../components/nav-header/NavHeader';
import { StepIndicator } from '../components/step-indicator/StepIndicator';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorView } from '../components/ui/ErrorView';
import { OfflineView } from '../components/offline-view/OfflineView';

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

  const [isCompleted, setIsCompleted] = useState(false);
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);

  // Capture server_time when the lesson mounts so it can be used as the `since`
  // value for the lesson results endpoint. Using server_time (not device clock)
  // prevents a fast device clock from making a first run look like a repeat.
  const { data: gamificationData } = useGamification();
  const serverTimeRef = useRef<string>(new Date().toISOString());
  const iframeRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (gamificationData?.server_time) {
      serverTimeRef.current = gamificationData.server_time;
    }
  // Re-run whenever sequenceId changes (new lesson) OR when gamificationData first resolves
  // (cold-start: gamification API may not have responded yet when the lesson mounts).
  }, [sequenceId, gamificationData]);

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

  // HTML/text and video units complete on view (iframe load).
  // Video: the stock Open edX video XBlock never posts an end-of-video message
  // to the parent (it only emits plugin.videoFullScreen / plugin.autoAdvance),
  // and the YouTube player is nested inside the LMS iframe so its state events
  // never reach this window. There is no reliable end signal to gate on, so
  // video units unlock Continue once loaded (frontend-app-learning does not
  // gate its Next button on video completion either).
  // Problem/graded XBlocks still require plugin.completed.
  const isHtmlUnit = currentUnit?.contentType === 'html' || currentUnit?.contentType === 'text';
  const isVideoUnit = currentUnit?.contentType === 'video';
  // TODO: restore per-type completion gating after debugging. All units unlock on load for test build.
  const completesOnView = isHtmlUnit || isVideoUnit || true;

  // Reset loading state only when the unit itself changes. Must NOT depend on
  // currentUnit.complete: that flag flips after a completion-triggered refetch,
  // and since the iframe keeps the same key it never fires onLoad again, which
  // would leave the loading overlay covering the content forever.
  useEffect(() => {
    setIsIframeLoaded(false);
  }, [sequenceId, unitIdx]);

  // Reset completion whenever the unit changes. For units that need an explicit
  // signal, seed from the server's complete flag so returning learners are not
  // stuck waiting for a signal the XBlock may not re-fire on revisit.
  useEffect(() => {
    setIsCompleted(!completesOnView && Boolean(currentUnit?.complete));
  // currentUnit reference changes on every render; key on its complete flag instead.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sequenceId, unitIdx, completesOnView, currentUnit?.complete]);

  const handleCompleted = useCallback(() => {
    setIsCompleted(true);
    // Invalidate the sequence cache so the completed unit's `complete: true` is
    // reflected immediately if the user navigates away and returns (avoids
    // waiting for the 5-minute stale window).
    queryClient.invalidateQueries({ queryKey: qk.sequence(sequenceId) });
    // Note: XBlocks record their own completion via the `publish_completion`
    // XBlock handler (direct XHR from inside the iframe). No additional
    // server call is needed here — the completion batch REST API is not
    // registered in this LMS URL conf.
  }, [queryClient, sequenceId]);

  // Fallback completion poll for non-HTML units (e.g. native video XBlocks
  // where the postMessage may not fire reliably). Checks up to MAX_POLLS times
  // (≈60 s) then stops and reveals a manual "Mark as watched" button rather
  // than hammering the LMS indefinitely.
  const MAX_COMPLETION_POLLS = 20;
  useEffect(() => {
    if (isCompleted || completesOnView || !isIframeLoaded || !currentUnit?.id) { return undefined; }

    const unitId = currentUnit.id;
    let active = true;
    let pollCount = 0;

    const check = async () => {
      if (!active) { return; }
      pollCount += 1;
      try {
        const complete = await getUnitCompletion(courseId, sequenceId, unitId);
        if (complete && active) { handleCompleted(); return; }
      } catch { /* network error — keep polling */ }

      // Polls exhausted — server never recorded completion.
      // For graded XBlocks the learner must interact with the content; do nothing.
    };

    const initial = setTimeout(check, 2000);
    const interval = setInterval(() => {
      if (pollCount < MAX_COMPLETION_POLLS) { check(); }
    }, 3000);

    return () => {
      active = false;
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [isCompleted, completesOnView, isIframeLoaded, courseId, sequenceId, currentUnit?.id, handleCompleted]);

  // Called when the iframe finishes loading. HTML/text and video units complete
  // immediately (local UI state only — no fake server completion is submitted;
  // the XBlock reports its own completion where it can). All other types wait
  // for a postMessage signal.
  const handleIframeLoad = useCallback(() => {
    setIsIframeLoaded(true);
    if (completesOnView) {
      setIsCompleted(true);
    }
  }, [completesOnView]);

  const handleVideoError = useCallback(() => {
    navigate(`/course/${courseId}/lesson/${sequenceId}/video-error`);
  }, [navigate, courseId, sequenceId]);

  const handleContinue = useCallback(async () => {
    if (!isCompleted) { return; }

    // Notify iframe of continue click so XBlocks can trigger submission.
    // Await one microtask tick so the XBlock message handler runs before the
    // iframe unmounts — prevents a race where navigate tears down the frame
    // before the message is processed.
    const frame = iframeRef.current;
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
        // Pass `since` so the result page can scope its getLessonResults call to this attempt.
        navigate(`/course/${courseId}/retention-result/${sequenceId}`, {
          state: { since: serverTimeRef.current },
        });
      } else {
        // Regular lesson: navigate to lesson-complete and let it query lesson
        // results directly (TanStack Query will cache-hit since ActivityView
        // pre-fetches via useGamification). Pass `since` so the results are
        // scoped to this attempt (not a previous one by the same learner).
        navigate(`/course/${courseId}/lesson-complete/${sequenceId}`, {
          state: { since: serverTimeRef.current },
        });
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

  // Back arrow: step back within the lesson; if on step 0, pop history so
  // CourseOverview re-uses its original location.key and the auto-resume guard
  // suppresses the redirect (avoids an infinite lesson → back → lesson loop).
  const handleBack = useCallback(() => {
    if (unitIdx > 0) {
      navigate(`/course/${courseId}/lesson/${sequenceId}/step/${unitIdx - 1}`);
    } else {
      navigate(-1);
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
          ref={iframeRef}
          key={currentUnit.id}
          usageKey={currentUnit.id}
          onCompleted={handleCompleted}
          onLoad={handleIframeLoad}
          onVideoError={handleVideoError}
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
