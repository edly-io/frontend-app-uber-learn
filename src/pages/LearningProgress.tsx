import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getEnrolledCourses, type EnrolledCourse } from '../api/catalog';
import { useCourseOutline } from '../hooks/useCourseOutline';
import { useProgress } from '../hooks/useProgress';
import { mapOutlineToLessons } from '../lib/outline-mapper';
import { getStoredResumeIdx } from '../lib/resume-storage';
import './learning-progress.css';

// ── SVG icons ──────────────────────────────────────────

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

const BadgeCheckIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M14 2L17.09 8.26L24 9.27L19 14.14L20.18 21.02L14 17.77L7.82 21.02L9 14.14L4 9.27L10.91 8.26L14 2Z"
      fill="#15803d"
    />
    <path
      d="M10 14L12.5 16.5L18 11"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ShieldCheckIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M14 3L23 7V14C23 18.97 19.07 23.57 14 25C8.93 23.57 5 18.97 5 14V7L14 3Z"
      fill="#4b4b4b"
    />
    <path
      d="M10 14L12.5 16.5L18 11"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const LockIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <rect x="6" y="12" width="16" height="13" rx="2" fill="#9c9c9c" />
    <path
      d="M10 12V9C10 6.79 11.79 5 14 5C16.21 5 18 6.79 18 9V12"
      stroke="#9c9c9c"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <circle cx="14" cy="18" r="1.5" fill="white" />
  </svg>
);

// ── Tab types ───────────────────────────────────────────

type TabId = 'progress' | 'habit' | 'badges' | 'standing';

const TABS: { id: TabId; label: string }[] = [
  { id: 'progress', label: 'Progress' },
  { id: 'habit', label: 'Habit' },
  { id: 'badges', label: 'Badges' },
  { id: 'standing', label: 'Standing' },
];

// ── Progress tab — connected sub-components ─────────────

const CourseContributionRow = ({ course }: { course: EnrolledCourse }) => {
  const outlineQuery = useCourseOutline(course.courseId);
  const { data: progressData } = useProgress(course.courseId);

  const allLessons = outlineQuery.data ? mapOutlineToLessons(outlineQuery.data) : [];
  const totalLessons = allLessons.length;
  const storedIdx = totalLessons > 0 ? getStoredResumeIdx(course.courseId, allLessons) : -1;
  const completedLessons = storedIdx > 0 ? storedIdx : 0;
  const pointsEarned = progressData?.points?.earned ?? 0;
  const totalActivities = progressData?.totalActivities ?? 0;

  const statusParts = [
    totalLessons > 0 ? `${completedLessons} of ${totalLessons} lessons complete` : null,
    totalActivities > 0 ? `${totalActivities} eligible activities` : null,
  ].filter(Boolean);

  return (
    <div className="lp-contribution-row">
      <div className="lp-contribution-row__body">
        <span className="lp-contribution-row__name">{course.title}</span>
        <span className="lp-contribution-row__status">
          {statusParts.length > 0 ? statusParts.join(' · ') : 'Start course to earn points'}
        </span>
      </div>
      <span className={`lp-contribution-row__points${pointsEarned === 0 ? ' lp-contribution-row__points--empty' : ''}`}>
        {pointsEarned > 0 ? `+${pointsEarned}` : '—'}
      </span>
    </div>
  );
};

