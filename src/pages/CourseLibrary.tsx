import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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

import './course-library.css';

type CourseStatus = 'not-started' | 'in-progress' | 'completed';
type CourseType = 'required' | 'optional';
type CourseTopic = 'safety' | 'basics' | 'driving' | 'riders' | 'vehicle';
type CourseTint = 'blue' | 'teal' | 'lime' | 'purple' | 'magenta' | 'teen-rides' | 'orange';
type FilterKey = CourseStatus | CourseType | CourseTopic;

interface CourseItem {
  id: string;
  title: string;
  category: string;
  tint: CourseTint;
  artSrc: string;
  type: CourseType;
  topic: CourseTopic;
  status: CourseStatus;
  progress: number;
  nextStep: string;
}

const ALL_COURSES: CourseItem[] = [
  {
    id: 'sexual-misconduct',
    title: 'Sexual misconduct education',
    category: 'Required · Safety',
    tint: 'blue',
    artSrc: courseArtBlue,
    type: 'required',
    topic: 'safety',
    status: 'in-progress',
    progress: 0.4,
    nextStep: 'Next: Module 3 · Reporting',
  },
  {
    id: 'regional-safety',
    title: 'Regional safety training',
    category: 'Required · Safety',
    tint: 'teal',
    artSrc: courseArtTeal,
    type: 'required',
    topic: 'safety',
    status: 'not-started',
    progress: 0,
    nextStep: '4 lessons',
  },
  {
    id: 'getting-started',
    title: 'Getting started',
    category: 'Optional · Basics',
    tint: 'lime',
    artSrc: courseArtLime,
    type: 'optional',
    topic: 'basics',
    status: 'not-started',
    progress: 0,
    nextStep: '3 lessons',
  },
  {
    id: 'vehicle-maintenance',
    title: 'Vehicle maintenance',
    category: 'Optional · Vehicle',
    tint: 'purple',
    artSrc: courseArtPurple,
    type: 'optional',
    topic: 'vehicle',
    status: 'not-started',
    progress: 0,
    nextStep: '5 lessons',
  },
  {
    id: 'tough-situations',
    title: 'Tips for tough situations',
    category: 'Optional · Safety',
    tint: 'magenta',
    artSrc: courseArtMagenta,
    type: 'optional',
    topic: 'safety',
    status: 'not-started',
    progress: 0,
    nextStep: '4 lessons',
  },
  {
    id: 'teen-rides',
    title: 'Teen rides',
    category: 'Optional · Riders',
    tint: 'teen-rides',
    artSrc: courseArtTeenRides,
    type: 'optional',
    topic: 'riders',
    status: 'not-started',
    progress: 0,
    nextStep: '3 lessons',
  },
  {
    id: 'road-safety',
    title: 'Road safety fundamentals',
    category: 'Optional · Driving',
    tint: 'orange',
    artSrc: courseArtOrange,
    type: 'optional',
    topic: 'driving',
    status: 'not-started',
    progress: 0,
    nextStep: '6 lessons',
  },
];

const STATUS_FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'not-started', label: 'Not started' },
  { key: 'in-progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
];

const TYPE_FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'required', label: 'Required' },
  { key: 'optional', label: 'Optional' },
];

const TOPIC_FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'safety', label: 'Safety' },
  { key: 'basics', label: 'Basics' },
  { key: 'driving', label: 'Driving' },
  { key: 'riders', label: 'Riders' },
  { key: 'vehicle', label: 'Vehicle' },
];

function applyFilters(courses: CourseItem[], active: Set<FilterKey>): CourseItem[] {
  if (active.size === 0) return courses;
  return courses.filter(c => {
    const hasStatus = STATUS_FILTERS.some(f => active.has(f.key));
    const hasType = TYPE_FILTERS.some(f => active.has(f.key));
    const hasTopic = TOPIC_FILTERS.some(f => active.has(f.key));
    if (hasStatus && !active.has(c.status)) return false;
    if (hasType && !active.has(c.type)) return false;
    if (hasTopic && !active.has(c.topic)) return false;
    return true;
  });
}

interface CourseCardProps {
  course: CourseItem;
  onClick: () => void;
}

