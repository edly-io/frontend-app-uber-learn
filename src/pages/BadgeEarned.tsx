import React, { useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markBadgesSeen } from '../api/curriculum';
import { qk } from '../api/queries';

import badgeHalfwayEarned from '../assets/badges/badge-halfway-earned.svg';
import badgeCompleteEarned from '../assets/badges/badge-complete-earned.svg';
import badgeCompleteLocked from '../assets/badges/badge-complete-locked.svg';
import badgeRetainedEarned from '../assets/badges/badge-retained-earned.svg';
import badgeRetainedLocked from '../assets/badges/badge-retained-locked.svg';
import badgeArtComplete from '../assets/badges/badge-art-complete.svg';
import badgeArtRetained from '../assets/badges/badge-art-retained.svg';
import courseArtBlue from '../assets/icons/course-art-blue.svg';

import './badge-earned.css';

type BadgeType = 'halfway' | 'complete' | 'retained';

interface BadgeConfig {
  panelClass: string;
  artSrc: string;
  title: string;
  desc: string;
  date: string;
  showSeal: boolean;
  trioFirst: { src: string; locked: boolean };
  trioSecond: { src: string; locked: boolean };
  trioThird: { src: string; locked: boolean };
  trioCaption: string;
}

const BADGE_CONFIGS: Record<BadgeType, BadgeConfig> = {
  halfway: {
    panelClass: 'badge-earned__art-panel--halfway',
    artSrc: badgeHalfwayEarned,
    title: 'Halfway',
    desc: "You've finished half of your required lessons. Keep going at your own pace.",
    date: 'Earned 26 October 2026',
    showSeal: true,
    trioFirst: { src: badgeHalfwayEarned, locked: false },
    trioSecond: { src: badgeCompleteLocked, locked: true },
    trioThird: { src: badgeRetainedLocked, locked: true },
    trioCaption: '1 of 3 badges for your required courses',
  },
  complete: {
    panelClass: 'badge-earned__art-panel--complete',
    artSrc: badgeArtComplete,
    title: 'Complete',
    desc: "You've finished every required course and its final check.",
    date: 'Earned 4 November 2026',
    showSeal: false,
    trioFirst: { src: badgeHalfwayEarned, locked: false },
    trioSecond: { src: badgeCompleteEarned, locked: false },
    trioThird: { src: badgeRetainedLocked, locked: true },
    trioCaption: '2 of 3 badges for your required courses',
  },
  retained: {
    panelClass: 'badge-earned__art-panel--retained',
    artSrc: badgeArtRetained,
    title: 'Retained',
    desc: 'You passed your 30-day check. What you learned stayed with you.',
    date: 'Earned 4 December 2026',
    showSeal: false,
    trioFirst: { src: badgeHalfwayEarned, locked: false },
    trioSecond: { src: badgeCompleteEarned, locked: false },
    trioThird: { src: badgeRetainedEarned, locked: false },
    trioCaption: '3 of 3 badges for your required courses',
  },
};

export const BadgeEarned = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { type } = useParams<{ type: string }>();
  const badgeType: BadgeType =
    type === 'halfway' ? 'halfway' : type === 'retained' ? 'retained' : 'complete';
  const config = BADGE_CONFIGS[badgeType];

  const awardId: string | undefined = (location.state as { awardId?: string } | null)?.awardId;

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
      {/* Art panel */}
      <div className={`badge-earned__art-panel ${config.panelClass}`} aria-hidden="true">
        <div className="badge-earned__halo">
          <div className="badge-earned__disc">
            <img src={config.artSrc} alt="" className="badge-earned__art-img" />
          </div>
        </div>
        {config.showSeal && (
          <div className="badge-earned__seal">
            <img src={courseArtBlue} alt="" className="badge-earned__seal-art" />
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div className="badge-earned__content">
        {/* Words */}
        <div className="badge-earned__words">
          <p className="badge-earned__kicker">Badge earned</p>
          <h1 className="badge-earned__title">{config.title}</h1>
          <p className="badge-earned__desc">{config.desc}</p>
          <p className="badge-earned__date">{config.date}</p>
        </div>

        {/* Badge trio summary */}
        <div className="badge-earned__trio-wrap">
          <div className="badge-earned__trio-card">
            <div className="badge-earned__trio" aria-hidden="true">
              <img
                src={config.trioFirst.src}
                alt=""
                className={`badge-earned__trio-img${config.trioFirst.locked ? ' badge-earned__trio-img--locked' : ''}`}
              />
              <img
                src={config.trioSecond.src}
                alt=""
                className={`badge-earned__trio-img${config.trioSecond.locked ? ' badge-earned__trio-img--locked' : ''}`}
              />
              <img
                src={config.trioThird.src}
                alt=""
                className={`badge-earned__trio-img${config.trioThird.locked ? ' badge-earned__trio-img--locked' : ''}`}
              />
            </div>
            <p className="badge-earned__trio-caption">{config.trioCaption}</p>
          </div>
        </div>
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
