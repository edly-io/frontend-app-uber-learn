import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  searchLearnerContent,
  type LearnerCurriculum,
  type SearchCourseResult,
} from '../api/curriculum';
import { qk } from '../api/queries';

import iconClockFilled from '../assets/icons/icon-clock-filled.svg';
import iconDismiss from '../assets/icons/icon-dismiss.svg';
import iconCircleX from '../assets/icons/icon-circle-x.svg';
import courseArtBlue from '../assets/icons/course-art-blue.svg';
import courseArtTeal from '../assets/icons/course-art-teal.svg';

import './search-page.scss';

// ── Recent searches (localStorage) ───────────────────────

const STORAGE_KEY = 'uber-learn-recent-searches';
const MAX_RECENT = 8;

function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  try {
    const list = getRecentSearches().filter((s) => s !== query);
    list.unshift(query);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch { /* ignore */ }
}

function removeRecentSearch(query: string) {
  try {
    const list = getRecentSearches().filter((s) => s !== query);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}

// ── Icons ─────────────────────────────────────────────────

const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const ArrowLeft = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ── Search result components ──────────────────────────────

const CourseResult = ({ course, onClick }: { course: SearchCourseResult; onClick: () => void }) => (
  <button type="button" className="sp-result-row" onClick={onClick}>
    <div className="sp-result-row__art">
      <img src={courseArtBlue} alt="" className="sp-result-row__art-img" aria-hidden="true" />
    </div>
    <div className="sp-result-row__body">
      <span className="sp-result-row__title">{course.display_name}</span>
    </div>
    <ChevronRight />
  </button>
);

const CurriculumResult = ({ curriculum, onClick }: { curriculum: LearnerCurriculum; onClick: () => void }) => (
  <button type="button" className="sp-result-row" onClick={onClick}>
    <div className="sp-result-row__art sp-result-row__art--path">
      <img src={courseArtTeal} alt="" className="sp-result-row__art-img" aria-hidden="true" />
    </div>
    <div className="sp-result-row__body">
      <span className="sp-result-row__title">{curriculum.title}</span>
    </div>
    <ChevronRight />
  </button>
);

// ── Main component ────────────────────────────────────────

export const SearchPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [recents, setRecents] = useState<string[]>(() => getRecentSearches());

  // Fire search 300ms after user stops typing
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setDebouncedQuery('');
      return undefined;
    }
    const timer = setTimeout(() => {
      setDebouncedQuery(trimmed);
      saveRecentSearch(trimmed);
      setRecents(getRecentSearches());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const {
    data, isFetching, isError, refetch,
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
  const isLoading = isFetching;

  return (
    <div className="sp-page">
      {/* Search bar */}
      <div className="sp-bar">
        <button type="button" className="sp-bar__back" aria-label="Go back" onClick={() => (location.key === 'default' ? navigate('/') : navigate(-1))}>
          <ArrowLeft />
        </button>
        <div className="sp-bar__field">
          <SearchIcon />
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
              <img src={iconCircleX} alt="" className="sp-bar__clear-icon" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="sp-body">
        {isSearching ? (
          /* ── Results ── */
          <>
            {isLoading && (
              <div className="sp-loading" aria-label="Loading…" aria-busy="true">
                <div className="sp-loading__row" aria-hidden="true" />
                <div className="sp-loading__row" aria-hidden="true" />
                <div className="sp-loading__row" aria-hidden="true" />
              </div>
            )}
            {isError && !isLoading && (
              <div className="sp-error">
                <p className="sp-error__message">Could not load results</p>
                <button type="button" className="sp-error__retry" onClick={() => refetch()}>
                  Try again
                </button>
              </div>
            )}
            {!isLoading && !isError && (
              <>
                <p className="sp-results-count">
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
                    <p className="sp-empty__title">No results for &ldquo;{debouncedQuery}&rdquo;</p>
                    <p className="sp-empty__sub">Try a different keyword.</p>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          /* ── Pre-search ── */
          <>
            {recents.length > 0 && (
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
                        <img src={iconClockFilled} alt="" className="sp-recent-row__clock" aria-hidden="true" />
                        <span className="sp-recent-row__text">{s}</span>
                      </button>
                      <button
                        type="button"
                        className="sp-recent-row__remove"
                        aria-label={`Remove ${s}`}
                        onClick={() => handleRemoveRecent(s)}
                      >
                        <img src={iconDismiss} alt="" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
};
