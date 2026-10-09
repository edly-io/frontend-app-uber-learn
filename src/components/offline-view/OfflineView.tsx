import React from 'react';
import { SystemStateView } from '../ui/SystemStateView';
import stateSpotOffline from '../../assets/icons/state-spot-offline.svg';

interface OfflineViewProps {
  title: string;
  onBack: () => void;
  onRetry: () => void;
}

export const OfflineView = ({ title, onBack, onRetry }: OfflineViewProps) => (
  <SystemStateView
    art={stateSpotOffline}
    title="You're offline"
    message="Reconnect to load the next step. Your progress is saved."
    buttonLabel="Try again"
    onAction={onRetry}
    navTitle={title}
    onBack={onBack}
  />
);
