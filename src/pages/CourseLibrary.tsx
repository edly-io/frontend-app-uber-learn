import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { getEnrolledCourses, type EnrolledCourse } from '../api/catalog';
import { qk } from '../api/queries';
import { useCurriculums } from '../hooks/useCurriculums';
import { useCourseOutline } from '../hooks/useCourseOutline';
import { useCourseProgressSummary } from '../hooks/useCourseProgressSummary';
import { mapOutlineToLessons, findNextLessonIndex } from '../lib/outline-mapper';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorView } from '../components/ui/ErrorView';

import iconArrowLeft from '../assets/icons/icon-arrow-left.svg';
import iconChevronDown from '../assets/icons/icon-chevron-down.svg';
import iconChevronRight from '../assets/icons/chevron-right.svg';
import iconNoResults from '../assets/icons/icon-no-results.svg';
import scenePhoto from '../assets/images/scene-safety-education.png';

import './course-library.scss';

// ── Types ────────────────────────────────────────────────────────────────────

type CourseStatus = 'not-started' | 'in-progress' | 'completed';
type FilterKey = CourseStatus | 'in-paths';

// ── Helpers ────────────────────────────────────────────────────────────────────

function courseCountLabel(n: number): string {
  return n === 1 ? '1 course' : `${n} courses`;
}

// ── Art cycling ───────────────────────────────────────────────────────────────

// ── Filters ───────────────────────────────────────────────────────────────────

