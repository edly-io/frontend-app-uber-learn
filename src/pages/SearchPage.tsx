import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getEnrolledCourses, type EnrolledCourse } from '../api/catalog';

import iconClockFilled from '../assets/icons/icon-clock-filled.svg';
import iconDismiss from '../assets/icons/icon-dismiss.svg';
import iconCircleX from '../assets/icons/icon-circle-x.svg';
import courseArtBlue from '../assets/icons/course-art-blue.svg';

import './search-page.css';

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

// ── Topics ────────────────────────────────────────────────

const TOPICS = ['Safety', 'Driving', 'Riders', 'Vehicle', 'Basics'];

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

// ── Search logic ──────────────────────────────────────────

function searchCourses(courses: EnrolledCourse[], query: string) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return courses.filter(
    (c) => c.title.toLowerCase().includes(q),
  );
}

// ── Search result components ──────────────────────────────

const CourseResult = ({ course, onClick }: { course: EnrolledCourse; onClick: () => void }) => (
  <button type="button" className="sp-result-row" onClick={onClick}>
    <div className="sp-result-row__art">
      <img src={courseArtBlue} alt="" className="sp-result-row__art-img" aria-hidden="true" />
    </div>
    <div className="sp-result-row__body">
      <span className="sp-result-row__title">{course.title}</span>
    </div>
    <ChevronRight />
  </button>
);

// ── Main component ────────────────────────────────────────

export const SearchPage = () => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [recents, setRecents] = useState<string[]>(() => getRecentSearches());

  const { data: courses = [] } = useQuery({
    queryKey: ['enrolled-courses'],
    queryFn: getEnrolledCourses,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = submitted ? searchCourses(courses, submitted) : [];

  const handleSubmit = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    saveRecentSearch(trimmed);
    setRecents(getRecentSearches());
    setQuery(trimmed);
    setSubmitted(trimmed);
  };

  const handleClear = () => {
    setQuery('');
    setSubmitted('');
    inputRef.current?.focus();
  };

  const handleRemoveRecent = (s: string) => {
    removeRecentSearch(s);
    setRecents(getRecentSearches());
  };

  const handleRecentClick = (s: string) => {
    setQuery(s);
    handleSubmit(s);
  };

  const handleTopicClick = (topic: string) => {
    setQuery(topic);
    handleSubmit(topic);
  };

  const isSearching = submitted.length > 0;

  return (
    <div className="sp-page">
      {/* Search bar */}
      <div className="sp-bar">
        <button type="button" className="sp-bar__back" aria-label="Go back" onClick={() => navigate(-1)}>
          <ArrowLeft />
        </button>
        <div className="sp-bar__field">
          <SearchIcon />
          <input
            ref={inputRef}
            type="search"
            className="sp-bar__input"
            placeholder="Search courses and lessons"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(query); }}
            aria-label="Search courses and lessons"
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
            <p className="sp-results-count">
              {results.length} {results.length === 1 ? 'result' : 'results'}
            </p>
            {results.length > 0 ? (
              <>
                <h2 className="sp-section-title">Courses</h2>
                <div className="sp-results-list">
                  {results.map((course) => (
                    <CourseResult
                      key={course.courseId}
                      course={course}
                      onClick={() => navigate(`/course/${course.courseId}`)}
                    />
                  ))}
                </div>
              </>
            ) : (
              /* ── No results ── */
              <div className="sp-empty">
                <p className="sp-empty__title">No results for "{submitted}"</p>
                <p className="sp-empty__sub">Try a different keyword or browse topics below.</p>
                <div className="sp-topics">
                  {TOPICS.map((t) => (
                    <button key={t} type="button" className="sp-topic-chip" onClick={() => handleTopicClick(t)}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
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

            <section className="sp-section">
              <h2 className="sp-section-title">Topics</h2>
              <div className="sp-topics">
                {TOPICS.map((t) => (
                  <button key={t} type="button" className="sp-topic-chip" onClick={() => handleTopicClick(t)}>
                    {t}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};
