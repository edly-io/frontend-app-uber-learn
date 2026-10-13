import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { NavHeader } from '../components/nav-header/NavHeader';
import iconAlert from '../assets/icons/icon-alert.svg';
import './video-step.scss';

export const VideoCouldntLoadPage = () => {
  const { courseId = '', sequenceId = '' } = useParams<{ courseId: string; sequenceId: string }>();
  const navigate = useNavigate();

  const handleBack = () => navigate(`/course/${courseId}`);
  const handleTryAgain = () => window.location.reload();
  const handleContinue = () => {
    if (sequenceId) {
      navigate(`/course/${courseId}/lesson/${sequenceId}/step/0`);
    } else {
      navigate(`/course/${courseId}`);
    }
  };

  return (
    <div className="vs-page">
      <NavHeader
        title="Video"
        onBack={handleBack}
        onClose={handleBack}
      />

      <main className="vs-content">
        {/* Video player — error state */}
        <div className="vs-player" role="region" aria-label="Video player">
          <div className="vs-player__error">
            <img src={iconAlert} alt="" aria-hidden="true" className="vs-player__error-icon" />
            <p className="vs-player__error-title">This video could not load</p>
            <p className="vs-player__error-body">
              Check your connection and try again. Your progress is saved.
            </p>
          </div>
        </div>
      </main>

      <footer className="vs-footer vs-footer--row">
        <button
          type="button"
          className="vs-footer__btn vs-footer__btn--secondary"
          onClick={handleTryAgain}
        >
          Try again
        </button>
        <button
          type="button"
          className="vs-footer__btn"
          onClick={handleContinue}
        >
          Continue
        </button>
      </footer>
    </div>
  );
};
