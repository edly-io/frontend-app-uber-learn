import React from 'react';
import './button-dock.css';

interface ButtonDockProps {
  onContinue: () => void;
  disabled?: boolean;
  label?: string;
}

export const ButtonDock = ({ onContinue, disabled = false, label = 'Continue' }: ButtonDockProps) => (
  <div className="button-dock">
    <button
      type="button"
      className="btn-primary"
      onClick={onContinue}
      disabled={disabled}
      aria-disabled={disabled}
    >
      {label}
    </button>
  </div>
);
