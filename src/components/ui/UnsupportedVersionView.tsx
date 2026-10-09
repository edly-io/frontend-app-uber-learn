import React from 'react';
import { SystemStateView } from './SystemStateView';
import stateSpotUnsupportedVersion from '../../assets/icons/state-spot-unsupported-version.svg';

interface UnsupportedVersionViewProps {
  onClose: () => void;
  onBack?: () => void;
}

export const UnsupportedVersionView = ({ onClose, onBack }: UnsupportedVersionViewProps) => (
  <SystemStateView
    art={stateSpotUnsupportedVersion}
    title="Update the Uber app"
    message="This version can't open learning. Update the app, then try again."
    buttonLabel="Close"
    onAction={onClose}
    onBack={onBack}
  />
);
