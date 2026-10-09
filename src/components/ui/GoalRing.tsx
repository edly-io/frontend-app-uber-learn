import React from 'react';
import './goal-ring.scss';

interface GoalRingProps {
  daysCompleted: number;
  daysGoal: number;
}

export const GoalRing = ({ daysCompleted, daysGoal }: GoalRingProps) => {
  const label = `${daysCompleted}/${daysGoal}`;
  const fraction = daysGoal > 0 ? Math.min(daysCompleted / daysGoal, 1) : 0;
  const pct = `${Math.round(fraction * 100)}%`;

  return (
    <div
      className="goal-ring"
      style={{ '--goal-pct': pct } as React.CSSProperties}
      aria-label={`${daysCompleted} of ${daysGoal} days done`}
    >
      <div className="goal-ring__inner">
        <span className="goal-ring__label">{label}</span>
      </div>
    </div>
  );
};
