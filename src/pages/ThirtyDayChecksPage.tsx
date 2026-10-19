import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurriculums } from '../hooks/useCurriculums';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorView } from '../components/ui/ErrorView';
import type { LearnerCurriculum } from '../api/curriculum';
import { getCourseArt } from '../lib/courseArt';
import iconArrowLeft from '../assets/icons/icon-arrow-left.svg';
import iconBadgeCheck from '../assets/icons/icon-badge-check.svg';
import iconChevronRight from '../assets/icons/chevron-right.svg';
import iconTrophyPin from '../assets/icons/icon-trophy-pin.svg';
import badgeArtTrophyEarned from '../assets/icons/badge-art-trophy-earned.svg';
import './thirty-day-checks.scss';

// ── Types ──────────────────────────────────────────────────

type CheckState = 'open' | 'coming-up' | 'passed';

function getCheckState(c: LearnerCurriculum): CheckState {
  if (c.milestones.retained?.reached_at != null) { return 'passed'; }
  if (c.knowledge_check.is_open) { return 'open'; }
  return 'coming-up';
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function getSubtitles(c: LearnerCurriculum, state: CheckState): [string | null, string | null] {
  const kc = c.knowledge_check;

  if (state === 'passed') {
    const passedDate = c.milestones.retained!.reached_at!;
    return [`Passed ${fmtDate(passedDate)}`, null];
  }

  if (state === 'open') {
    const qCount = kc.question_count ?? null;
    const threshold = kc.pass_threshold ?? null;
    const sub1 = qCount != null ? `${qCount} question${qCount !== 1 ? 's' : ''}` : null;
    const sub2 = threshold != null ? `Get ${threshold} right to earn the trophy` : null;
    return [sub1, sub2];
  }

  // Coming up — path not fully done yet
  if (c.courses_finished < c.courses_total) {
    return [
      `${c.courses_finished} of ${c.courses_total} courses done`,
      'Opens 30 days after you finish',
    ];
  }

  // Coming up — path done, waiting for 30-day window
  const opensDate = kc.unlocks_at ? `Opens ${fmtDate(kc.unlocks_at)}` : null;
  const pathFinishedDate = kc.unlocks_at
    ? `Path finished ${fmtDate(new Date(new Date(kc.unlocks_at).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString())}`
    : null;
  return [opensDate, pathFinishedDate];
}

// ── Ring SVG ───────────────────────────────────────────────

interface CheckRingProps {
  curriculum: LearnerCurriculum;
  state: CheckState;
}

const RING_SIZE = 56;
const RING_SW = 3;

const CheckRing = ({ curriculum, state }: CheckRingProps) => {
  const cx = RING_SIZE / 2;
  const r = cx - RING_SW / 2;
  const circ = 2 * Math.PI * r;
  const fraction = curriculum.courses_total > 0
    ? Math.min(1, curriculum.courses_finished / curriculum.courses_total)
    : 0;
  const offset = circ * (1 - fraction);

  // Use deterministic course art keyed on the first course, falling back to curriculum uuid
  const sealId = curriculum.courses[0]?.course_id ?? curriculum.uuid;
  const { artSrc, tint } = getCourseArt(sealId);

  const isGreyed = state === 'coming-up';
  const isPassed = state === 'passed';

  return (
    <div className="tdc-ring" aria-hidden="true">
      <svg viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} fill="none" className="tdc-ring__svg">
        <circle
          cx={cx}
          cy={cx}
          r={r}
          stroke="var(--u-border-opaque)"
          strokeWidth={RING_SW}
        />
        {fraction > 0 && (
          <circle
            cx={cx}
            cy={cx}
            r={r}
            stroke="var(--u-background-accent)"
            strokeWidth={RING_SW}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${cx} ${cx})`}
          />
        )}
      </svg>
      <div
        className={`tdc-ring__seal${isGreyed ? ' tdc-ring__seal--greyed' : ''}`}
        style={{ background: `var(--u-learning-course-tint-${tint})` }}
      >
        <img
          src={artSrc}
          alt=""
          className="tdc-ring__art"
          onError={(e) => { e.currentTarget.src = iconBadgeCheck; }}
        />
      </div>
      <div className={`tdc-ring__trophy-pin${isPassed ? ' tdc-ring__trophy-pin--earned' : ''}`}>
        <img
          src={isPassed ? badgeArtTrophyEarned : iconTrophyPin}
          alt=""
          className="tdc-ring__trophy-icon"
        />
      </div>
    </div>
  );
};

// ── Check card ─────────────────────────────────────────────

interface CheckCardProps {
  curriculum: LearnerCurriculum;
  state: CheckState;
  onClick: () => void;
}

const CHECK_STATE_LABEL: Record<CheckState, string> = {
  open: 'open now',
  passed: 'passed',
  'coming-up': 'coming up',
};

const CheckCard = ({ curriculum, state, onClick }: CheckCardProps) => {
  const [line1, line2] = getSubtitles(curriculum, state);

  return (
    <button
      type="button"
      className="tdc-card"
      onClick={onClick}
      aria-label={`${curriculum.title} — ${CHECK_STATE_LABEL[state]}`}
    >
      <CheckRing curriculum={curriculum} state={state} />
      <div className="tdc-card__body">
        <span className="tdc-card__title">{curriculum.title}</span>
        {(line1 || line2) && (
          <div className="tdc-card__meta">
            {line1 && <span className="tdc-card__sub">{line1}</span>}
            {line2 && <span className="tdc-card__sub tdc-card__sub--tertiary">{line2}</span>}
          </div>
        )}
      </div>
      <img src={iconChevronRight} alt="" className="tdc-card__chevron" aria-hidden="true" />
    </button>
  );
};

// ── Section ────────────────────────────────────────────────

function pluralise(n: number): string {
  return n === 1 ? '1 check' : `${n} checks`;
}

interface CheckSectionProps {
  heading: string;
  count: number;
  children: React.ReactNode;
}

const CheckSection = ({ heading, count, children }: CheckSectionProps) => (
  <section className="tdc-section">
    <div className="tdc-section__header">
      <h2 className="tdc-section__title">{heading}</h2>
      <span className="tdc-section__count">{pluralise(count)}</span>
    </div>
    <div className="tdc-section__list">{children}</div>
  </section>
);

// ── Page ───────────────────────────────────────────────────

export const ThirtyDayChecksPage = () => {
  const navigate = useNavigate();
  const {
    data: curriculums,
    isLoading,
    isError,
    refetch,
  } = useCurriculums();

  const checks = (curriculums ?? []).filter((c) => c.knowledge_check.exists);
  const openChecks = checks.filter((c) => getCheckState(c) === 'open');
  const comingUpChecks = checks.filter((c) => getCheckState(c) === 'coming-up');
  const passedChecks = checks.filter((c) => getCheckState(c) === 'passed');

  const handleCardClick = (c: LearnerCurriculum, state: CheckState) => {
    const origin = '/30-day-checks';
    if (state === 'open' && c.knowledge_check.course_id) {
      navigate(`/course/${c.knowledge_check.course_id}`, { state: { origin } });
    } else if (state === 'coming-up' && c.knowledge_check.course_id) {
      navigate(`/course/${c.knowledge_check.course_id}/retention`, { state: { origin } });
    } else {
      navigate(`/learning-path/${c.uuid}`, { state: { origin } });
    }
  };

  return (
    <div className="tdc-page">
      <header className="tdc-nav" aria-label="30-day checks navigation">
        <button
          type="button"
          className="tdc-nav__back"
          aria-label="Back to learning home"
          onClick={() => navigate('/')}
        >
          <img src={iconArrowLeft} alt="" aria-hidden="true" className="tdc-nav__back-icon" />
        </button>
      </header>

      <div className="tdc-hero">
        <h1 className="tdc-hero__title">30-day checks</h1>
        <p className="tdc-hero__desc">A short check 30 days after you finish a learning path.</p>
      </div>

      <main className="tdc-content">
        {isLoading && <LoadingSkeleton />}
        {isError && (
          <ErrorView
            title="Could not load checks"
            message="Please try again."
            onRetry={() => refetch()}
          />
        )}

        {!isLoading && !isError && (
          <>
            {openChecks.length > 0 && (
              <CheckSection heading="Open now" count={openChecks.length}>
                {openChecks.map((c) => (
                  <CheckCard
                    key={c.uuid}
                    curriculum={c}
                    state="open"
                    onClick={() => handleCardClick(c, 'open')}
                  />
                ))}
              </CheckSection>
            )}
            {comingUpChecks.length > 0 && (
              <CheckSection heading="Coming up" count={comingUpChecks.length}>
                {comingUpChecks.map((c) => (
                  <CheckCard
                    key={c.uuid}
                    curriculum={c}
                    state="coming-up"
                    onClick={() => handleCardClick(c, 'coming-up')}
                  />
                ))}
              </CheckSection>
            )}
            {passedChecks.length > 0 && (
              <CheckSection heading="Passed" count={passedChecks.length}>
                {passedChecks.map((c) => (
                  <CheckCard
                    key={c.uuid}
                    curriculum={c}
                    state="passed"
                    onClick={() => handleCardClick(c, 'passed')}
                  />
                ))}
              </CheckSection>
            )}
            {checks.length === 0 && (
              <p className="tdc-empty">No 30-day checks yet. Finish a learning path to unlock yours.</p>
            )}
          </>
        )}
      </main>

      <footer className="tdc-footer">
        <button type="button" className="btn-primary" onClick={() => navigate('/')}>
          Back to learning home
        </button>
      </footer>
    </div>
  );
};
