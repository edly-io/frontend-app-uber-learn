import React from 'react';
import { SystemStateView } from '../ui/SystemStateView';
import { StateSpotTakingTooLong } from '../../assets/icons/inline/StateSpotTakingTooLong';

interface SlowLoadViewProps {
  navTitle?: string;
  onBack?: () => void;
  onRetry: () => void;
}

export const SlowLoadView = ({ navTitle, onBack, onRetry }: SlowLoadViewProps) => (
  <SystemStateView
    art={<StateSpotTakingTooLong />}
    title="This is taking longer than expected"
    message="We couldn't finish loading your course. Your progress is saved."
    buttonLabel="Try again"
    onAction={onRetry}
    navTitle={navTitle}
    onBack={onBack}
  />
);
