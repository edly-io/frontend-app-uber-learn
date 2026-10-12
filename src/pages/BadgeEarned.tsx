import React, { useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markBadgesSeen } from '../api/curriculum';
import { useCurriculums } from '../hooks/useCurriculums';
import { useBadges } from '../hooks/useBadges';
import { qk } from '../api/queries';

import badgeCompleteEarned from '../assets/badges/badge-complete-earned.svg';
import badgeRetainedEarned from '../assets/badges/badge-retained-earned.svg';
import badgeRingTrack from '../assets/icons/badge-ring-track.svg';
import badgeRingEarned from '../assets/icons/badge-ring-earned.svg';

import './badge-earned.scss';

type BadgeType = 'complete' | 'retained';

// Static fallback config used when no API data is available
const FALLBACK: Record<BadgeType, { title: string; desc: string; artSrc: string }> = {
  complete: {
    title: 'Complete',
    desc: "You've finished every required course and its final check.",
    artSrc: badgeCompleteEarned,
  },
  retained: {
    title: 'Retained',
    desc: 'You passed your 30-day check. What you learned stayed with you.',
    artSrc: badgeRetainedEarned,
  },
};

interface NavState {
  awardId?: string;
  alsoEarned?: Array<{ id: string; title: string; imageUrl: string | null }>;
}

export const BadgeEarned = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { type } = useParams<{ type: string }>();
  let badgeType: BadgeType = 'complete';
  if (type === 'retained') { badgeType = 'retained'; }

  const state = (location.state as NavState | null) ?? {};
  const { awardId, alsoEarned = [] } = state;

  const { data: curriculums } = useCurriculums();
  const { data: badgesData } = useBadges();

  // Prefer the exact award from nav state; fall back to first curriculum that reached this slot.
  const award = awardId
    ? [...(badgesData?.curriculum_badges ?? []), ...(badgesData?.course_badges ?? [])].find((b) => b.id === awardId)
    : undefined;
  const awardCurriculumUuid = award?.source.type === 'curriculum'
    ? (award.source as Extract<typeof award.source, { type: 'curriculum' }>).curriculum.uuid
    : null;
  const owningCurriculum = awardCurriculumUuid
    ? curriculums?.find((c) => c.uuid === awardCurriculumUuid)
    : curriculums?.find((c) => c.milestones[badgeType].reached_at !== null);
  const milestone = owningCurriculum?.milestones[badgeType];

  const fallback = FALLBACK[badgeType];
  const badge = award?.badge ?? milestone?.badge ?? null;
  const title = badge?.title ?? fallback.title;
  const description = badge?.description ?? fallback.desc;
  const artSrc = badge?.image_url ?? fallback.artSrc;
  const earnedAt = award?.awarded_at ?? milestone?.reached_at ?? null;
  const earnedDate = earnedAt
    ? new Date(earnedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const { mutate: markSeen } = useMutation({
    mutationFn: (ids: string[]) => markBadgesSeen(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['curriculum', 'badges'] });
      queryClient.invalidateQueries({ queryKey: qk.curriculums() });
    },
  });

  useEffect(() => {
    if (awardId) {
      markSeen([awardId, ...alsoEarned.map((b) => b.id)]);
    }
  }, [awardId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="badge-earned-page">
      {/* White art panel with badge ring (new Figma 2026-10-10 style) */}
      <div className="badge-earned__white-panel" aria-hidden="true">
        <div className="badge-earned__ring">
          <img src={badgeRingTrack} alt="" aria-hidden="true" className="badge-earned__ring-track" />
          <img src={badgeRingEarned} alt="" aria-hidden="true" className="badge-earned__ring-fill" />
          <div className="badge-earned__seal">
            <img src={artSrc} alt="" className="badge-earned__seal-img" />
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="badge-earned__content">
        <div className="badge-earned__words">
          <p className="badge-earned__kicker">Badge earned</p>
          <h1 className="badge-earned__title">{title}</h1>
          <p className="badge-earned__desc">{description}</p>
          {earnedDate && (
            <p className="badge-earned__date">Earned {earnedDate}</p>
          )}
        </div>

        {/* Also earned */}
        {alsoEarned.length > 0 && (
          <div className="badge-earned__also-wrap">
            {alsoEarned.map((alsoBadge) => (
              <div key={alsoBadge.id} className="badge-earned__also-card">
                <div className="badge-earned__also-art">
                  <img
                    src={alsoBadge.imageUrl ?? badgeCompleteEarned}
                    alt=""
                    className="badge-earned__also-img"
                    aria-hidden="true"
                  />
                </div>
                <p className="badge-earned__also-text">
                  Also earned: the <strong>{alsoBadge.title}</strong> badge
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="badge-earned__footer">
        <button type="button" className="btn-primary" onClick={() => navigate('/')}>
          Continue
        </button>
        <button
          type="button"
          className="btn-tertiary"
          onClick={() => navigate('/progress', { state: { tab: 'Badges' } })}
        >
          See your badges
        </button>
      </footer>
    </div>
  );
};
