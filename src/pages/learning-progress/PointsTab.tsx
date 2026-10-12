import React from 'react';
import { type EnrolledCourse } from '../../api/catalog';
import { useCourseOutline } from '../../hooks/useCourseOutline';
import { useCourseProgressSummary } from '../../hooks/useCourseProgressSummary';
import { mapOutlineToLessons } from '../../lib/outline-mapper';
import courseArtBlue from '../../assets/icons/course-art-blue2.svg';
import courseArtTeal from '../../assets/icons/course-art-teal2.svg';
import iconLightningLarge from '../../assets/icons/icon-lightning-large.svg';

// ── Points tab ───────────────────────────────────────────

interface CourseRowProps {
  course: EnrolledCourse;
  artSrc: string;
  tintClass: string;
  gamificationPoints?: number;
}

const PointsCourseRow = ({
  course, artSrc, tintClass, gamificationPoints,
}: CourseRowProps) => {
  const outlineQuery = useCourseOutline(course.courseId);
  const progressQuery = useCourseProgressSummary(course.courseId);
  const totalLessons = outlineQuery.data ? mapOutlineToLessons(outlineQuery.data).length : 0;
  const completedLessons = progressQuery.data?.completedUnits ?? 0;
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
}

export const PointsTab = ({
  courses, totalPoints, monthPoints, coursePointsByKey,
}: PointsTabProps) => (
  <div className="lp-tab-content">
    {/* Hero card */}
    <div className="lp-points-hero">
      <div className="lp-points-hero__figure">
        <span className="lp-points-hero__label">Total points</span>
        <span className="lp-points-hero__value">{totalPoints}</span>
        <span className="lp-points-hero__sub">{monthPoints ?? totalPoints} this month</span>
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
          {courses.map((course, i) => (
            <PointsCourseRow
              key={course.courseId}
              course={course}
              artSrc={COURSE_ART[i % COURSE_ART.length].artSrc}
              tintClass={COURSE_ART[i % COURSE_ART.length].tintClass}
              gamificationPoints={coursePointsByKey?.[course.courseId]}
            />
          ))}
        </div>
      </>
    )}
  </div>
);
