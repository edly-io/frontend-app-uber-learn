import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { getEnrolledCourses, type EnrolledCourse } from '../api/catalog';
import { qk } from '../api/queries';
import { useCurriculums } from '../hooks/useCurriculums';
import { useCourseOutline } from '../hooks/useCourseOutline';
import { useCourseProgressSummary } from '../hooks/useCourseProgressSummary';
import { mapOutlineToLessons } from '../lib/outline-mapper';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorView } from '../components/ui/ErrorView';

import iconArrowLeft from '../assets/icons/icon-arrow-left.svg';
import iconChevronDown from '../assets/icons/icon-chevron-down.svg';
import iconChevronRight from '../assets/icons/chevron-right.svg';
import iconNoResults from '../assets/icons/icon-no-results.svg';
import courseArtBlue from '../assets/icons/course-art-blue.svg';
import courseArtTeal from '../assets/icons/course-art-teal.svg';
import courseArtLime from '../assets/icons/course-art-lime.svg';
import courseArtPurple from '../assets/icons/course-art-purple.svg';
import courseArtMagenta from '../assets/icons/course-art-magenta.svg';
import courseArtTeenRides from '../assets/icons/course-art-teen-rides.svg';
import courseArtOrange from '../assets/icons/course-art-orange.svg';

import './course-library.scss';

// ── Types ────────────────────────────────────────────────────────────────────

type CourseStatus = 'not-started' | 'in-progress' | 'completed';
type FilterKey = CourseStatus | 'in-paths';

// ── Helpers ────────────────────────────────────────────────────────────────────

function courseCountLabel(n: number): string {
  return n === 1 ? '1 course' : `${n} courses`;
}

// ── Art cycling ───────────────────────────────────────────────────────────────

type CourseTint = 'blue' | 'teal' | 'lime' | 'purple' | 'magenta' | 'teen-rides' | 'orange';

const TINTS: CourseTint[] = ['blue', 'teal', 'lime', 'purple', 'magenta', 'teen-rides', 'orange'];
const ART_SRCS: Record<CourseTint, string> = {
  blue: courseArtBlue,
  teal: courseArtTeal,
  lime: courseArtLime,
  purple: courseArtPurple,
  magenta: courseArtMagenta,
  'teen-rides': courseArtTeenRides,
  orange: courseArtOrange,
};

// ── Filters ───────────────────────────────────────────────────────────────────

const QUICK_CHIPS: { key: FilterKey; label: string }[] = [
  { key: 'completed', label: 'Completed' },
  { key: 'in-paths', label: 'In your paths' },
];

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
  index: number;
  inPath: boolean;
  category?: string;
  onClick: () => void;
  activeFilters: Set<FilterKey>;
  onResolved: (courseId: string, status: CourseStatus) => void;
}