const OverallProgressBar = ({ courseId }: { courseId: string }) => {
  const outlineQuery = useCourseOutline(courseId);
  const { data: progressData } = useProgress(courseId);

  const allLessons = outlineQuery.data ? mapOutlineToLessons(outlineQuery.data) : [];
  const totalLessons = allLessons.length;
  const storedIdx = totalLessons > 0 ? getStoredResumeIdx(courseId, allLessons) : -1;
  const completedLessons = storedIdx > 0 ? storedIdx : 0;

  // Prefer activity counts from the API; fall back to lesson counts
  const totalSteps = (progressData?.totalActivities ?? 0) > 0
    ? (progressData?.totalActivities ?? 0) : totalLessons;
  const completedSteps = (progressData?.completedActivities ?? 0) > 0
    ? (progressData?.completedActivities ?? 0) : completedLessons;

  const pct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <div className="lp-progress-section">
      <div className="lp-progress-label-row">
        <span>{`${completedSteps} of ${totalSteps} course steps`}</span>
        <span>{`${pct}%`}</span>
      </div>
      <div
        className="lp-progress-track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="lp-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

// ── Progress tab ────────────────────────────────────────

interface ProgressTabProps {
  courses: EnrolledCourse[];
}

const ProgressTab = ({ courses }: ProgressTabProps) => {
  const firstCourseId = courses[0]?.courseId;

  // Aggregate points across all enrolled courses
  const firstProgress = useProgress(firstCourseId ?? '');
  const totalPoints = firstProgress.data?.points?.earned ?? 0;

  return (
    <div className="lp-panel">
      {/* Points summary */}
      <div className="lp-summary-card">
        <div className="lp-summary-card__body">
          <span className="lp-summary-card__label">Uber Learn points</span>
          <span className="lp-summary-card__sublabel">Across all your courses</span>
        </div>
        <span className="lp-summary-card__value">{totalPoints}</span>
      </div>

      {/* Per-course contributions */}
      {courses.length > 0 && (
        <>
          <h2 className="lp-section-heading">Course contributions</h2>
          <div className="lp-contributions">
            {courses.map((course) => (
              <CourseContributionRow key={course.courseId} course={course} />
            ))}
          </div>
        </>
      )}

      {/* Overall progress bar — driven by first enrolled course */}
      {firstCourseId && <OverallProgressBar courseId={firstCourseId} />}

      <p className="lp-note">
        Points are awarded once per eligible activity. Reading requires Continue,
        videos require full playback, and practice requires a correct answer.
        Resource screens and assessments award no points.
      </p>
    </div>
  );
};

// ── Habit tab ───────────────────────────────────────────

const HabitTab = () => (
  <div className="lp-panel">
    {/* Week streak summary */}
    <div className="lp-summary-card">
      <div className="lp-summary-card__body">
        <span className="lp-summary-card__label">Week streak</span>
        <span className="lp-summary-card__sublabel">Consecutive goal weeks</span>
      </div>
      <span className="lp-summary-card__value">0</span>
    </div>

    {/* Weekly goal card */}
    <div className="lp-weekly-goal">
      <p className="lp-weekly-goal__kicker">This week's goal</p>
      <p className="lp-weekly-goal__title">0 of 2 learning days this week</p>
      <div className="lp-weekly-goal__meter" aria-hidden="true">
        <div className="lp-weekly-goal__day" />
        <div className="lp-weekly-goal__day" />
      </div>
      <p className="lp-weekly-goal__desc">
        Learn on two different days this week to keep your streak.
      </p>
      <p className="lp-weekly-goal__streak">No week streak yet</p>
    </div>

    <p className="lp-note">
      A learning day requires the first completion of an eligible activity. The goal
      is two different days in a Monday–Sunday week. Finishing all available learning
      also meets that week's goal. A week with no eligible learning pauses the streak.
      One missed active week in eight can be forgiven; earned points and badges never
      disappear.
    </p>
  </div>
);

// ── Badges tab ──────────────────────────────────────────

const BadgesTab = () => (
  <div className="lp-panel">
    <p className="lp-note" style={{ paddingBottom: 0 }}>
      Three account-level badges recognise applied practice, course completion, and
      retained knowledge.
    </p>
    <div className="lp-badge-list">
      <div className="lp-badge-row">
        <div className="lp-badge-icon lp-badge-icon--earned">
          <BadgeCheckIcon />
        </div>
        <div className="lp-badge-row__body">
          <span className="lp-badge-row__name lp-badge-row__name--earned">Applied</span>
          <span className="lp-badge-row__desc">Earned across Uber Learn</span>
        </div>
      </div>
      <div className="lp-badge-row">
        <div className="lp-badge-icon lp-badge-icon--locked">
          <ShieldCheckIcon />
        </div>
        <div className="lp-badge-row__body">
          <span className="lp-badge-row__name lp-badge-row__name--locked">Thorough</span>
          <span className="lp-badge-row__desc">Complete an eligible course and its required check</span>
        </div>
      </div>
      <div className="lp-badge-row">
        <div className="lp-badge-icon lp-badge-icon--locked">
          <LockIcon />
        </div>
        <div className="lp-badge-row__body">
          <span className="lp-badge-row__name lp-badge-row__name--locked">Retained</span>
          <span className="lp-badge-row__desc">Pass a check 30 days after course completion</span>
        </div>
      </div>
    </div>
  </div>
);

// ── Standing tab ────────────────────────────────────────

const StandingTab = () => {
  const bands: { label: string; active: boolean }[] = [
    { label: '1–25%', active: false },
    { label: '26–50%', active: true },
    { label: '51–75%', active: false },
    { label: '76–100%', active: false },
  ];

  return (
    <div className="lp-panel">
      <div className="lp-cohort">
        <p className="lp-cohort__kicker">Illustrative cohort · This week</p>
        <h2 className="lp-cohort__heading">Your band: 26–50%</h2>
        <div className="lp-cohort__bands">
          {bands.map(({ label, active }) => (
            <div key={label} className="lp-cohort__band">
              <div className={`lp-cohort__block${active ? ' lp-cohort__block--active' : ''}`}>
                {active && <span className="lp-cohort__you">You</span>}
              </div>
              <span className={`lp-cohort__band-label${active ? ' lp-cohort__band-label--active' : ''}`}>
                {label}
              </span>
            </div>
          ))}
        </div>
        <p className="lp-cohort__note">
          Example cohort of 120 learners. Live comparisons will use approved,
          privacy-safe learner data.
        </p>
      </div>
    </div>
  );
};

// ── Main page ───────────────────────────────────────────

export const LearningProgress = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('progress');

  const { data: courses } = useQuery({
    queryKey: ['enrolled-courses'],
    queryFn: getEnrolledCourses,
    staleTime: 5 * 60_000,
  });

  const firstCourseId = courses?.[0]?.courseId;
  const enrolledCourses = courses ?? [];

  const handleContinue = () => {
    if (firstCourseId) {
      navigate(`/course/${firstCourseId}`);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="lp-page">
      {/* Navigation header */}
      <header className="lp-nav">
        <button
          type="button"
          className="lp-nav__back"
          aria-label="Go back"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft />
        </button>
        <span className="lp-nav__title">Learning progress</span>
      </header>

      {/* Scrollable body */}
      <div className="lp-body">
        {/* Page header */}
        <div className="lp-header">
          <p className="lp-kicker">Across all courses</p>
          <h1 className="lp-title">Learning progress</h1>
          <p className="lp-lead">Points, habits, badges, and standing across your courses.</p>
        </div>

        {/* Tabs */}
        <div className="lp-tabs" role="tablist">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              className={`lp-tab${activeTab === id ? ' lp-tab--active' : ''}`}
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
            >
              <span className="lp-tab__label">{label}</span>
              <span className="lp-tab__bar" />
            </button>
          ))}
        </div>

        {/* Tab panels */}
        {activeTab === 'progress' && <ProgressTab courses={enrolledCourses} />}
        {activeTab === 'habit' && <HabitTab />}
        {activeTab === 'badges' && <BadgesTab />}
        {activeTab === 'standing' && <StandingTab />}
      </div>

      {/* Footer */}
      <footer className="lp-footer">
        <button type="button" className="lp-footer__primary" onClick={handleContinue}>
          Continue course
        </button>
        <button type="button" className="lp-footer__secondary" onClick={() => navigate('/')}>
          Learning home
        </button>
      </footer>
    </div>
  );
};
