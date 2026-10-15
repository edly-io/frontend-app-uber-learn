import React, {
  useState, useCallback, useEffect, useRef, useMemo,
} from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { getConfig } from '@edx/frontend-platform';
import { useOffline } from '../hooks/useOffline';
import { useSequence } from '../hooks/useSequence';
import { useCourseOutline } from '../hooks/useCourseOutline';
import { useCurriculums } from '../hooks/useCurriculums';
import { mapOutlineToLessons, markSequenceComplete } from '../lib/outline-mapper';
import type { CourseOutline } from '../api/courseware';
import { getEnrolledCourses } from '../api/catalog';
import { getLmsOrigin } from '../lib/lms';
import { saveSequencePosition, markBlockComplete } from '../api/progress';
import { getGamificationSummary } from '../api/gamification';
import { qk } from '../api/queries';
import { ContentIFrame } from '../components/content-iframe/ContentIFrame';
import { ButtonDock } from '../components/button-dock/ButtonDock';
import { NavHeader } from '../components/nav-header/NavHeader';
import { StepIndicator } from '../components/step-indicator/StepIndicator';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorView } from '../components/ui/ErrorView';
import { OfflineView } from '../components/offline-view/OfflineView';
import { SlowLoadView } from '../components/slow-load-view/SlowLoadView';
import { NotEnrolledPage } from './NotEnrolledPage';
import { useSlowLoad } from '../hooks/useSlowLoad';

/** Longest the Finish button waits for the final unit's completion write before navigating. */
const COMPLETION_WRITE_MAX_WAIT_MS = 5000;

