import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { NavHeader } from '../components/nav-header/NavHeader';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

// ---------------------------------------------------------------------------
// Badge definitions
// ---------------------------------------------------------------------------

const BADGE_TYPES = ['applied', 'thorough', 'retained'] as const;
type BadgeType = typeof BADGE_TYPES[number];

const BADGE_LABELS: Record<BadgeType, string> = {
  applied: 'Applied',
  thorough: 'Thorough',
  retained: 'Retained',
};

const BADGE_DESCRIPTIONS: Record<BadgeType, string> = {
  applied: 'Completed baseline assessment',
  thorough: 'Passed the final assessment',
  retained: 'Passed the retention check',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPoints(value: number | null): string {
  return value !== null ? String(value) : '—';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface BadgeCardProps {
  badgeType: BadgeType;
  earned: boolean;
  awardedAt?: string;
}

const BadgeCard = ({ badgeType, earned, awardedAt }: BadgeCardProps) => {
  const label = BADGE_LABELS[badgeType];
  const description = BADGE_DESCRIPTIONS[badgeType];
  const dateStr = awardedAt
    ? new Date(awardedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
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
      {/* Badge icon circle */}
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: earned ? 'var(--u-mastery)' : 'var(--u-content-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-hidden="true"
      >
        {earned ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12L9.5 16.5L19 7"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="6" stroke="#ffffff" strokeWidth="2" />
            <path d="M12 9V12" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="15" r="0.5" fill="#ffffff" />
          </svg>
        )}
      </div>
      <span style={{
        fontFamily: 'var(--u-font-body)',
        fontWeight: 600,
        fontSize: '0.875rem',
        color: earned ? 'var(--u-mastery)' : 'var(--u-content-secondary)',
      }}
      >
        {label}
      </span>
      <span style={{
        fontFamily: 'var(--u-font-body)',
        fontSize: '0.75rem',
        color: 'var(--u-content-secondary)',
        lineHeight: 1.3,
      }}
      >
        {description}
      </span>
      {earned && dateStr && (
        <span style={{
          fontFamily: 'var(--u-font-body)',
          fontSize: '0.6875rem',
          color: 'var(--u-mastery)',
        }}
        >
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
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.875rem 0',
    borderBottom: '1px solid var(--u-border-opaque)',
  }}
  >
    <span style={{
      fontFamily: 'var(--u-font-body)',
      fontSize: '0.9375rem',
      color: 'var(--u-content-secondary)',
    }}
    >
      {label}
    </span>
    <span style={{
      fontFamily: 'var(--u-font-display)',
      fontSize: '1rem',
      fontWeight: 700,
      color: 'var(--u-content-primary)',
    }}
    >
      {value}
    </span>
  </div>
);

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

/**
 * RewardsView — displays course completion summary.
 * Shows badge collection, points, activities, and streak data
 * from the GET /progress response.
 */
export const RewardsView = () => {
  const { courseId = '' } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const isLoading = false;
  const earnedBadgeTypes = new Set<string>();
  const badgeMap: Record<string, string> = {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <NavHeader
        title="Your Rewards"
        onBack={() => navigate(`/course/${courseId}`)}
      />

      <main style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          <LoadingSkeleton lines={6} />
        ) : (
          <>
            {/* Course complete banner */}
            {false && (
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
                {/* Completion checkmark — RULE-002: mastery green ONLY for checkmarks */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="12" fill="var(--u-mastery)" />
                  <path
                    d="M6 12L10 16L18 8"
                    stroke="#ffffff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span style={{
                  fontFamily: 'var(--u-font-body)',
                  fontWeight: 600,
                  color: 'var(--u-mastery)',
                }}
                >
                  Course complete!
                </span>
              </div>
            )}

            {/* Badge collection */}
            <section aria-labelledby="badges-heading" style={{ padding: 'var(--u-page-gutter)' }}>
              <h2
                id="badges-heading"
                style={{
                  fontFamily: 'var(--u-font-display)',
                  fontSize: '1.125rem',
                  marginBottom: '1rem',
                  color: 'var(--u-content-primary)',
                }}
              >
                Badges
              </h2>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {BADGE_TYPES.map((badgeType) => (
                  <BadgeCard
                    key={badgeType}
                    badgeType={badgeType}
                    earned={earnedBadgeTypes.has(badgeType)}
                    awardedAt={badgeMap[badgeType]}
                  />
                ))}
              </div>
            </section>

            {/* Stats */}
            <section aria-labelledby="stats-heading" style={{ padding: 'var(--u-page-gutter)' }}>
              <h2
                id="stats-heading"
                style={{
                  fontFamily: 'var(--u-font-display)',
                  fontSize: '1.125rem',
                  marginBottom: '0.25rem',
                  color: 'var(--u-content-primary)',
                }}
              >
                Progress
              </h2>

              <StatRow
                label="Points earned"
                value={`${formatPoints(null)} / ${formatPoints(null)}`}
              />
              <StatRow label="Activities completed" value="0 / 0" />
              <StatRow label="Current streak" value="0 days" />
              <StatRow label="Longest streak" value="0 days" />
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