const CourseCard = ({ course, onClick }: CourseCardProps) => (
  <button type="button" className="cl-card" onClick={onClick}>
    <div className={`cl-card__tile cl-card__tile--${course.tint}`}>
      <img src={course.artSrc} alt="" className="cl-card__art" aria-hidden="true" />
    </div>
    <div className="cl-card__body">
      <span className="cl-card__category">{course.category}</span>
      <span className="cl-card__title">{course.title}</span>
      {course.status === 'in-progress' && course.progress > 0 ? (
        <div className="cl-card__progress-wrap">
          <div className="cl-card__progress-bar">
            <div
              className="cl-card__progress-fill"
              style={{ width: `${Math.round(course.progress * 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <span className="cl-card__next">{course.nextStep}</span>
      )}
    </div>
    <img src={iconChevronRight} alt="" className="cl-card__chevron" aria-hidden="true" />
  </button>
);

interface FilterBarProps {
  active: Set<FilterKey>;
  onToggle: (key: FilterKey) => void;
  onOpenSheet: () => void;
}

const FilterBar = ({ active, onToggle, onOpenSheet }: FilterBarProps) => {
  const activeCount = active.size;
  const quickFilters: { key: FilterKey; label: string }[] = [
    ...TYPE_FILTERS,
    { key: 'in-progress', label: 'In progress' },
    { key: 'completed', label: 'Completed' },
  ];
  return (
    <div className="cl-filter-bar" role="group" aria-label="Filter courses">
      <button
        type="button"
        className={`cl-filter-chip cl-filter-chip--has-icon${activeCount > 0 ? ' cl-filter-chip--active' : ''}`}
        onClick={onOpenSheet}
        aria-expanded={false}
      >
        <span>{activeCount > 0 ? `Filters · ${activeCount}` : 'Filters'}</span>
        <img src={iconChevronDown} alt="" className="cl-filter-chip__icon" aria-hidden="true" />
      </button>
      {quickFilters.map(f => (
        <button
          key={f.key}
          type="button"
          className={`cl-filter-chip${active.has(f.key) ? ' cl-filter-chip--active' : ''}`}
          onClick={() => onToggle(f.key)}
          aria-pressed={active.has(f.key)}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
};

interface CheckboxRowProps {
  label: string;
  checked: boolean;
  onChange: () => void;
}

const CheckboxRow = ({ label, checked, onChange }: CheckboxRowProps) => (
  <label className="cl-sheet-checkbox">
    <span className="cl-sheet-checkbox__label">{label}</span>
    <span className={`cl-sheet-checkbox__box${checked ? ' cl-sheet-checkbox__box--checked' : ''}`} aria-hidden="true">
      {checked && (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M2.5 7L5.5 10L11.5 4" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </span>
    <input
      type="checkbox"
      className="cl-sheet-checkbox__input"
      checked={checked}
      onChange={onChange}
    />
  </label>
);

interface FiltersSheetProps {
  active: Set<FilterKey>;
  filteredCount: number;
  onToggle: (key: FilterKey) => void;
  onReset: () => void;
  onApply: () => void;
  onClose: () => void;
}

const FiltersSheet = ({ active, filteredCount, onToggle, onReset, onApply, onClose }: FiltersSheetProps) => (
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
          {STATUS_FILTERS.map(f => (
            <CheckboxRow
              key={f.key}
              label={f.label}
              checked={active.has(f.key)}
              onChange={() => onToggle(f.key)}
            />
          ))}
        </div>
        <div className="cl-sheet-section">
          <p className="cl-sheet-section__heading">Type</p>
          {TYPE_FILTERS.map(f => (
            <CheckboxRow
              key={f.key}
              label={f.label}
              checked={active.has(f.key)}
              onChange={() => onToggle(f.key)}
            />
          ))}
        </div>
        <div className="cl-sheet-section">
          <p className="cl-sheet-section__heading">Topic</p>
          <div className="cl-sheet-topics">
            {TOPIC_FILTERS.map(f => (
              <button
                key={f.key}
                type="button"
                className={`cl-sheet-topic-chip${active.has(f.key) ? ' cl-sheet-topic-chip--active' : ''}`}
                onClick={() => onToggle(f.key)}
                aria-pressed={active.has(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="cl-sheet__footer">
        <button type="button" className="btn-primary cl-sheet__apply" onClick={onApply}>
          {filteredCount === 1 ? 'Show 1 course' : `Show ${filteredCount} courses`}
        </button>
        <button type="button" className="btn-tertiary" onClick={onReset}>
          Reset
        </button>
      </div>
    </div>
  </>
);

interface SectionHeaderProps {
  title: string;
  meta?: string;
}

const SectionHeader = ({ title, meta }: SectionHeaderProps) => (
  <div className="cl-section-header">
    <h2 className="cl-section-header__title">{title}</h2>
    {meta && <span className="cl-section-header__meta">{meta}</span>}
  </div>
);

const NoResults = ({ onClear }: { onClear: () => void }) => (
  <div className="cl-no-results">
    <div className="cl-no-results__spot">
      <img src={iconNoResults} alt="" className="cl-no-results__art" aria-hidden="true" />
    </div>
    <p className="cl-no-results__message">No courses match these filters</p>
    <button type="button" className="cl-no-results__clear" onClick={onClear}>
      Clear filters
    </button>
  </div>
);

export const CourseLibrary = () => {
  const navigate = useNavigate();
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<Set<FilterKey>>(new Set());

  const filtered = applyFilters(ALL_COURSES, activeFilters);
  const required = filtered.filter(c => c.type === 'required');
  const optional = filtered.filter(c => c.type === 'optional');

  const requiredAll = ALL_COURSES.filter(c => c.type === 'required');
  const requiredDone = requiredAll.filter(c => c.status === 'completed').length;

  const pendingFiltered = applyFilters(ALL_COURSES, pendingFilters);

  const toggleFilter = (key: FilterKey) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openSheet = () => {
    setPendingFilters(new Set(activeFilters));
    setSheetOpen(true);
  };

  const togglePending = (key: FilterKey) => {
    setPendingFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const applySheet = () => {
    setActiveFilters(new Set(pendingFilters));
    setSheetOpen(false);
  };

  const resetSheet = () => {
    setPendingFilters(new Set());
  };

  const clearFilters = () => {
    setActiveFilters(new Set());
    setSheetOpen(false);
  };

  const totalCount = filtered.length;
  const hasFilters = activeFilters.size > 0;
  const hasRequired = required.length > 0 || !hasFilters;
  const showRequired = required.length > 0;
  const showOptional = optional.length > 0;

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

      <div className="cl-filter-bar-wrap">
        <FilterBar
          active={activeFilters}
          onToggle={toggleFilter}
          onOpenSheet={openSheet}
        />
      </div>

      <main className="cl-content">
        <p className="cl-results-line">
          <span className="cl-results-line__count">
            {totalCount === 1 ? '1 course' : `${totalCount} courses`}
          </span>
          {hasFilters && (
            <button type="button" className="cl-results-line__reset" onClick={clearFilters}>
              Reset
            </button>
          )}
        </p>

        {totalCount === 0 && (
          <NoResults onClear={clearFilters} />
        )}

        {showRequired && (
          <section aria-label="Required courses">
            <SectionHeader
              title="Required"
              meta={`${requiredDone} of ${requiredAll.length} done`}
            />
            <div className="cl-course-list">
              {required.map(course => (
                <CourseCard
                  key={course.id}
                  course={course}
                  onClick={() => navigate(`/course/${course.id}`)}
                />
              ))}
            </div>
          </section>
        )}

        {showOptional && (
          <section aria-label="Optional courses">
            <SectionHeader title="Optional" />
            <div className="cl-course-list">
              {optional.map(course => (
                <CourseCard
                  key={course.id}
                  course={course}
                  onClick={() => navigate(`/course/${course.id}`)}
                />
              ))}
            </div>
          </section>
        )}

        {hasFilters && !showRequired && !showOptional && null}
      </main>

      <footer className="cl-footer">
        <button
          type="button"
          className="cl-footer__btn"
          onClick={() => navigate('/')}
        >
          Back to learning home
        </button>
      </footer>

      {sheetOpen && (
        <FiltersSheet
          active={pendingFilters}
          filteredCount={pendingFiltered.length}
          onToggle={togglePending}
          onReset={resetSheet}
          onApply={applySheet}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
};
