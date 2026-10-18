import React from 'react';
import './activity-chip.scss';

export type ChipType = 'learn' | 'practice' | 'watch';

interface ActivityChipProps {
  type: ChipType;
}

const LearnIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 7v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="8" cy="5.25" r="0.75" fill="currentColor" />
  </svg>
);

const PracticeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 1.5L14.5 8L8 14.5L1.5 8L8 1.5Z" fill="currentColor" />
  </svg>
);

const WatchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <polygon points="6,4 13,8 6,12" fill="currentColor" />
  </svg>
);

const CHIP_CONFIG: Record<ChipType, { label: string; Icon: React.FC; modifier: string }> = {
  learn: { label: 'Learn', Icon: LearnIcon, modifier: 'activity-chip--learn' },
  practice: { label: 'Practice', Icon: PracticeIcon, modifier: 'activity-chip--practice' },
  watch: { label: 'Watch', Icon: WatchIcon, modifier: 'activity-chip--watch' },
};

export const getChipType = (contentType: string, graded: boolean): ChipType => {
  if (contentType === 'problem' || graded) { return 'practice'; }
  if (contentType === 'video') { return 'watch'; }
  return 'learn';
};

export const ActivityChip = ({ type }: ActivityChipProps) => {
  const { label, Icon, modifier } = CHIP_CONFIG[type];
  return (
    <div className={`activity-chip ${modifier}`}>
      <span className="activity-chip__icon">
        <Icon />
      </span>
      <span className="activity-chip__label">{label}</span>
    </div>
  );
};
