import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getResumeBlock } from '../api/courseware';
import { qk } from '../api/queries';
import { useCourseOutline } from '../hooks/useCourseOutline';
import { useCurriculums } from '../hooks/useCurriculums';
import { useCourseProgressSummary } from '../hooks/useCourseProgressSummary';
import { mapOutlineToLessons } from '../lib/outline-mapper';
import iconArrowLeft from '../assets/icons/icon-arrow-left.svg';
import iconAlert from '../assets/icons/icon-alert.svg';
import courseArtToolbox from '../assets/icons/course-art-toolbox.svg';
import courseArtBook from '../assets/icons/course-art-book.svg';
import './course-page.scss';

// ── Shared art panel header ────────────────────────────────────────────────

const ArtPanel = ({
  art, imageUrl, color, onBack,
}: {
  art: string;
  imageUrl?: string | null;
  color: 'blue' | 'green';
  onBack: () => void;
}) => (
  <div className={`cp-art-panel cp-art-panel--${color}`}>
    <div className="cp-art-panel__halo">
      <div className="cp-art-panel__disc">
        {imageUrl
          ? <img src={imageUrl} alt="" className="cp-art-panel__art cp-art-panel__art--photo" />
          : <img src={art} alt="" className="cp-art-panel__art" />}
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
  const { data: curriculums } = useCurriculums();

  // Derive course metadata from the curriculum API
  const parentCurriculum = curriculums?.find((c) => c.courses.some((course) => course.course_id === courseId));
  const courseInCurriculum = parentCurriculum?.courses.find((course) => course.course_id === courseId);

  const courseTitle = outlineQuery.data?.title ?? courseInCurriculum?.display_name ?? '';
  const description = courseInCurriculum?.description ?? null;
  const imageUrl = courseInCurriculum?.image_url ?? null;

  // Prerequisite: the course at position - 1 in the same curriculum
  const prerequisiteCourse = courseInCurriculum && courseInCurriculum.position > 1
    ? (parentCurriculum?.courses.find((c) => c.position === courseInCurriculum.position - 1) ?? null)
    : null;

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
      <ArtPanel art={courseArtToolbox} imageUrl={imageUrl} color="blue" onBack={handleBack} />

      <div className="course-scroll">
        <main className="course-content">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p className="ci-kicker">Before you begin</p>
            <h1 className="ci-title">{courseTitle}</h1>
            {description && <p className="ci-lead">{description}</p>}
          </div>

          {prerequisiteCourse && (
            <div className="ci-prerequisite">
              <p className="ci-prerequisite__label">Prerequisite</p>
              <p className="ci-prerequisite__name">{prerequisiteCourse.display_name ?? prerequisiteCourse.course_id}</p>
              <p className="ci-prerequisite__hint">Complete this course first to unlock the current one.</p>
            </div>
          )}

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

export const SaveAndResumePage = () => {
  const { courseId = '' } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const outlineQuery = useCourseOutline(courseId);
  const resumeQuery = useQuery({
    queryKey: qk.resume(courseId),
    queryFn: () => getResumeBlock(courseId),
    enabled: Boolean(courseId),
    staleTime: 0,
  });
  const progressQuery = useCourseProgressSummary(courseId);

  const allLessons = outlineQuery.data ? mapOutlineToLessons(outlineQuery.data) : [];
  const resumeSequenceId = resumeQuery.data?.sectionId ?? null;
  const resumeIdx = resumeSequenceId
    ? allLessons.findIndex((l) => l.sequenceId === resumeSequenceId)
    : -1;

  const completedLessons = progressQuery.data?.completedUnits ?? 0;
  const totalLessons = progressQuery.data?.totalUnits ?? allLessons.length;
  const fraction = progressQuery.data?.fraction ?? 0;
  const hasProgress = completedLessons > 0 || Boolean(resumeSequenceId);

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
      <ArtPanel art={courseArtBook} color="blue" onBack={() => navigate(-1)} />

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
