import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  searchLearnerContent,
  type LearnerCurriculum,
  type SearchCourseResult,
} from '../api/curriculum';
import { qk } from '../api/queries';

import { ErrorView } from '../components/ui/ErrorView';

import iconArrowLeft from '../assets/icons/icon-arrow-left.svg';
import iconSearch from '../assets/icons/icon-search.svg';
import iconClock from '../assets/icons/icon-clock-outlined.svg';
import iconX from '../assets/icons/icon-x.svg';
import iconBadgeCheck from '../assets/icons/icon-badge-check.svg';
import searchNoResults from '../assets/icons/search-no-results.svg';
import scenePhotoThumb from '../assets/images/scene-safety-education-thumb.png';

import './search-page.scss';

// ── Recent searches (localStorage) ───────────────────────

const STORAGE_KEY = 'uber-learn-recent-searches';
const MAX_RECENT = 8;

function getRecentSearches(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  const list = getRecentSearches().filter((s) => s !== query);
  list.unshift(query);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch { /* storage blocked or full: recents are best-effort */ }
}

function removeRecentSearch(query: string) {
  const list = getRecentSearches().filter((s) => s !== query);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}

// ── Icons ─────────────────────────────────────────────────

const ChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ── Search result components ──────────────────────────────

const CourseResult = ({ course, onClick }: { course: SearchCourseResult; onClick: () => void }) => (
  <button type="button" className="sp-course-card" onClick={onClick}>
    <div className="sp-course-card__art">
      <img
        src={course.image_url || scenePhotoThumb}
        alt=""
        aria-hidden="true"
        className="sp-course-card__art-img"
        loading="eager"
        width="64"
        height="64"
        onError={(e) => { e.currentTarget.src = scenePhotoThumb; }}
      />
    </div>
    <div className="sp-course-card__body">
      {course.org && <span className="sp-course-card__kicker">{course.org}</span>}
      <span className="sp-course-card__title">{course.display_name}</span>
    </div>
    <ChevronRight />
  </button>
);

const CurriculumResult = ({ curriculum, onClick }: { curriculum: LearnerCurriculum; onClick: () => void }) => {
  const nextCourse = curriculum.courses?.find((c) => !c.finished);
  const badgeUrl = curriculum.milestones?.complete?.badge?.image_url ?? null;
  return (
    <button type="button" className="sp-path-card" onClick={onClick}>
      <div className="sp-path-card__seal">
        <div className="sp-path-card__seal-inner">
          <img
            src={badgeUrl || iconBadgeCheck}
            alt=""
            className={`sp-path-card__seal-art${curriculum.courses_finished < curriculum.courses_total ? ' sp-path-card__seal-art--locked' : ''}`}
            aria-hidden="true"
            onError={(e) => {
              if (e.currentTarget.dataset.fallback) { return; }
              // eslint-disable-next-line no-param-reassign
              e.currentTarget.dataset.fallback = '1';
              e.currentTarget.src = iconBadgeCheck;
            }}
          />
        </div>
      </div>
      <div className="sp-path-card__body">
        <span className="sp-path-card__title">{curriculum.title}</span>
        <div className="sp-path-card__meta">
          <span className="sp-path-card__progress">{curriculum.courses_finished} of {curriculum.courses_total} courses done</span>
          {nextCourse?.display_name && (
            <span className="sp-path-card__next">Next: {nextCourse.display_name}</span>
          )}
        </div>
      </div>
      <ChevronRight />
    </button>
  );
};

// ── Main component ────────────────────────────────────────

