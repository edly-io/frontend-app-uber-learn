import React, { useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markBadgesSeen } from '../api/curriculum';
import { qk } from '../api/queries';

import badgeHalfwayEarned from '../assets/badges/badge-halfway-earned.svg';
import badgeCompleteEarned from '../assets/badges/badge-complete-earned.svg';
import badgeRetainedEarned from '../assets/badges/badge-retained-earned.svg';

import './badge-earned.scss';

type BadgeType = 'halfway' | 'complete' | 'retained';

// Static fallback config used when no API data is available
const FALLBACK: Record<BadgeType, { title: string; desc: string; artSrc: string }> = {
  halfway: {
    title: 'Road ready',
    desc: "You've finished every course in your path. Your 30-day check opens soon.",
    artSrc: badgeHalfwayEarned,
  },
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
  badgeTitle?: string;
  badgeDescription?: string;
  badgeImageUrl?: string | null;
  earnedAt?: string;
  alsoEarned?: Array<{ id: string; title: string; imageUrl: string | null }>;
}

export const BadgeEarned = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { type } = useParams<{ type: string }>();
  const badgeType: BadgeType =
    type === 'halfway' ? 'halfway' : type === 'retained' ? 'retained' : 'complete';

  const state = (location.state as NavState | null) ?? {};
  const awardId = state.awardId;
  const fallback = FALLBACK[badgeType];

  const title = state.badgeTitle ?? fallback.title;
  const description = state.badgeDescription ?? fallback.desc;
  const artSrc = state.badgeImageUrl ?? fallback.artSrc;
  const earnedDate = state.earnedAt
    ? new Date(state.earnedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const alsoEarned = state.alsoEarned ?? [];

  const { mutate: markSeen } = useMutation({
    mutationFn: (ids: string[]) => markBadgesSeen(ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.badges(true) });
      void queryClient.invalidateQueries({ queryKey: qk.curriculums() });
    },
  });

  useEffect(() => {
    if (awardId) {
      markSeen([awardId]);
    }
  }, [awardId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="badge-earned-page">
      {/* Art panel — always accent blue */}
      <div className="badge-earned__art-panel badge-earned__art-panel--halfway" aria-hidden="true">
        <div className="badge-earned__halo">
          <div className="badge-earned__disc">
            <img src={artSrc} alt="" className="badge-earned__art-img" />
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
            {alsoEarned.map((badge) => (
              <div key={badge.id} className="badge-earned__also-card">
                <div className="badge-earned__also-art">
                  <img
                    src={badge.imageUrl ?? badgeHalfwayEarned}
                    alt=""
                    className="badge-earned__also-img"
                    aria-hidden="true"
                  />
                </div>
                <p className="badge-earned__also-text">
                  Also earned: the <strong>{badge.title}</strong> badge
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
