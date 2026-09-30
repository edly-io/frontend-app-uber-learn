import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getAuthenticatedUser } from '@edx/frontend-platform/auth';
import { getEnrolledCourses, type EnrolledCourse } from '../api/catalog';
import { useCourseOutline } from '../hooks/useCourseOutline';
import { mapOutlineToLessons } from '../lib/outline-mapper';
import { getStoredResumeIdx } from '../lib/resume-storage';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorView } from '../components/ui/ErrorView';
import './course-catalog.css';

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

interface CourseCardProps {
  title: string;
  category?: string;
  statusText: string;
  progressCompleted: number;
  progressTotal: number;
  onClick: () => void;
}

const CourseCard = ({
  title, category = 'Required', statusText, progressCompleted, progressTotal, onClick,
}: CourseCardProps) => (
  <button type="button" className="hc-card" onClick={onClick}>
    <div className="hc-card__body">
      <span className="hc-card__category">{category}</span>
      <h2 className="hc-card__title">{title}</h2>
      <span className="hc-card__status">{statusText}</span>
    </div>
    <ProgressRing completed={progressCompleted} total={progressTotal} />
  </button>
);

// Fetches its own outline so each required course card shows live progress.
const CourseCardConnected = ({ course, onClick }: { course: EnrolledCourse; onClick: () => void }) => {
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
    <CourseCard
      title={course.title}
      category="Required · Safety"
      statusText={statusText}
      progressCompleted={completedLessons}
      progressTotal={totalLessons}
      onClick={onClick}
    />
  );
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getUserInitial(): string {
  try {
    const user = getAuthenticatedUser() as { name?: string; username?: string } | null;
    const name = user?.name || user?.username || '';
    return name.charAt(0).toUpperCase() || 'U';
  } catch {
    return 'U';
  }
}

function getUserFirstName(): string {
  try {
    const user = getAuthenticatedUser() as { name?: string; username?: string } | null;
    const name = user?.name || user?.username || '';
    return name.split(/[\s_]/)[0] || 'there';
  } catch {
    return 'there';
  }
}

export const CourseCatalog = () => {
  const navigate = useNavigate();

  const { data: courses, isLoading, isError, refetch } = useQuery({
    queryKey: ['enrolled-courses'],
    queryFn: getEnrolledCourses,
    staleTime: 5 * 60_000,
  });

  const initial = getUserInitial();
  const greeting = `${getGreeting()}, ${getUserFirstName()}.`;

  return (
    <div className="home-page">
      <header className="home-header">
        <span className="home-wordmark">Uber Learn</span>
        <button
          type="button"
          className="home-avatar"
          aria-label="View learning progress"
          onClick={() => navigate('/progress')}
        >
          {initial}
        </button>
      </header>

      <main className="home-content">
        <h1 className="home-greeting">{greeting}</h1>

        {/* Required section */}
        <div className="home-section-title">
          <h2 className="home-section-title__heading">Required</h2>
        </div>

        {isLoading && <LoadingSkeleton lines={3} />}

        {isError && (
          <ErrorView
            title="Could not load courses"
            message="We could not retrieve your enrolled courses. Please try again."
            onRetry={() => refetch()}
          />
        )}

        {!isLoading && !isError && (!courses || courses.length === 0) && (
          <p className="home-empty">No required courses at the moment.</p>
        )}

        {!isLoading && !isError && courses && courses.map((course: EnrolledCourse) => (
          <CourseCardConnected
            key={course.courseId}
            course={course}
            onClick={() => navigate(`/course/${course.courseId}`)}
          />
        ))}

        {/* This week section */}
        <div className="home-section-title">
          <h2 className="home-section-title__heading">This week</h2>
          <span className="home-section-title__meta">2 learning days</span>
        </div>

        <div className="home-weekly-goal">
          <p className="home-weekly-goal__kicker">Weekly learning goal</p>
          <p className="home-weekly-goal__title">0 of 2 learning days this week</p>
          <div className="home-weekly-goal__meter" aria-hidden="true">
            <div className="home-weekly-goal__day" />
            <div className="home-weekly-goal__day" />
          </div>
          <p className="home-weekly-goal__desc">
            Learn on two different days this week, or finish everything currently available.
          </p>
          <p className="home-weekly-goal__streak">No week streak yet</p>
        </div>

        {/* Your progress section */}
        <div className="home-section-title">
          <h2 className="home-section-title__heading">Your progress</h2>
          <span className="home-section-title__meta">Across all courses</span>
        </div>

        <div className="home-stats">
          <div className="home-stat">
            <span className="home-stat__value">0</span>
            <span className="home-stat__label">Points</span>
          </div>
          <div className="home-stat">
            <span className="home-stat__value">0</span>
            <span className="home-stat__label">Week streak</span>
          </div>
          <div className="home-stat">
            <span className="home-stat__value">0</span>
            <span className="home-stat__label">Badges</span>
          </div>
        </div>

        {/* Explore section — show in-progress or first enrolled course */}
        <div className="home-section-title">
          <h2 className="home-section-title__heading">Explore</h2>
          <button
            type="button"
            className="home-section-title__link"
            onClick={() => navigate('/library')}
          >
            See all
          </button>
        </div>

        {courses && courses.length > 0 && (
          <CourseCardConnected
            course={courses[0]}
            onClick={() => navigate(`/course/${courses[0].courseId}`)}
          />
        )}
        {(!courses || courses.length === 0) && !isLoading && (
          <button
            type="button"
            className="hc-card"
            onClick={() => navigate('/library')}
          >
            <div className="hc-card__body">
              <span className="hc-card__category">All courses</span>
              <h2 className="hc-card__title">Browse the library</h2>
              <span className="hc-card__status">See what&apos;s available</span>
            </div>
            <ProgressRing completed={0} total={0} />
          </button>
        )}
      </main>
    </div>
  );
};
