import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { NavHeader } from '../components/nav-header/NavHeader';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorView } from '../components/ui/ErrorView';
import { useCurriculums } from '../hooks/useCurriculums';
import { useGamification } from '../hooks/useGamification';
import { useCourseProgressSummary } from '../hooks/useCourseProgressSummary';
import { qk } from '../api/queries';
import type { BadgeSlot, Milestone } from '../api/curriculum';

// ---------------------------------------------------------------------------
// Badge definitions
// ---------------------------------------------------------------------------

const BADGE_SLOTS: BadgeSlot[] = ['complete', 'retained'];

const BADGE_LABELS: Record<BadgeSlot, string> = {
  complete: 'Complete',
  retained: 'Retained',
};

const BADGE_DESCRIPTIONS: Record<BadgeSlot, string> = {
  complete: 'Finished every course in your path',
  retained: 'Passed your 30-day retention check',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pluralWeeks(n: number): string {
  return `${n} ${n === 1 ? 'week' : 'weeks'}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface BadgeCardProps {
  slot: BadgeSlot;
  milestone: Milestone;
}

function getBadgeIcon(earned: boolean, imageUrl: string | undefined | null): React.ReactNode {
  if (earned && imageUrl) {
    return <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  }
  if (earned) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M5 12L9.5 16.5L19 7" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="6" stroke="#ffffff" strokeWidth="2" />
      <path d="M12 9V12" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="15" r="0.5" fill="#ffffff" />
    </svg>
  );
}

const BadgeCard = ({ slot, milestone }: BadgeCardProps) => {
  const earned = milestone.reached_at !== null;
  const label = milestone.badge?.title ?? BADGE_LABELS[slot];
  const description = milestone.badge?.description ?? BADGE_DESCRIPTIONS[slot];
  const dateStr = milestone.reached_at
    ? new Date(milestone.reached_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '1rem 0.75rem',
        borderRadius: '12px',
        border: `1.5px solid ${earned ? 'var(--u-mastery)' : 'var(--u-border-opaque)'}`,
        background: earned ? 'var(--u-mastery-light)' : 'var(--u-background-state-disabled)',
        opacity: earned ? 1 : 0.6,
        textAlign: 'center',
        flex: '1 1 0',
        minWidth: 0,
      }}
      aria-label={`${label} badge — ${earned ? 'earned' : 'not yet earned'}`}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: earned ? 'var(--u-mastery)' : 'var(--u-content-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
        aria-hidden="true"
      >
        {getBadgeIcon(earned, milestone.badge?.image_url)}
      </div>
      <span style={{
        fontFamily: 'var(--u-font-body)', fontWeight: 600, fontSize: '0.875rem', color: earned ? 'var(--u-mastery)' : 'var(--u-content-secondary)',
      }}
      >
        {label}
      </span>
      <span style={{
        fontFamily: 'var(--u-font-body)', fontSize: '0.75rem', color: 'var(--u-content-secondary)', lineHeight: 1.3,
      }}
      >
        {description}
      </span>
      {earned && dateStr && (
        <span style={{ fontFamily: 'var(--u-font-body)', fontSize: '0.6875rem', color: 'var(--u-mastery)' }}>
          {dateStr}
        </span>
      )}
    </div>
  );
};

interface StatRowProps {
  label: string;
  value: string;
}

const StatRow = ({ label, value }: StatRowProps) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem 0', borderBottom: '1px solid var(--u-border-opaque)',
  }}
  >
    <span style={{ fontFamily: 'var(--u-font-body)', fontSize: '0.9375rem', color: 'var(--u-content-secondary)' }}>
      {label}
    </span>
    <span style={{
      fontFamily: 'var(--u-font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--u-content-primary)',
    }}
    >
      {value}
    </span>
  </div>
);

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export const RewardsView = () => {
  const { courseId = '' } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: curriculums, isLoading: curriculumsLoading, isError: curriculumsError } = useCurriculums();
  const { data: gamification, isLoading: gamificationLoading, isError: gamificationError } = useGamification();
  const { data: progress, isLoading: progressLoading } = useCourseProgressSummary(courseId);

  const isLoading = curriculumsLoading || gamificationLoading || progressLoading;

  // Find the curriculum this course belongs to (may be null for standalone courses)
  const curriculum = curriculums?.find((c) => c.courses.some((course) => course.course_id === courseId));

  const milestones = curriculum?.milestones ?? {
    complete: { reached_at: null, badge: null },
    retained: { reached_at: null, badge: null },
  };

  const isCourseComplete = (progress?.completedUnits ?? 0) > 0
    && progress?.completedUnits === progress?.totalUnits;

  const coursePoints = gamification?.courses.find((c) => c.course_key === courseId)?.points ?? 0;
  const completedUnits = progress?.completedUnits ?? 0;
  const totalUnits = progress?.totalUnits ?? 0;
  const currentStreakWeeks = gamification?.current_streak_weeks ?? 0;
  const longestStreakWeeks = gamification?.longest_streak_weeks ?? 0;

  const handleCriticalRetry = () => {
    queryClient.invalidateQueries({ queryKey: qk.curriculums() });
    queryClient.invalidateQueries({ queryKey: qk.gamification() });
  };

  if (!isLoading && (curriculumsError || gamificationError)) {
    return (
      <ErrorView
        title="Could not load rewards"
        message="We could not load your badges and progress. Please try again."
        onRetry={handleCriticalRetry}
        navTitle="Your Rewards"
        onBack={() => navigate(`/course/${courseId}`)}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <NavHeader
        title="Your Rewards"
        onBack={() => navigate(`/course/${courseId}`)}
      />

      <main style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <>
            {/* Course complete banner */}
            {isCourseComplete && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                margin: 'var(--u-page-gutter)',
                padding: '1rem',
                background: 'var(--u-mastery-light)',
                borderRadius: '12px',
                border: '1.5px solid var(--u-mastery)',
              }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="12" fill="var(--u-mastery)" />
                  <path d="M6 12L10 16L18 8" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontFamily: 'var(--u-font-body)', fontWeight: 600, color: 'var(--u-mastery)' }}>
                  Course complete!
                </span>
              </div>
            )}

            {/* Badge collection */}
            <section aria-labelledby="badges-heading" style={{ padding: 'var(--u-page-gutter)' }}>
              <h2
                id="badges-heading"
                style={{
                  fontFamily: 'var(--u-font-display)', fontSize: '1.125rem', marginBottom: '1rem', color: 'var(--u-content-primary)',
                }}
              >
                Badges
              </h2>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {BADGE_SLOTS.map((slot) => (
                  <BadgeCard key={slot} slot={slot} milestone={milestones[slot]} />
                ))}
              </div>
            </section>

            {/* Stats */}
            <section aria-labelledby="stats-heading" style={{ padding: 'var(--u-page-gutter)' }}>
              <h2
                id="stats-heading"
                style={{
                  fontFamily: 'var(--u-font-display)', fontSize: '1.125rem', marginBottom: '0.25rem', color: 'var(--u-content-primary)',
                }}
              >
                Progress
              </h2>

              <StatRow label="Points earned" value={String(coursePoints)} />
              <StatRow label="Activities completed" value={totalUnits > 0 ? `${completedUnits} / ${totalUnits}` : '—'} />
              <StatRow label="Current streak" value={pluralWeeks(currentStreakWeeks)} />
              <StatRow label="Longest streak" value={pluralWeeks(longestStreakWeeks)} />
            </section>

            {/* Back to course */}
            <div style={{ padding: 'var(--u-page-gutter)', paddingTop: 0 }}>
              <button
                type="button"
                onClick={() => navigate(`/course/${courseId}`)}
                style={{
                  width: '100%',
                  height: '52px',
                  background: 'var(--u-background-always-dark)',
                  color: 'var(--u-content-on-color)',
                  border: 'none',
                  borderRadius: '8px',
                  fontFamily: 'var(--u-font-body)',
                  fontWeight: 500,
                  fontSize: '16px',
                  cursor: 'pointer',
                  minWidth: '44px',
                }}
              >
                Back to course
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
};
