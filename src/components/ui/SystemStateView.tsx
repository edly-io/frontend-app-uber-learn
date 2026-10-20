import React from 'react';
import { NavHeader } from '../nav-header/NavHeader';
import './system-state.scss';

interface SystemStateViewProps {
  art: string | React.ReactNode;
  artAlt?: string;
  title: string;
  message: string;
  buttonLabel?: string;
  onAction?: () => void;
  /** Optional second footer action, shown under the main one (as in the two-action footers). */
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
  navTitle?: string;
  onBack?: () => void;
}

export const SystemStateView = ({
  art,
  artAlt = '',
  title,
  message,
  buttonLabel,
  onAction,
  secondaryLabel,
  onSecondaryAction,
  navTitle,
  onBack,
}: SystemStateViewProps) => {
  const hasAction = Boolean(buttonLabel && onAction);
  const hasSecondaryAction = Boolean(secondaryLabel && onSecondaryAction);

  return (
    <div className="ss-page">
      {onBack && <NavHeader title={navTitle ?? ''} onBack={onBack} />}

      <main className="ss-content" role={onBack ? undefined : 'alert'} aria-live={onBack ? undefined : 'assertive'}>
        <div className="ss-tile" aria-hidden="true">
          {typeof art === 'string'
            ? <img src={art} alt={artAlt} className="ss-tile__art" />
            : art}
        </div>
        <div className="ss-heading-block">
          <h1 className="ss-heading">{title}</h1>
          <p className="ss-body">{message}</p>
        </div>
      </main>

      {(hasAction || hasSecondaryAction) && (
        <footer className="ss-footer">
          {hasAction && (
            <button type="button" className="ss-footer__btn" onClick={onAction}>
              {buttonLabel}
            </button>
          )}
          {hasSecondaryAction && (
            <button type="button" className="ss-footer__secondary" onClick={onSecondaryAction}>
              {secondaryLabel}
            </button>
          )}
        </footer>
      )}
    </div>
  );
};
