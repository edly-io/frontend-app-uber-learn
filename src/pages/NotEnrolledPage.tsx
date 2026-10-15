import React from 'react';
import { useNavigate } from 'react-router-dom';
import { StateSpotCantOpenThis } from '../assets/icons/inline/StateSpotCantOpenThis';
import iconArrowLeft from '../assets/icons/icon-arrow-left.svg';
import './not-enrolled.scss';

interface NotEnrolledPageProps {
  onClose?: () => void;
}

export const NotEnrolledPage = ({ onClose }: NotEnrolledPageProps) => {
  const navigate = useNavigate();
  const handleClose = onClose ?? (() => navigate('/'));

  return (
    <div className="ne-page">
      <header className="ne-nav">
        <button type="button" className="ne-nav__back" onClick={handleClose} aria-label="Go back">
          <img src={iconArrowLeft} alt="" className="ne-nav__back-icon" aria-hidden="true" />
        </button>
      </header>

      <main className="ne-content">
        <div className="ne-spot">
          <StateSpotCantOpenThis />
        </div>

        <div className="ne-heading">
          <h1 className="ne-heading__title">We can't open this</h1>
          <p className="ne-heading__body">
            This link doesn't work with your account. Go back to the app and open learning from there.
          </p>
        </div>
      </main>

      <footer className="ne-footer">
        <button type="button" className="ne-footer__close" onClick={handleClose}>
          Close
        </button>
      </footer>
    </div>
  );
};