export const ActivityView = () => {
  const {
    courseId = '',
    sequenceId = '',
    unitIdx: unitIdxParam = '0',
  } = useParams<{ courseId: string; sequenceId: string; unitIdx: string }>();

  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const origin = (location.state as { origin?: string } | null)?.origin ?? null;
  const unitIdx = parseInt(unitIdxParam, 10);

  const { data: enrolledCourses, isLoading: enrolledLoading } = useQuery({
    queryKey: qk.enrolledCourses(),
    queryFn: getEnrolledCourses,
    staleTime: 5 * 60_000,
  });
  const isEnrolled = enrolledLoading || (enrolledCourses?.some((c) => c.courseId === courseId) ?? true);

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

  // Content load failure (iframe onError — 4xx/5xx from LMS, broken XBlock, etc.)
  const [isContentError, setIsContentError] = useState(false);

  // Network availability — drives the offline error screen
  const isOffline = useOffline();

  const {
    sequence, units, isLoading, isError,
  } = useSequence(sequenceId);
  const isSlowLoad = useSlowLoad(isLoading);

  // Course outline — needed to find the next sequence after this one
  const outlineQuery = useCourseOutline(courseId);
  const allLessons = useMemo(
    () => (outlineQuery.data ? mapOutlineToLessons(outlineQuery.data) : []),
    [outlineQuery.data],
  );
  const currentLessonIdx = allLessons.findIndex((l) => l.sequenceId === sequenceId);
  const nextLesson = currentLessonIdx >= 0 ? allLessons[currentLessonIdx + 1] : null;

  // Detect if this course is the 30-day retention check for any curriculum.
  // If so, completing the last lesson routes to retention-result instead of lesson-complete.
  const { data: curriculums } = useCurriculums();
  const isRetentionCourse = curriculums?.some((c) => c.knowledge_check.course_id === courseId) ?? false;

  // A sequence is the final check when it is the last in the course AND all its units are
  // assessment type (problem or graded XBlock). Only evaluates once units are loaded.
  const isFinalCheckSequence = !nextLesson
    && units.length > 0
    && units.every((u) => u.contentType === 'problem' || u.graded === true);

  const currentUnit = units[unitIdx];
  const currentUnitId = currentUnit?.id ?? null;

  // Gate Continue on plugin.completed for units that require interaction:
  // standard CAPA (contentType === 'problem') and graded custom XBlocks like
  // sortable/DnD-v2 (graded === true). Plain HTML/text units auto-enable once shown.
  const isProblemUnit = currentUnit?.contentType === 'problem' || currentUnit?.graded === true;

  // Reset content error + correctness whenever the unit changes.
  useEffect(() => {
    lastCorrectRef.current = null;
    setIsContentError(false);
  }, [sequenceId, unitIdx]);

  const [retryKey, setRetryKey] = useState(0);
  const handleContentError = useCallback(() => {
    setIsContentError(true);
  }, []);
  const handleContentRetry = useCallback(() => {
    setIsContentError(false);
    setRetryKey((k) => k + 1);
  }, []);

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
    // Invalidate so the unit's complete flag is fresh on any future revisit.
    queryClient.invalidateQueries({ queryKey: qk.sequence(sequenceId) });
  }, [currentUnitId, queryClient, sequenceId]);

  // For problem units: if the iframe is visible but the cached unit still shows
  // complete:false, trigger one background refetch so a submission from a previous
  // session is reflected without requiring a full page reload.
  // Use a ref to capture latest values so the effect doesn't go stale while firing
  // on isIframeLoaded alone.
  const shouldInvalidateRef = useRef(false);
  shouldInvalidateRef.current = isProblemUnit
    && Boolean(currentUnit) && !currentUnit?.complete && completedUnitId !== currentUnitId;
  useEffect(() => {
    if (isIframeLoaded && shouldInvalidateRef.current) {
      queryClient.invalidateQueries({ queryKey: qk.sequence(sequenceId) });
    }
  }, [isIframeLoaded, sequenceId, queryClient]);

  // Called when the unit's content is on screen: its iframe's load event or, in lightweight mode,
  // the iframe's first plugin.resize if that comes first.
  // Lightweight mode: MFE_CONFIG_OVERRIDES["uber-learn"].UBER_LIGHTWEIGHT_IFRAMES (JSON boolean).
  const isLightweightMode = getConfig().UBER_LIGHTWEIGHT_IFRAMES === true;
  const handleContentShown = useCallback(() => {
    setShownVisit(currentVisit);
  }, [currentVisit]);

  // Guard against double-tap: if a continue navigation is already in-flight, ignore
  // subsequent presses until the async work completes and the component either
  // unmounts (on navigation) or the ref resets in the finally block.
  const isContinuingRef = useRef(false);

  const handleContinue = useCallback(async () => {
    if (!isCompleted || isContinuingRef.current) { return; }
    isContinuingRef.current = true;
    try {
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
      // Mark the current unit complete so the resume-block API immediately returns
      // this lesson as the resume point (completion API sorts by modified timestamp).
      const completionWrite: Promise<void> = currentUnitId
        ? markBlockComplete(courseId, currentUnitId).catch(() => {})
        : Promise.resolve();

      const nextIdx = unitIdx + 1;

      if (nextIdx < units.length) {
        navigate(`/course/${courseId}/lesson/${sequenceId}/step/${nextIdx}`);
      } else {
        // Invalidate gamification cache so Points/Streak tabs reflect new totals.
        queryClient.invalidateQueries({ queryKey: qk.gamification() });
        // The cached outline (5 min staleTime, loaded when this lesson opened) still says this
        // sequence is incomplete, and the completion pages count lessons from it. Mark it
        // complete now so the next screen renders the right count on first paint.
        queryClient.setQueryData<CourseOutline>(qk.outline(courseId), (prev) => markSequenceComplete(prev, sequenceId));
        // Reconcile outline and course progress with the server only once the final unit's
        // completion write has settled; refetching earlier races the POST and returns stale data.
        completionWrite.finally(() => {
          queryClient.invalidateQueries({ queryKey: qk.outline(courseId) });
          queryClient.invalidateQueries({ queryKey: qk.courseProgress(courseId) });
        });
        // Delay-invalidate leaderboard, curriculums, and badges to give Celery award tasks
        // time to write before the client re-fetches.
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: qk.leaderboardAll() });
          queryClient.invalidateQueries({ queryKey: qk.curriculums() });
          // refetchType:'all' bypasses the 60s staleTime so the new badge award
          // awarded by Celery is visible on the completion screen straight away.
          queryClient.invalidateQueries({ queryKey: qk.badges(), refetchType: 'all' });
        }, 3000);

        // The results pages read the points this completion awards. Navigating before the write
        // lands made them read without the last step's points (e.g. 10 instead of 20), so wait
        // for it — bounded, so a hung request on a bad network cannot trap the learner here.
        await Promise.race([
          completionWrite,
          new Promise<void>((resolve) => { setTimeout(resolve, COMPLETION_WRITE_MAX_WAIT_MS); }),
        ]);

        if (isRetentionCourse && !nextLesson) {
          // Last lesson of a retention check course: go to the result page.
          navigate(
            `/course/${courseId}/retention-result/${sequenceId}`,
            serverTimeRef.current ? { state: { since: serverTimeRef.current } } : undefined,
          );
        } else if (isFinalCheckSequence) {
          // Final check complete: go to course-complete screen, passing the sequence
          // id and timestamp so results can be scoped to this attempt.
          navigate(
            `/course/${courseId}/complete`,
            {
              state: {
                finalCheckSequenceId: sequenceId,
                since: serverTimeRef.current ?? undefined,
              },
            },
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
    } finally {
      isContinuingRef.current = false;
    }
  }, [
    isCompleted,
    unitIdx,
    units.length,
    courseId,
    sequenceId,
    currentUnitId,
    navigate,
    nextLesson,
    isRetentionCourse,
    isFinalCheckSequence,
    queryClient,
  ]);

  // Back arrow:
  //   - step N > 0  → previous step within the same lesson
  //   - step 0, has a previous lesson → first step of that lesson
  //   - step 0, first lesson of the course → course overview
  const handleBack = useCallback(() => {
    if (unitIdx > 0) {
      navigate(`/course/${courseId}/lesson/${sequenceId}/step/${unitIdx - 1}`, { state: origin ? { origin } : undefined });
    } else if (currentLessonIdx > 0) {
      const prevLesson = allLessons[currentLessonIdx - 1];
      navigate(`/course/${courseId}/lesson/${prevLesson.sequenceId}/step/0`, { state: origin ? { origin } : undefined });
    } else {
      navigate(`/course/${courseId}`, { state: origin ? { origin } : undefined });
    }
  }, [navigate, courseId, sequenceId, unitIdx, currentLessonIdx, allLessons, origin]);

  // X close button: exit to save-and-resume page, passing the exact step so
  // "Resume lesson N" returns the user to the step they were viewing, not step 0.
  const handleClose = useCallback(() => {
    navigate(`/course/${courseId}/resume`, {
      state: {
        resumeSequenceId: sequenceId,
        resumeUnitIdx: unitIdx,
        ...(origin ? { origin } : {}),
      },
    });
  }, [navigate, courseId, sequenceId, unitIdx, origin]);

  if (!isEnrolled) {
    return <NotEnrolledPage onClose={() => navigate('/')} />;
  }

  if (isLoading) {
    if (isSlowLoad) {
      return (
        <SlowLoadView
          onBack={handleBack}
          onRetry={() => queryClient.invalidateQueries({ queryKey: qk.sequence(sequenceId) })}
        />
      );
    }
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
      <SlowLoadView
        onBack={handleBack}
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

  // Show the Figma offline screen when the device loses connectivity or content fails to load
  if (isOffline || isContentError) {
    return (
      <OfflineView
        title={lessonTitle}
        onBack={handleBack}
        onRetry={() => {
          if (isContentError) {
            handleContentRetry();
          } else {
            window.location.reload();
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
          key={`${currentUnit.id}-${retryKey}`}
          usageKey={currentUnit.id}
          onCompleted={handleCompleted}
          onContentReady={isLightweightMode ? handleContentShown : undefined}
          onLoad={handleContentShown}
          onError={handleContentError}
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
