import React from 'react';
import { NavHeader } from '../nav-header/NavHeader';
import './system-state.scss';

interface SystemStateViewProps {
  art: string;
  artAlt?: string;
  title: string;
  message: string;
  buttonLabel?: string;
  onAction?: () => void;
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
  navTitle,
  onBack,
}: SystemStateViewProps) => (
  <div className="ss-page">
    {onBack && <NavHeader title={navTitle ?? ''} onBack={onBack} />}

    <main className="ss-content" role={onBack ? undefined : 'alert'} aria-live={onBack ? undefined : 'assertive'}>
      <div className="ss-tile" aria-hidden="true">
        <img src={art} alt={artAlt} className="ss-tile__art" />
      </div>
      <div className="ss-heading-block">
        <h1 className="ss-heading">{title}</h1>
        <p className="ss-body">{message}</p>
      </div>
    </main>

    {buttonLabel && onAction && (
      <footer className="ss-footer">
        <button type="button" className="ss-footer__btn" onClick={onAction}>
          {buttonLabel}
        </button>
      </footer>
    )}
  </div>
);
