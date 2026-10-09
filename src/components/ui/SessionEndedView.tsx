import React from 'react';
import { SystemStateView } from './SystemStateView';
import stateSpotSessionEnded from '../../assets/icons/state-spot-session-ended.svg';

interface SessionEndedViewProps {
  onClose: () => void;
  onBack?: () => void;
}

export const SessionEndedView = ({ onClose, onBack }: SessionEndedViewProps) => (
  <SystemStateView
    art={stateSpotSessionEnded}
    title="Your session has ended"
    message="Open learning again from the Uber app. Your progress is saved."
    buttonLabel="Close"
    onAction={onClose}
    onBack={onBack}
  />
);
