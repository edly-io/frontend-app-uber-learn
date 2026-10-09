import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { NavHeader } from '../components/nav-header/NavHeader';
import { StepIndicator } from '../components/step-indicator/StepIndicator';
import iconAlert from '../assets/icons/icon-alert.svg';
import iconCc from '../assets/icons/icon-cc.svg';
import iconFullscreen from '../assets/icons/icon-fullscreen.svg';
import iconPlay from '../assets/icons/icon-play.svg';
import iconChevronDown from '../assets/icons/icon-chevron-down.svg';
import './video-step.scss';

export const VideoCouldntLoadPage = () => {
  const { courseId = '' } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const handleBack = () => navigate(`/course/${courseId}`);
  const handleClose = () => navigate(`/course/${courseId}`);

  return (
    <div className="vs-page">
      <NavHeader
        title="Lesson 3 of 7"
        onBack={handleBack}
        onClose={handleClose}
      />
      <StepIndicator current={1} total={4} />

      <main className="vs-content">
        {/* Activity chip */}
        <div className="kc-chip kc-chip--watch" aria-label="Watch">
          <img src={iconPlay} alt="" aria-hidden="true" className="kc-chip__icon" />
          <span className="kc-chip__label">Watch</span>
        </div>

        {/* Lesson title */}
        <h1 className="vs-title">Conversational boundaries</h1>

        {/* Video player — error state */}
        <div className="vs-player" role="region" aria-label="Video player">
          <div className="vs-player__error">
            <img src={iconAlert} alt="" aria-hidden="true" className="vs-player__error-icon" />
            <p className="vs-player__error-title">This video could not load</p>
            <p className="vs-player__error-body">
              Check your connection and try again. Your progress is saved.
            </p>
          </div>
          <div className="vs-player__controls">
            <div className="vs-player__timeline" aria-hidden="true" />
            <div className="vs-player__control-row">
              <p className="vs-player__time">0:00 / 3:20</p>
              <div className="vs-player__tools">
                <button
                  type="button"
                  className="vs-player__tool-btn"
                  aria-label="Toggle captions"
                >
                  <img src={iconCc} alt="" aria-hidden="true" className="vs-player__tool-icon" />
                </button>
                <button
                  type="button"
                  className="vs-player__tool-btn"
                  aria-label="Full screen"
                >
                  <img src={iconFullscreen} alt="" aria-hidden="true" className="vs-player__tool-icon" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CC pill button */}
        <button type="button" className="vs-cc-btn">CC on</button>

        {/* Lesson description */}
        <p className="vs-body">
          This video explains what to do when a rider begins flirting.
        </p>

        {/* Accordion */}
        <button type="button" className="vs-accordion" aria-expanded="false">
          <div className="vs-accordion__row">
            <div className="vs-accordion__text">
              <p className="vs-accordion__title">What should I look for?</p>
              <p className="vs-accordion__subtitle">
                Listen for the options to address, redirect, or clearly name the boundary.
              </p>
            </div>
            <div className="vs-accordion__chevron-wrap">
              <img
                src={iconChevronDown}
                alt=""
                aria-hidden="true"
                className="vs-accordion__chevron"
              />
            </div>
          </div>
          <div className="vs-accordion__divider" aria-hidden="true" />
        </button>

        {/* Unlock note */}
        <p className="vs-unlock-note">
          Finish the video to unlock the next step. If you leave now, this video restarts.
        </p>
      </main>

      <footer className="vs-footer">
        <button type="button" className="vs-footer__btn" disabled aria-disabled="true">
          Continue
        </button>
      </footer>
    </div>
  );
};