const ConnectedCourseCard = ({
  course,
  index,
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

  const resumeIdx = allLessons.length > 0
    ? Math.min(Math.floor(fraction * allLessons.length), allLessons.length - 1)
    : 0;
  const nextLesson = allLessons[resumeIdx];

  let status: CourseStatus = 'not-started';
  if (fraction >= 1) { status = 'completed'; } else if (fraction > 0) { status = 'in-progress'; }

  React.useEffect(() => {
    onResolved(course.courseId, status);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (!passesFilters(status, inPath, activeFilters)) {
    return null;
  }

  const tint = TINTS[index % TINTS.length];
  const artSrc = ART_SRCS[tint];
  const showRealImage = Boolean(course.imageUrl) && !imgError;

  if (outlineError) {
    return (
      <div className="cl-card cl-card--error">
        <div className={`cl-card__tile cl-card__tile--${tint}`} />
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
        <div className={`cl-card__tile cl-card__tile--${tint}`} />
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
      <div className={`cl-card__tile${showRealImage ? '' : ` cl-card__tile--${tint}`}`}>
        {showRealImage ? (
          <img
            src={course.imageUrl!}
            alt=""
            className="cl-card__thumbnail"
            onError={() => setImgError(true)}
          />
        ) : (
          <img src={artSrc} alt="" className="cl-card__art" aria-hidden="true" />
        )}
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

interface FilterBarProps {
  active: Set<FilterKey>;
  onToggle: (key: FilterKey) => void;
  onOpenSheet: () => void;
}

const FilterBar = ({ active, onToggle, onOpenSheet }: FilterBarProps) => (
  <div className="cl-filter-bar" role="group" aria-label="Filter courses">
    <button
      type="button"
      className={`cl-filter-chip cl-filter-chip--has-icon${active.size > 0 ? ' cl-filter-chip--active' : ''}`}
      onClick={onOpenSheet}
      aria-expanded={false}
    >
      <span>{active.size > 0 ? `Filters · ${active.size}` : 'Filters'}</span>
      <img src={iconChevronDown} alt="" className="cl-filter-chip__icon" aria-hidden="true" />
    </button>
    {QUICK_CHIPS.map((chip) => (
      <button
        key={chip.key}
        type="button"
        className={`cl-filter-chip${active.has(chip.key) ? ' cl-filter-chip--active' : ''}`}
        onClick={() => onToggle(chip.key)}
        aria-pressed={active.has(chip.key)}
      >
        {chip.label}
      </button>
    ))}
  </div>
);

// ── Filter sheet ──────────────────────────────────────────────────────────────

interface CheckboxRowProps {
  label: string;
  checked: boolean;
  onChange: () => void;
}

const CheckboxRow = ({ label, checked, onChange }: CheckboxRowProps) => {
  const id = `cl-checkbox-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="cl-sheet-checkbox">
      <label htmlFor={id} className="cl-sheet-checkbox__label">{label}</label>
      <span className={`cl-sheet-checkbox__box${checked ? ' cl-sheet-checkbox__box--checked' : ''}`} aria-hidden="true">
        {checked && (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2.5 7L5.5 10L11.5 4" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <input id={id} type="checkbox" className="cl-sheet-checkbox__input" checked={checked} onChange={onChange} />
    </div>
  );
};

interface FiltersSheetProps {
  active: Set<FilterKey>;
  onToggle: (key: FilterKey) => void;
  onReset: () => void;
  onApply: () => void;
  onClose: () => void;
  totalVisible: number;
  hasPathCourses: boolean;
}

const FiltersSheet = ({
  active,
  onToggle,
  onReset,
  onApply,
  onClose,
  totalVisible,
  hasPathCourses,
}: FiltersSheetProps) => (
  <>
    <div className="cl-sheet-overlay" aria-hidden="true" onClick={onClose} />
    <div className="cl-sheet" role="dialog" aria-modal="true" aria-label="Filter courses">
      <div className="cl-sheet__grabber" aria-hidden="true" />
      <div className="cl-sheet__header">
        <span className="cl-sheet__title">Filters</span>
      </div>
      <div className="cl-sheet__body">
        <div className="cl-sheet-section">
          <p className="cl-sheet-section__heading">Status</p>
          {STATUS_FILTERS.map((f) => (
            <CheckboxRow
              key={f.key}
              label={f.label}
              checked={active.has(f.key)}
              onChange={() => onToggle(f.key)}
            />
          ))}
        </div>
        {hasPathCourses && (
          <div className="cl-sheet-section">
            <p className="cl-sheet-section__heading">Learning paths</p>
            <CheckboxRow
              label="In your paths"
              checked={active.has('in-paths')}
              onChange={() => onToggle('in-paths')}
            />
          </div>
        )}
      </div>
      <div className="cl-sheet__footer">
        <button type="button" className="btn-primary cl-sheet__apply" onClick={onApply}>
          {totalVisible === 1 ? 'Show 1 course' : `Show ${totalVisible} courses`}
        </button>
        <button type="button" className="btn-tertiary" onClick={onReset}>
          Reset
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

  const enrolledCourses = useMemo(() => courses ?? [], [courses]);

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
  const countVisible = (list: EnrolledCourse[], filters: Set<FilterKey>, defaultInPath: boolean) => list.filter((c) => {
    const s = resolvedStatuses[c.courseId] ?? 'not-started';
    const inPath = pathCourseIds.has(c.courseId);
    return passesFilters(s, inPath ?? defaultInPath, filters);
  }).length;

  const inProgressVisible = countVisible(inProgressCourses, activeFilters, false);
  const inYourPathsVisible = countVisible(inYourPathsCourses, activeFilters, true);
  const moreVisible = countVisible(moreCoursesList, activeFilters, false);
  const totalVisible = inProgressVisible + inYourPathsVisible + moreVisible;

  // For pending-filter count in sheet
  const pendingTotal = countVisible(enrolledCourses, pendingFilters, false);

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
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
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
                    {inProgressCourses.map((course, idx) => (
                      <ConnectedCourseCard
                        key={course.courseId}
                        course={course}
                        index={idx}
                        inPath={pathCourseIds.has(course.courseId)}
                        category={courseCategoryMap[course.courseId]}
                        activeFilters={activeFilters}
                        onResolved={handleStatusResolved}
                        onClick={() => navigate(`/course/${course.courseId}`)}
                      />
                    ))}
                  </Section>
                )}

                {/* In your paths */}
                {inYourPathsCourses.length > 0 && inYourPathsVisible > 0 && (
                  <Section title="In your paths" count={inYourPathsVisible}>
                    {inYourPathsCourses.map((course, idx) => (
                      <ConnectedCourseCard
                        key={course.courseId}
                        course={course}
                        index={inProgressCourses.length + idx}
                        inPath
                        category={courseCategoryMap[course.courseId]}
                        activeFilters={activeFilters}
                        onResolved={handleStatusResolved}
                        onClick={() => navigate(`/course/${course.courseId}`)}
                      />
                    ))}
                  </Section>
                )}

                {/* More courses */}
                {moreCoursesList.length > 0 && moreVisible > 0 && (
                  <Section title="More courses" count={moreVisible}>
                    {moreCoursesList.map((course, idx) => (
                      <ConnectedCourseCard
                        key={course.courseId}
                        course={course}
                        index={inProgressCourses.length + inYourPathsCourses.length + idx}
                        inPath={false}
                        activeFilters={activeFilters}
                        onResolved={handleStatusResolved}
                        onClick={() => navigate(`/course/${course.courseId}`)}
                      />
                    ))}
                  </Section>
                )}

                {/* Flat list fallback: no path courses at all */}
                {inYourPathsCourses.length === 0 && moreCoursesList.length === 0
                  && inProgressCourses.length === 0 && enrolledCourses.length > 0 && (
                  <div className="cl-course-list">
                    {enrolledCourses.map((course, idx) => (
                      <ConnectedCourseCard
                        key={course.courseId}
                        course={course}
                        index={idx}
                        inPath={false}
                        activeFilters={activeFilters}
                        onResolved={handleStatusResolved}
                        onClick={() => navigate(`/course/${course.courseId}`)}
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
          hasPathCourses={pathCourseIds.size > 0}
        />
      )}
    </div>
  );
};
