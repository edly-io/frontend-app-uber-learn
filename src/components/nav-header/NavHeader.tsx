import React from 'react';
import './nav-header.css';

interface NavHeaderProps {
  title: string;
  onBack: () => void;
  /** Small label shown above the title (e.g. "LESSON 1 / 7") */
  kicker?: string;
  /** When provided, an X close button is shown on the right */
  onClose?: () => void;
}

export const NavHeader = ({
  title, onBack, kicker, onClose,
}: NavHeaderProps) => (
  <header className="nav-header">
    <button
      type="button"
      className="nav-header__back-btn"
      onClick={onBack}
      aria-label="Go back"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M12.5 15L7.5 10L12.5 5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>

    <div className="nav-header__center">
      {kicker && <span className="nav-header__kicker">{kicker}</span>}
      <h1 className="nav-header__title">{title}</h1>
    </div>

    {onClose ? (
      <button
        type="button"
        className="nav-header__close-btn"
        onClick={onClose}
        aria-label="Close"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M15 5L5 15M5 5L15 15"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    ) : (
      /* Spacer keeps the title centred when there is no close button */
      <div className="nav-header__spacer" aria-hidden="true" />
    )}
  </header>
);
