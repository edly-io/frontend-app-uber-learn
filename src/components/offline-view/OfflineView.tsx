import React from 'react';
import { NavHeader } from '../nav-header/NavHeader';
import './offline-view.css';

// Red circle with white exclamation mark — matches Figma circle_exclamation_mark icon
const ExclamationIcon = () => (
  <svg
    width="64"
    height="64"
    viewBox="0 0 64 64"
    fill="none"
    aria-hidden="true"
    role="img"
  >
    <circle cx="32" cy="32" r="32" fill="#DE1135" />
    <rect x="29" y="16" width="6" height="22" rx="3" fill="white" />
    <circle cx="32" cy="46" r="3.5" fill="white" />
  </svg>
);

interface OfflineViewProps {
  /** Title shown in the nav header (usually the lesson/course name) */
  title: string;
  onBack: () => void;
  /** Called when the user taps "Try again" */
  onRetry: () => void;
}

export const OfflineView = ({ title, onBack, onRetry }: OfflineViewProps) => (
  <div className="offline-page">
    <NavHeader title={title} onBack={onBack} />

    <div className="offline-body">
      <div className="offline-empty" role="alert" aria-live="assertive">
        <span className="offline-icon">
          <ExclamationIcon />
        </span>
        <h2 className="offline-heading">You&rsquo;re offline</h2>
        <p className="offline-body-text">
          Reconnect to load the next activity. Your practice progress is saved on this browser.
        </p>
      </div>
    </div>

    <footer className="offline-footer">
      <button
        type="button"
        className="offline-footer__btn"
        onClick={onRetry}
      >
        Try again
      </button>
    </footer>
  </div>
);
