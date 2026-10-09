import React from 'react';
import { SystemStateView } from './SystemStateView';
import stateSpotTakingTooLong from '../../assets/icons/state-spot-taking-too-long.svg';

interface ErrorViewProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  art?: string;
  buttonLabel?: string;
  onAction?: () => void;
  navTitle?: string;
  onBack?: () => void;
}

export const ErrorView = ({
  title = 'Something went wrong',
  message = 'We could not load this content. Please try again.',
  onRetry,
  art = stateSpotTakingTooLong,
  buttonLabel = 'Try again',
  onAction,
  navTitle,
  onBack,
}: ErrorViewProps) => (
  <SystemStateView
    art={art}
    title={title}
    message={message}
    buttonLabel={onAction || onRetry ? buttonLabel : undefined}
    onAction={onAction ?? onRetry}
    navTitle={navTitle}
    onBack={onBack}
  />
);
