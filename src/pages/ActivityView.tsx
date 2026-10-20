import React, {
  useState, useCallback, useEffect, useRef, useMemo,
} from 'react';
import {
  useParams, useNavigate, useLocation, Navigate,
} from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { getConfig } from '@edx/frontend-platform';
import { useBlockCompletion } from '../hooks/useBlockCompletion';
import { useOffline } from '../hooks/useOffline';
import { useSequence } from '../hooks/useSequence';
import { useCourseOutline } from '../hooks/useCourseOutline';
import { useLearnCourses } from '../hooks/useLearnCourses';
import { useCurriculums } from '../hooks/useCurriculums';
import { mapOutlineToLessons, markSequenceComplete } from '../lib/outline-mapper';
import type { CourseOutline } from '../api/courseware';
import { getLmsOrigin } from '../lib/lms';
import { saveSequencePosition } from '../api/progress';
import { qk } from '../api/queries';
import { ContentIFrame } from '../components/content-iframe/ContentIFrame';
import { TranscriptSheet } from '../components/transcript-sheet/TranscriptSheet';
import { ButtonDock } from '../components/button-dock/ButtonDock';
import { NavHeader } from '../components/nav-header/NavHeader';
import { StepIndicator } from '../components/step-indicator/StepIndicator';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorView } from '../components/ui/ErrorView';
import { OfflineView } from '../components/offline-view/OfflineView';
import { SlowLoadView } from '../components/slow-load-view/SlowLoadView';
import { NotEnrolledPage } from './NotEnrolledPage';
import { useSlowLoad } from '../hooks/useSlowLoad';
import './activity-view.scss';

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

  const { data: enrolledCourses, isLoading: enrolledLoading } = useLearnCourses();
  const isEnrolled = enrolledLoading || (enrolledCourses?.some((c) => c.courseId === courseId) ?? true);

  // shownVisit: visit number of the step whose iframe content is currently on screen.
  const [shownVisit, setShownVisit] = useState<number | null>(null);

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

  // Poll get_completion every 3 s for all unit types.
  // plugin.completed is no longer sent; the LMS records completion server-side
  // (HTML blocks via unit.visibilityStatus + publish_completion, problems on submit).
  const isBlockComplete = useBlockCompletion(courseId, sequenceId, currentUnitId, currentUnitId !== null);

  // Invalidate sequence cache on unmount so unit.complete flags are fresh when the
  // learner returns home — whether they finish, close, or navigate away mid-lesson.
  useEffect(() => () => {
    queryClient.invalidateQueries({ queryKey: qk.sequence(sequenceId) });
  }, [sequenceId, queryClient]);

  // Reset content error whenever the unit changes.
  useEffect(() => {
    setIsContentError(false);
  }, [sequenceId, unitIdx]);

  const handleContentError = useCallback(() => {
    setIsContentError(true);
  }, []);

  // Each visit to a step gets its own number, so coming back to a step (A → B → A before B
  // showed) still shows the spinner while that step's iframe reloads.
  const visitRef = useRef<{ unitId: string | null; visit: number }>({ unitId: null, visit: 0 });
  if (visitRef.current.unitId !== currentUnitId) {
    visitRef.current = { unitId: currentUnitId, visit: visitRef.current.visit + 1 };
  }
  const currentVisit = visitRef.current.visit;
  const isIframeLoaded = currentUnitId !== null && shownVisit === currentVisit;

  // Continue is enabled when the backend has recorded the unit as complete.
  // currentUnit?.complete covers units already complete from a previous session.
  const isCompleted = currentUnitId !== null && (isBlockComplete || Boolean(currentUnit?.complete));

  // Called when the unit's content is on screen: its iframe's load event or, in lightweight mode,
  // the iframe's first plugin.resize if that comes first.
  // Lightweight mode: MFE_CONFIG_OVERRIDES["uber-learn"].UBER_LIGHTWEIGHT_IFRAMES (JSON boolean).
  const isLightweightMode = getConfig().UBER_LIGHTWEIGHT_IFRAMES === true;
  const handleContentShown = useCallback(() => {
    setShownVisit(currentVisit);
  }, [currentVisit]);

  // Transcript sheet: opened by plugin.openTranscript from the video XBlock.
  const [transcriptUsageId, setTranscriptUsageId] = useState<string | null>(null);
  const handleTranscriptRequest = useCallback((usageId: string) => {
    setTranscriptUsageId(usageId);
  }, []);
  const handleTranscriptClose = useCallback(() => {
    setTranscriptUsageId(null);
  }, []);

  // Guard against double-tap: if a continue navigation is already in-flight, ignore
  // subsequent presses until the async work completes and the component either
  // unmounts (on navigation) or the ref resets in the finally block.
  const isContinuingRef = useRef(false);

  const handleContinue = useCallback(async () => {
    if (!isCompleted || isContinuingRef.current || !courseId || !sequenceId) { return; }
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
        // Delay all background invalidations to give Celery award tasks time to settle
        // and to ensure the results page reads the optimistic setQueryData on first mount.
        // Leaf-block completions are recorded by platform XBlock handlers before
        // plugin.completed fires, so outline/progress data is already correct on the server.
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: qk.outline(courseId) });
          queryClient.invalidateQueries({ queryKey: qk.courseProgress(courseId) });
          queryClient.invalidateQueries({ queryKey: qk.learnCourses() });
          queryClient.invalidateQueries({ queryKey: qk.leaderboardAll() });
          queryClient.invalidateQueries({ queryKey: qk.curriculums() });
          // refetchType:'all' bypasses the 60s staleTime so the new badge award
          // awarded by Celery is visible on the completion screen straight away.
          queryClient.invalidateQueries({ queryKey: qk.badges(), refetchType: 'all' });
        }, 3000);

        if (isRetentionCourse && !nextLesson) {
          // Last lesson of a retention check course: go to the result page.
          navigate(`/course/${courseId}/retention-result/${sequenceId}`);
        } else if (isFinalCheckSequence) {
          // Final check complete: go to course-complete screen.
          navigate(
            `/course/${courseId}/complete`,
            { state: { finalCheckSequenceId: sequenceId } },
          );
        } else {
          // Regular lesson: navigate to lesson-complete screen.
          navigate(`/course/${courseId}/lesson-complete/${sequenceId}`);
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
      <div className="activity-view">
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

  // Offline: show the "You're offline" screen
  if (isOffline) {
    return (
      <OfflineView
        title={lessonTitle}
        onBack={handleBack}
        onRetry={() => window.location.reload()}
      />
    );
  }

  // Content load failure: navigate to the video-error screen (Figma: "This video could not load")
  if (isContentError) {
    return <Navigate to={`/course/${courseId}/lesson/${sequenceId}/video-error`} replace />;
  }

  const buttonLabel = unitIdx < units.length - 1 ? 'Continue' : 'Finish';

  return (
    <div className="activity-view">
      <NavHeader
        title={lessonNavTitle}
        onBack={handleBack}
        onClose={handleClose}
      />

      <StepIndicator current={unitIdx} total={units.length} />

      <main className="activity-view__main">
        {!isIframeLoaded && (
          <div
            className="activity-view__spinner-overlay"
            aria-hidden="true"
          >
            <div className="content-iframe-spinner" />
          </div>
        )}

        <ContentIFrame
          key={currentUnit.id}
          usageKey={currentUnit.id}
          onContentReady={isLightweightMode ? handleContentShown : undefined}
          onLoad={handleContentShown}
          onError={handleContentError}
          onTranscriptRequest={handleTranscriptRequest}
        />
      </main>

      <ButtonDock
        onContinue={handleContinue}
        disabled={!isCompleted}
        label={buttonLabel}
      />

      <TranscriptSheet
        usageId={transcriptUsageId}
        courseId={courseId}
        videoTitle={currentUnit.title}
        onClose={handleTranscriptClose}
      />
    </div>
  );
};
