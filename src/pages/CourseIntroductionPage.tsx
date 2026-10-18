import React from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getResumeBlock } from '../api/courseware';
import { qk } from '../api/queries';
import { useCourseOutline } from '../hooks/useCourseOutline';
import { useCurriculums } from '../hooks/useCurriculums';
import { useCourseProgressSummary } from '../hooks/useCourseProgressSummary';
import { mapOutlineToLessons, countLessons } from '../lib/outline-mapper';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorView } from '../components/ui/ErrorView';
import iconArrowLeft from '../assets/icons/icon-arrow-left.svg';
import scenePhoto from '../assets/images/scene-safety-education.png';
import './course-page.scss';

// ── Shared art panel header ────────────────────────────────────────────────

const ArtPanel = ({
  art, imageUrl, onBack,
}: {
  art: string;
  imageUrl?: string | null;
  onBack: () => void;
}) => {
  const [imgFailed, setImgFailed] = React.useState(false);
  return (
    <div className="cp-scene-header">
      {imageUrl && !imgFailed
        ? <img src={imageUrl} alt="" className="cp-scene-header__photo" onError={() => setImgFailed(true)} />
        : <img src={art} alt="" className="cp-scene-header__photo" />}
      <button type="button" className="cp-back-btn" onClick={onBack} aria-label="Back">
        <img src={iconArrowLeft} alt="" className="cp-back-btn__icon" />
      </button>
    </div>
  );
};

// ── SaveAndResumePage ──────────────────────────────────────────────────────

export const SaveAndResumePage = () => {
  const { courseId = '' } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const { data: curriculums } = useCurriculums();
  const courseInCurriculum = curriculums
    ?.flatMap((c) => c.courses)
    .find((course) => course.course_id === courseId);
  const imageUrl = courseInCurriculum?.image_url || null;

  const outlineQuery = useCourseOutline(courseId);
  const resumeQuery = useQuery({
    queryKey: qk.resume(courseId),
    queryFn: () => getResumeBlock(courseId),
    enabled: Boolean(courseId),
    staleTime: 0,
  });
  const progressQuery = useCourseProgressSummary(courseId);

  // When navigating from ActivityView via the X button, location.state carries the
  // exact sequence and unit index the learner was on, so Resume returns them there.
  const stateSeqId = (location.state as { resumeSequenceId?: string } | null)?.resumeSequenceId ?? null;
  const stateUnitIdx = (location.state as { resumeUnitIdx?: number } | null)?.resumeUnitIdx ?? null;

  const allLessons = outlineQuery.data ? mapOutlineToLessons(outlineQuery.data) : [];
  const resumeSequenceId = stateSeqId ?? resumeQuery.data?.sectionId ?? null;
  const resumeIdx = resumeSequenceId
    ? allLessons.findIndex((l) => l.sequenceId === resumeSequenceId)
    : -1;

  // Use outline-based lesson counts so the display matches lessons (sequences), not steps (units).
  const outlineCounts = outlineQuery.data ? countLessons(outlineQuery.data) : null;
  const completedLessons = outlineCounts?.completed ?? 0;
  const totalLessons = outlineCounts?.total ?? allLessons.length;
  const fraction = progressQuery.data?.fraction ?? 0;
  const hasProgress = completedLessons > 0 || Boolean(resumeSequenceId);

  const handleResume = () => {
    if (!resumeSequenceId) {
      navigate(`/course/${courseId}`);
      return;
    }
    // Use the exact step from state when available (set by ActivityView X button).
    // Fall back to step 0 when navigating directly to /resume via URL.
    const stepIdx = (stateSeqId === resumeSequenceId && stateUnitIdx !== null) ? stateUnitIdx : 0;
    navigate(`/course/${courseId}/lesson/${resumeSequenceId}/step/${stepIdx}`);
  };

  const handleHome = () => navigate('/');
  const handleBack = () => (location.key === 'default' ? navigate(`/course/${courseId}`) : navigate(-1));

  if (outlineQuery.isLoading) {
    return (
      <div className="course-page">
        <ArtPanel art={scenePhoto} imageUrl={imageUrl} onBack={handleBack} />
        <div className="course-scroll"><LoadingSkeleton /></div>
      </div>
    );
  }

  if (outlineQuery.isError) {
    return (
      <ErrorView
        onRetry={() => {
          queryClient.invalidateQueries({ queryKey: qk.outline(courseId) });
          queryClient.invalidateQueries({ queryKey: qk.resume(courseId) });
        }}
        onBack={handleBack}
      />
    );
  }

  return (
    <div className="course-page">
      <ArtPanel
        art={scenePhoto}
        imageUrl={imageUrl}
        onBack={handleBack}
      />

      <div className="course-scroll">
        <main className="course-content">
          <div className="course-heading">
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
                <div className="sr-progress-fill" style={{ '--progress': String(Math.round(fraction * 100) / 100) } as React.CSSProperties} />
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
