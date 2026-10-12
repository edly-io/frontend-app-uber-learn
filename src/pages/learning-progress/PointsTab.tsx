import React from 'react';
import { useQueries } from '@tanstack/react-query';
import { type EnrolledCourse } from '../../api/catalog';
import { getCourseOutline } from '../../api/courseware';
import { qk } from '../../api/queries';
import { countLessons } from '../../lib/outline-mapper';
import courseArtBlue from '../../assets/icons/course-art-blue2.svg';
import courseArtTeal from '../../assets/icons/course-art-teal2.svg';
import iconLightningLarge from '../../assets/icons/icon-lightning-large.svg';

// ── Points tab ───────────────────────────────────────────

interface CourseRowProps {
  course: EnrolledCourse;
  artSrc: string;
  tintClass: string;
  gamificationPoints?: number;
  totalLessons: number;
  completedLessons: number;
}

const PointsCourseRow = ({
  course, artSrc, tintClass, gamificationPoints, totalLessons, completedLessons,
}: CourseRowProps) => {
  const pointsEarned = gamificationPoints ?? 0;

  const statusText = totalLessons > 0
    ? `${completedLessons} of ${totalLessons} lessons complete`
    : 'Not started';

  return (
    <div className="lp-course-row">
      <div className={`lp-course-row__art ${tintClass}`}>
        <img src={artSrc} alt="" className="lp-course-row__art-img" aria-hidden="true" />
      </div>
      <div className="lp-course-row__body">
        <span className="lp-course-row__title">{course.title}</span>
        <span className="lp-course-row__status">{statusText}</span>
      </div>
      <span className="lp-course-row__points">
        {pointsEarned > 0 ? `+${pointsEarned}` : '0'}
      </span>
    </div>
  );
};

export const COURSE_ART = [
  { artSrc: courseArtBlue, tintClass: 'lp-course-row__art--blue' },
  { artSrc: courseArtTeal, tintClass: 'lp-course-row__art--teal' },
];

export interface PointsTabProps {
  courses: EnrolledCourse[];
  totalPoints: number;
  monthPoints?: number;
  coursePointsByKey?: Record<string, number>;
  isLoading?: boolean;
}

export const PointsTab = ({
  courses, totalPoints, monthPoints, coursePointsByKey, isLoading = false,
}: PointsTabProps) => {
  // Batch all outline and progress queries in parallel at the tab level.
  // This avoids per-row hooks which, while parallel, add up to 2×N requests.
  // TanStack Query deduplicates keys already in cache so these are no-ops
  // when CourseLibrary has already fetched them.
  const outlineQueries = useQueries({
    queries: courses.map((course) => ({
      queryKey: qk.outline(course.courseId),
      queryFn: () => getCourseOutline(course.courseId),
      staleTime: 5 * 60_000,
      enabled: Boolean(course.courseId),
    })),
  });

  return (
    <div className="lp-tab-content">
      {/* Hero card */}
      <div className="lp-points-hero">
        <div className="lp-points-hero__figure">
          <span className="lp-points-hero__label">Total points</span>
          <span className="lp-points-hero__value">{isLoading ? '—' : totalPoints}</span>
          <span className="lp-points-hero__sub">
            {isLoading ? '—' : `${monthPoints ?? totalPoints} this month`}
          </span>
        </div>
        <div className="lp-points-hero__art">
          <img src={iconLightningLarge} alt="" className="lp-points-hero__icon" aria-hidden="true" />
        </div>
      </div>

      {/* By course */}
      {courses.length > 0 && (
        <>
          <h2 className="lp-section-heading">By course</h2>
          <div className="lp-course-list">
            {courses.map((course, i) => {
              const outline = outlineQueries[i]?.data;
              // Use outline-based lesson counts (sequences) rather than progress API unit counts.
              const { total: totalLessons, completed: completedLessons } = outline
                ? countLessons(outline)
                : { total: 0, completed: 0 };
              return (
                <PointsCourseRow
                  key={course.courseId}
                  course={course}
                  artSrc={COURSE_ART[i % COURSE_ART.length].artSrc}
                  tintClass={COURSE_ART[i % COURSE_ART.length].tintClass}
                  gamificationPoints={coursePointsByKey?.[course.courseId]}
                  totalLessons={totalLessons}
                  completedLessons={completedLessons}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