const STATUS_FILTERS: { key: CourseStatus; label: string }[] = [
  { key: 'not-started', label: 'Not started' },
  { key: 'in-progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
];

function passesFilters(status: CourseStatus, inPath: boolean, active: Set<FilterKey>): boolean {
  if (active.size === 0) { return true; }
  const statusActive = (['not-started', 'in-progress', 'completed'] as CourseStatus[]).filter((s) => active.has(s));
  if (statusActive.length > 0 && !statusActive.includes(status)) { return false; }
  if (active.has('in-paths') && !inPath) { return false; }
  return true;
}

// ── Connected course card ─────────────────────────────────────────────────────

interface ConnectedCourseCardProps {
  course: EnrolledCourse;
  inPath: boolean;
  category?: string;
  onClick: () => void;
  activeFilters: Set<FilterKey>;
  onResolved: (courseId: string, status: CourseStatus) => void;
}

const ConnectedCourseCard = ({
  course,
  inPath,
  category,
  onClick,
  activeFilters,
  onResolved,
}: ConnectedCourseCardProps) => {
  const { data: outline, isError: outlineError } = useCourseOutline(course.courseId);
  const { data: progressData } = useCourseProgressSummary(course.courseId);
  const [imgError, setImgError] = useState(false);

  const allLessons = useMemo(() => (outline ? mapOutlineToLessons(outline) : []), [outline]);

  const fraction = progressData?.fraction ?? 0;

  // First lesson the outline reports incomplete. `fraction` is a unit ratio and cannot be
  // scaled into a lesson index (units per lesson vary).
  const nextLessonIdx = findNextLessonIndex(allLessons);
  const nextLesson = nextLessonIdx >= 0 ? allLessons[nextLessonIdx] : undefined;

  let status: CourseStatus = 'not-started';
  if (fraction >= 1) { status = 'completed'; } else if (fraction > 0) { status = 'in-progress'; }

  React.useEffect(() => {
    onResolved(course.courseId, status);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (!passesFilters(status, inPath, activeFilters)) {
    return null;
  }

  const showRealImage = Boolean(course.imageUrl) && !imgError;

  if (outlineError) {
    return (
      <div className="cl-card cl-card--error">
        <div className="cl-card__tile" />
        <div className="cl-card__body">
          <span className="cl-card__title">{course.title}</span>
          <span className="cl-card__next cl-card__next--error">Could not load</span>
        </div>
      </div>
    );
  }

  if (!outline) {
    return (
      <div className="cl-card cl-card--loading" aria-busy="true">
        <div className="cl-card__tile" />
        <div className="cl-card__body">
          <LoadingSkeleton variant="card" />
        </div>
      </div>
    );
  }

  let subtitle: React.ReactNode = null;
  if (status === 'completed') {
    subtitle = <span className="cl-card__next cl-card__next--done">Complete</span>;
  } else if (status === 'in-progress' && nextLesson) {
    subtitle = <span className="cl-card__next">Next: {nextLesson.lessonTitle}</span>;
  } else if (allLessons.length > 0) {
    subtitle = (
      <span className="cl-card__next">
        {allLessons.length === 1 ? '1 lesson' : `${allLessons.length} lessons`}
      </span>
    );
  }

  return (
    <button type="button" className="cl-card" onClick={onClick} aria-label={`Open ${course.title}`}>
      <div className="cl-card__tile">
        <img
          src={showRealImage ? course.imageUrl! : scenePhoto}
          alt=""
          className="cl-card__thumbnail"
          onError={() => setImgError(true)}
          aria-hidden="true"
        />
      </div>
      <div className="cl-card__body">
        {category && <span className="cl-card__category">{category}</span>}
        <span className="cl-card__title">{course.title}</span>
        {subtitle}
        {status === 'in-progress' && fraction > 0 && (
          <div className="cl-card__progress-wrap">
            <div className="cl-card__progress-bar">
              <div
                className="cl-card__progress-fill"
                style={{ width: `${Math.round(fraction * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
      <img src={iconChevronRight} alt="" className="cl-card__chevron" aria-hidden="true" />
    </button>
  );
};

// ── Filter bar ────────────────────────────────────────────────────────────────

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

interface FilterBarProps {
  active: Set<FilterKey>;
  onToggle: (key: FilterKey) => void;
  onOpenSheet: () => void;
}

const FilterBar = ({ active, onToggle, onOpenSheet }: FilterBarProps) => {
  const activeStatusFilters = STATUS_FILTERS.filter((f) => active.has(f.key));
  const completedIsActive = active.has('completed');

  return (
    <div className="cl-filter-bar" role="group" aria-label="Filter courses">
      <button
        type="button"
        className="cl-filter-chip cl-filter-chip--has-icon"
        onClick={onOpenSheet}
        aria-expanded={false}
      >
        <span>{active.size > 0 ? `Filters · ${active.size}` : 'Filters'}</span>
        <img src={iconChevronDown} alt="" className="cl-filter-chip__icon" aria-hidden="true" />
      </button>

      {activeStatusFilters.map((f) => (
        <button
          key={f.key}
          type="button"
          className="cl-filter-chip cl-filter-chip--selected"
          onClick={() => onToggle(f.key)}
          aria-label={`Remove ${f.label} filter`}
        >
          <span>{f.label}</span>
          <XIcon />
        </button>
      ))}

      {!completedIsActive && (
        <button
          type="button"
          className="cl-filter-chip"
          onClick={() => onToggle('completed')}
          aria-pressed={false}
        >
          Completed
        </button>
      )}
    </div>
  );
};

// ── Filter sheet ──────────────────────────────────────────────────────────────

interface ListItemProps {
  label: string;
  checked: boolean;
  onChange: () => void;
  divider?: boolean;
}

const ListItem = ({
  label, checked, onChange, divider = true,
}: ListItemProps) => (
  <button
    type="button"
    className={`cl-sheet-list-item${divider ? ' cl-sheet-list-item--divider' : ''}`}
    onClick={onChange}
    aria-pressed={checked}
  >
    <span className="cl-sheet-list-item__label">{label}</span>
    <span className="cl-sheet-list-item__control" aria-hidden="true">
      {checked ? (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="4" fill="black" />
          <path d="M6 12.5L10 16.5L18 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="0.75" y="0.75" width="22.5" height="22.5" rx="3.25" stroke="var(--u-content-state-disabled)" strokeWidth="1.5" />
        </svg>
      )}
    </span>
  </button>
);

interface FiltersSheetProps {
  active: Set<FilterKey>;
  onToggle: (key: FilterKey) => void;
  onReset: () => void;
  onApply: () => void;
  onClose: () => void;
  totalVisible: number;
}

const FiltersSheet = ({
  active,
  onToggle,
  onReset,
  onApply,
  onClose,
  totalVisible,
}: FiltersSheetProps) => (
  <>
    <div className="cl-sheet-overlay" aria-hidden="true" onClick={onClose} />
    <div className="cl-sheet" role="dialog" aria-modal="true" aria-label="Filter courses">
      <div className="cl-sheet__grabber" aria-hidden="true" />
      <div className="cl-sheet__header">
        <span className="cl-sheet__title">Filters</span>
      </div>
      <div className="cl-sheet__divider" aria-hidden="true" />
      <div className="cl-sheet__body">
        <div className="cl-sheet-section">
          <p className="cl-sheet-section__heading">Status</p>
          {STATUS_FILTERS.map((f, idx) => (
            <ListItem
              key={f.key}
              label={f.label}
              checked={active.has(f.key)}
              onChange={() => onToggle(f.key)}
              divider={idx < STATUS_FILTERS.length - 1}
            />
          ))}
        </div>
      </div>
      <div className="cl-sheet__footer">
        <button type="button" className="cl-sheet__reset" onClick={onReset}>
          Reset
        </button>
        <button type="button" className="cl-sheet__apply" onClick={onApply}>
          {totalVisible === 1 ? 'Show 1 course' : `Show ${totalVisible} courses`}
        </button>
      </div>
    </div>
  </>
);

// ── Section ───────────────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  count: number;
  children: React.ReactNode;
}

const Section = ({ title, count, children }: SectionProps) => (
  <div className="cl-section">
    <div className="cl-section-header">
      <h2 className="cl-section-header__title">{title}</h2>
      <span className="cl-section-header__meta">{courseCountLabel(count)}</span>
    </div>
    <div className="cl-course-list">{children}</div>
  </div>
);

// ── No results ────────────────────────────────────────────────────────────────

const NoResults = ({ onClear }: { onClear: () => void }) => (
  <div className="cl-no-results">
    <div className="cl-no-results__spot">
      <img src={iconNoResults} alt="" className="cl-no-results__art" aria-hidden="true" />
    </div>
    <p className="cl-no-results__message">No courses match these filters</p>
    <p className="cl-no-results__subtitle">Try fewer filters, or clear them to see every course.</p>
    <button type="button" className="cl-no-results__clear" onClick={onClear}>
      Clear filters
    </button>
  </div>
);

// ── Main page ─────────────────────────────────────────────────────────────────

export const CourseLibrary = () => {
  const navigate = useNavigate();

  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set());
  const [pendingFilters, setPendingFilters] = useState<Set<FilterKey>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [resolvedStatuses, setResolvedStatuses] = useState<Record<string, CourseStatus>>({});

  const {
    data: courses, isLoading, isError, refetch,
  } = useQuery({
    queryKey: qk.enrolledCourses(),
    queryFn: getEnrolledCourses,
    staleTime: 5 * 60_000,
  });

  const { data: curricula } = useCurriculums();

  const kcCourseIds = useMemo(() => {
    const ids = new Set<string>();
    curricula?.forEach((c) => {
      if (c.knowledge_check?.course_id) { ids.add(c.knowledge_check.course_id); }
    });
    return ids;
  }, [curricula]);

  const enrolledCourses = useMemo(
    () => (courses ?? []).filter((c) => !kcCourseIds.has(c.courseId)),
    [courses, kcCourseIds],
  );

  const pathCourseIds = useMemo(() => {
    const ids = new Set<string>();
    curricula?.forEach((c) => c.courses.forEach((cc) => ids.add(cc.course_id)));
    return ids;
  }, [curricula]);

  const courseCategoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    curricula?.forEach((c) => c.courses.forEach((cc) => {
      if (!map[cc.course_id]) { map[cc.course_id] = c.title; }
    }));
    return map;
  }, [curricula]);

  // ── Three-section split ───────────────────────────────────────────────────
  // In progress: any course (path or not) with status === 'in-progress'
  // In your paths: path courses that are completed or not-started
  // More courses: non-path courses that are completed or not-started
  const inProgressCourses = useMemo(
    () => enrolledCourses.filter((c) => resolvedStatuses[c.courseId] === 'in-progress'),
    [enrolledCourses, resolvedStatuses],
  );
  const inProgressIds = useMemo(
    () => new Set(inProgressCourses.map((c) => c.courseId)),
    [inProgressCourses],
  );
  const inYourPathsCourses = useMemo(
    () => enrolledCourses.filter((c) => pathCourseIds.has(c.courseId) && !inProgressIds.has(c.courseId)),
    [enrolledCourses, pathCourseIds, inProgressIds],
  );
  const moreCoursesList = useMemo(
    () => enrolledCourses.filter((c) => !pathCourseIds.has(c.courseId) && !inProgressIds.has(c.courseId)),
    [enrolledCourses, pathCourseIds, inProgressIds],
  );

  const handleStatusResolved = (courseId: string, status: CourseStatus) => {
    setResolvedStatuses((prev) => {
      if (prev[courseId] === status) { return prev; }
      return { ...prev, [courseId]: status };
    });
  };

  const toggleFilter = (key: FilterKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  };

  const openSheet = () => {
    setPendingFilters(new Set(activeFilters));
    setSheetOpen(true);
  };

  const togglePending = (key: FilterKey) => {
    setPendingFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  };

  const applySheet = () => {
    setActiveFilters(new Set(pendingFilters));
    setSheetOpen(false);
  };

  const clearFilters = () => {
    setActiveFilters(new Set());
    setPendingFilters(new Set());
    setSheetOpen(false);
  };

  // Visible counts per section (for "Show N courses" in filter sheet and section metas)
  const countVisible = (list: EnrolledCourse[], filters: Set<FilterKey>) => list.filter((c) => {
    const s = resolvedStatuses[c.courseId] ?? 'not-started';
    const inPath = pathCourseIds.has(c.courseId);
    return passesFilters(s, inPath, filters);
  }).length;

  const inProgressVisible = countVisible(inProgressCourses, activeFilters);
  const inYourPathsVisible = countVisible(inYourPathsCourses, activeFilters);
  const moreVisible = countVisible(moreCoursesList, activeFilters);
  const totalVisible = inProgressVisible + inYourPathsVisible + moreVisible;

  // For pending-filter count in sheet
  const pendingTotal = countVisible(enrolledCourses, pendingFilters);

  const hasFilters = activeFilters.size > 0;
  const allResolved = Object.keys(resolvedStatuses).length === enrolledCourses.length;
  const showNoResults = hasFilters && totalVisible === 0 && allResolved;

  return (
    <div className="cl-page">
      <header className="cl-nav" aria-label="All courses navigation">
        <button
          type="button"
          className="cl-nav__back"
          aria-label="Back to learning home"
          onClick={() => navigate('/')}
        >
          <img src={iconArrowLeft} alt="" className="cl-nav__back-icon" aria-hidden="true" />
        </button>
      </header>

      <div className="cl-heading">
        <h1 className="cl-heading__title">All courses</h1>
        <p className="cl-heading__subtitle">Every course available to you, any time.</p>
      </div>

      {!isLoading && !isError && enrolledCourses.length > 0 && (
        <div className="cl-filter-bar-wrap">
          <FilterBar active={activeFilters} onToggle={toggleFilter} onOpenSheet={openSheet} />
        </div>
      )}

      <main className="cl-content">
        {isLoading && <LoadingSkeleton />}

        {isError && (
          <ErrorView
            title="Could not load courses"
            message="We could not retrieve your courses. Please try again."
            onRetry={() => refetch()}
          />
        )}

        {!isLoading && !isError && enrolledCourses.length > 0 && (
          <>
            <p className="cl-results-line">
              <span className="cl-results-line__count">{courseCountLabel(totalVisible)}</span>
              {hasFilters && (
                <button type="button" className="cl-results-line__reset" onClick={clearFilters}>
                  Reset
                </button>
              )}
            </p>

            {showNoResults && <NoResults onClear={clearFilters} />}

            {!showNoResults && (
              <>
                {/* In progress */}
                {inProgressCourses.length > 0 && inProgressVisible > 0 && (
                  <Section title="In progress" count={inProgressVisible}>
                    {inProgressCourses.map((course) => (
                      <ConnectedCourseCard
                        key={course.courseId}
                        course={course}
                        inPath={pathCourseIds.has(course.courseId)}
                        category={courseCategoryMap[course.courseId]}
                        activeFilters={activeFilters}
                        onResolved={handleStatusResolved}
                        onClick={() => navigate(`/course/${course.courseId}`, { state: { origin: '/courses' } })}
                      />
                    ))}
                  </Section>
                )}

                {(inYourPathsCourses.length > 0 || moreCoursesList.length > 0)
                  && (inYourPathsVisible + moreVisible) > 0 && (
                  <Section title="More courses" count={inYourPathsVisible + moreVisible}>
                    {inYourPathsCourses.map((course) => (
                      <ConnectedCourseCard
                        key={course.courseId}
                        course={course}
                        inPath
                        category={courseCategoryMap[course.courseId]}
                        activeFilters={activeFilters}
                        onResolved={handleStatusResolved}
                        onClick={() => navigate(`/course/${course.courseId}`, { state: { origin: '/courses' } })}
                      />
                    ))}
                    {moreCoursesList.map((course) => (
                      <ConnectedCourseCard
                        key={course.courseId}
                        course={course}
                        inPath={false}
                        activeFilters={activeFilters}
                        onResolved={handleStatusResolved}
                        onClick={() => navigate(`/course/${course.courseId}`, { state: { origin: '/courses' } })}
                      />
                    ))}
                  </Section>
                )}

                {/* Flat list fallback: no path courses at all */}
                {inYourPathsCourses.length === 0 && moreCoursesList.length === 0
                  && inProgressCourses.length === 0 && enrolledCourses.length > 0 && (
                  <div className="cl-course-list">
                    {enrolledCourses.map((course) => (
                      <ConnectedCourseCard
                        key={course.courseId}
                        course={course}
                        inPath={false}
                        activeFilters={activeFilters}
                        onResolved={handleStatusResolved}
                        onClick={() => navigate(`/course/${course.courseId}`, { state: { origin: '/courses' } })}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {!isLoading && !isError && enrolledCourses.length === 0 && (
          <div className="cl-no-results">
            <div className="cl-no-results__spot">
              <img src={iconNoResults} alt="" className="cl-no-results__art" aria-hidden="true" />
            </div>
            <p className="cl-no-results__message">You have no courses yet</p>
          </div>
        )}
      </main>

      <footer className="cl-footer">
        <button type="button" className="cl-footer__btn" onClick={() => navigate('/')}>
          Back to learning home
        </button>
      </footer>

      {sheetOpen && (
        <FiltersSheet
          active={pendingFilters}
          onToggle={togglePending}
          onReset={() => setPendingFilters(new Set())}
          onApply={applySheet}
          onClose={() => setSheetOpen(false)}
          totalVisible={pendingTotal}
        />
      )}
    </div>
  );
};