export const SearchPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [recents, setRecents] = useState<string[]>(() => getRecentSearches());

  // Fire search 300ms after user stops typing; recents are saved only on deliberate submit
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setDebouncedQuery('');
      return undefined;
    }
    const timer = setTimeout(() => {
      setDebouncedQuery(trimmed);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const {
    data, isLoading, isFetching, isError, refetch,
  } = useQuery({
    queryKey: qk.search(debouncedQuery),
    queryFn: () => searchLearnerContent(debouncedQuery),
    enabled: Boolean(debouncedQuery),
    staleTime: 60_000,
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const curriculumResults = data?.curriculums ?? [];
  const courseResults = data?.courses ?? [];
  const totalResults = curriculumResults.length + courseResults.length;

  const handleClear = () => {
    setQuery('');
    setDebouncedQuery('');
    inputRef.current?.focus();
  };

  const handleRemoveRecent = (s: string) => {
    removeRecentSearch(s);
    setRecents(getRecentSearches());
  };

  // Enter key: fire immediately without waiting for debounce
  const handleEnter = () => {
    const trimmed = query.trim();
    if (!trimmed) { return; }
    setDebouncedQuery(trimmed);
    saveRecentSearch(trimmed);
    setRecents(getRecentSearches());
  };

  const handleRecentClick = (s: string) => {
    setQuery(s);
    setDebouncedQuery(s);
    saveRecentSearch(s);
    setRecents(getRecentSearches());
  };

  const isSearching = Boolean(debouncedQuery);

  return (
    <div className="sp-page">
      {/* Search bar */}
      <div className="sp-bar">
        <button type="button" className="sp-bar__back" aria-label="Go back" onClick={() => (location.key === 'default' ? navigate('/') : navigate(-1))}>
          <img src={iconArrowLeft} alt="" aria-hidden="true" className="sp-bar__back-icon" />
        </button>
        <div className="sp-bar__field">
          <img src={iconSearch} alt="" aria-hidden="true" className="sp-bar__search-icon" />
          <input
            ref={inputRef}
            type="search"
            className="sp-bar__input"
            placeholder="Search paths and courses"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { handleEnter(); } }}
            aria-label="Search paths and courses"
          />
          {query.length > 0 && (
            <button type="button" className="sp-bar__clear" aria-label="Clear" onClick={handleClear}>
              <img src={iconX} alt="" className="sp-bar__clear-icon" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="sp-body">
        {isSearching ? (
          /* ── Results ── */
          <>
            {(isLoading || isFetching) && (
              <div className="sp-loading" aria-label="Loading…" aria-busy="true">
                <div className="sp-loading__row" aria-hidden="true" />
                <div className="sp-loading__row" aria-hidden="true" />
                <div className="sp-loading__row" aria-hidden="true" />
              </div>
            )}
            {isError && !isFetching && (
              <ErrorView
                title="Could not load results"
                message="We couldn't search right now. Please try again."
                onRetry={() => refetch()}
              />
            )}
            {!isFetching && !isError && (
              <>
                <p className="sp-results-count" aria-live="polite" aria-atomic="true">
                  {totalResults} {totalResults === 1 ? 'result' : 'results'}
                </p>
                {totalResults > 0 ? (
                  <>
                    {curriculumResults.length > 0 && (
                      <section className="sp-section">
                        <h2 className="sp-section-title">Learning paths</h2>
                        <div className="sp-results-list">
                          {curriculumResults.map((curriculum) => (
                            <CurriculumResult
                              key={curriculum.uuid}
                              curriculum={curriculum}
                              onClick={() => navigate(`/learning-path/${curriculum.uuid}`)}
                            />
                          ))}
                        </div>
                      </section>
                    )}
                    {courseResults.length > 0 && (
                      <section className="sp-section">
                        <h2 className="sp-section-title">Courses</h2>
                        <div className="sp-results-list">
                          {courseResults.map((course) => (
                            <CourseResult
                              key={course.course_id}
                              course={course}
                              onClick={() => navigate(`/course/${course.course_id}`)}
                            />
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                ) : (
                  <div className="sp-empty">
                    <div className="sp-empty__spot">
                      <img src={searchNoResults} alt="" className="sp-empty__spot-img" aria-hidden="true" />
                    </div>
                    <div className="sp-empty__text">
                      <p className="sp-empty__title">No results for &ldquo;{debouncedQuery}&rdquo;</p>
                      <p className="sp-empty__sub">Try another word, or browse every course.</p>
                    </div>
                    <div className="sp-empty__actions">
                      <button type="button" className="sp-empty__cta" onClick={() => navigate('/courses')}>
                        See all courses
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          /* ── Pre-search ── */
          recents.length > 0 && (
            <section className="sp-section">
              <h2 className="sp-section-title">Recent</h2>
              <div className="sp-recent-list">
                {recents.map((s) => (
                  <div key={s} className="sp-recent-row">
                    <button
                      type="button"
                      className="sp-recent-row__main"
                      onClick={() => handleRecentClick(s)}
                    >
                      <img src={iconClock} alt="" className="sp-recent-row__clock" aria-hidden="true" />
                      <span className="sp-recent-row__text">{s}</span>
                    </button>
                    <button
                      type="button"
                      className="sp-recent-row__remove"
                      aria-label={`Remove ${s}`}
                      onClick={() => handleRemoveRecent(s)}
                    >
                      <img src={iconX} alt="" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )
        )}
      </div>
    </div>
  );
};
