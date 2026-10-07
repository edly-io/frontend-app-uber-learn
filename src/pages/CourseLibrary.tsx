import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getEnrolledCourses, type EnrolledCourse } from '../api/catalog';
import { useCourseOutline } from '../hooks/useCourseOutline';
import { mapOutlineToLessons } from '../lib/outline-mapper';
import { getStoredResumeIdx } from '../lib/resume-storage';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorView } from '../components/ui/ErrorView';
import './course-library.css';
import './course-catalog.css';

const ArrowLeft = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path
      d="M12.5 15L7.5 10L12.5 5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const RING_RADIUS = 22;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

interface ProgressRingProps {
  completed: number;
  total: number;
}

const ProgressRing = ({ completed, total }: ProgressRingProps) => {
  const fraction = total > 0 ? Math.min(completed / total, 1) : 0;
  const offset = RING_CIRCUMFERENCE * (1 - fraction);
  const label = total > 0 ? `${completed}/${total}` : '—';

  return (
    <div className="hc-ring" aria-label={`${completed} of ${total} lessons completed`}>
      <svg className="hc-ring__svg" viewBox="0 0 56 56" aria-hidden="true">
        <circle className="hc-ring__track" cx="28" cy="28" r={RING_RADIUS} />
        {fraction > 0 && (
          <circle
            className="hc-ring__arc"
            cx="28"
            cy="28"
            r={RING_RADIUS}
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={offset}
          />
        )}
      </svg>
      <span className="hc-ring__label">{label}</span>
    </div>
  );
};

interface LibraryCourseCardProps {
  course: EnrolledCourse;
  onClick: () => void;
}

const LibraryCourseCard = ({ course, onClick }: LibraryCourseCardProps) => {
  const outlineQuery = useCourseOutline(course.courseId);
  const allLessons = outlineQuery.data ? mapOutlineToLessons(outlineQuery.data) : [];
  const totalLessons = allLessons.length;

  const storedIdx = totalLessons > 0 ? getStoredResumeIdx(course.courseId, allLessons) : -1;
  const completedLessons = storedIdx > 0 ? storedIdx : 0;

  let statusText: string;
  if (totalLessons === 0) {
    statusText = 'Start course';
  } else if (completedLessons > 0) {
    const nextLesson = allLessons[completedLessons];
    statusText = nextLesson ? `Next: ${nextLesson.lessonTitle}` : `${completedLessons} of ${totalLessons} lessons complete`;
  } else if (storedIdx === 0) {
    const currentLesson = allLessons[0];
    statusText = currentLesson ? `Next: ${currentLesson.lessonTitle}` : `${totalLessons} lessons · In progress`;
  } else {
    statusText = `${totalLessons} lessons`;
  }

  return (
    <button type="button" className="hc-card" onClick={onClick}>
      <div className="hc-card__body">
        <span className="hc-card__category">Required · Safety</span>
        <h2 className="hc-card__title">{course.title}</h2>
        <span className="hc-card__status">{statusText}</span>
      </div>
      <ProgressRing completed={completedLessons} total={totalLessons} />
    </button>
  );
};

export const CourseLibrary = () => {
  const navigate = useNavigate();

  const {
    data: courses, isLoading, isError, refetch,
  } = useQuery({
    queryKey: ['enrolled-courses'],
    queryFn: getEnrolledCourses,
    staleTime: 5 * 60_000,
  });

  return (
    <div className="library-page">
      <header className="library-nav" aria-label="Course library navigation">
        <button
          type="button"
          className="library-nav__back"
          aria-label="Back to learning home"
          onClick={() => navigate('/')}
        >
          <ArrowLeft />
        </button>
      </header>

      <main className="library-content">
        <p className="library-kicker">Course library</p>
        <h1 className="library-title">Explore learning</h1>
        <p className="library-lead">Courses available for your profile.</p>

        {isLoading && <LoadingSkeleton />}

        {isError && (
          <ErrorView
            title="Could not load courses"
            message="We could not retrieve available courses. Please try again."
            onRetry={() => refetch()}
          />
        )}

        {!isLoading && !isError && (!courses || courses.length === 0) && (
          <p className="library-empty">No courses available at the moment.</p>
        )}

        {!isLoading && !isError && courses && courses.map((course: EnrolledCourse) => (
          <LibraryCourseCard
            key={course.courseId}
            course={course}
            onClick={() => navigate(`/course/${course.courseId}`)}
          />
        ))}
      </main>

      <footer className="library-footer">
        <button
          type="button"
          className="library-footer__btn"
          onClick={() => navigate('/')}
        >
          Back to learning home
        </button>
      </footer>
    </div>
  );
};
