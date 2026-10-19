import React, { useRef, useCallback } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useTranscript } from '../../hooks/useTranscript';
import './transcript-sheet.scss';

const SWIPE_THRESHOLD_PX = 60;

interface TranscriptSheetProps {
  usageId: string | null;
  courseId: string;
  videoTitle?: string;
  onClose: () => void;
}

/**
 * Bottom sheet that shows the parsed SRT transcript for a video unit.
 *
 * Opens when `usageId` is non-null (triggered by `plugin.openTranscript` from
 * the XBlock iframe). Fetches the transcript directly via the handler_noauth
 * URL — no Blocks API call required.
 *
 * Close affordances: "Back to video" button, backdrop click, Escape key,
 * and a swipe-down gesture from the grabber / heading (or from the body when
 * scrolled to the top).
 */
export const TranscriptSheet = ({
  usageId, courseId, videoTitle, onClose,
}: TranscriptSheetProps) => {
  const isOpen = Boolean(usageId);
  const sheetRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Separate refs per touch region so grabber and body don't share start coords.
  const grabberTouchStartY = useRef<number | null>(null);
  const bodyTouchStartY = useRef<number | null>(null);

  useFocusTrap(sheetRef, isOpen, onClose);

  const { paragraphs, status } = useTranscript(usageId, courseId);

  // ── Grabber / heading touch handlers ──────────────────────────────────────

  const handleGrabberTouchStart = useCallback((e: React.TouchEvent) => {
    grabberTouchStartY.current = e.touches[0].clientY;
  }, []);

  const handleGrabberTouchCancel = useCallback(() => {
    grabberTouchStartY.current = null;
  }, []);

  const handleGrabberTouchEnd = useCallback((e: React.TouchEvent) => {
    if (grabberTouchStartY.current === null) { return; }
    const delta = e.changedTouches[0].clientY - grabberTouchStartY.current;
    grabberTouchStartY.current = null;
    if (delta > SWIPE_THRESHOLD_PX) { onClose(); }
  }, [onClose]);

  // ── Body touch handlers (dismiss only when scrolled to top) ───────────────

  const handleBodyTouchStart = useCallback((e: React.TouchEvent) => {
    bodyTouchStartY.current = e.touches[0].clientY;
  }, []);

  const handleBodyTouchCancel = useCallback(() => {
    bodyTouchStartY.current = null;
  }, []);

  const handleBodyTouchEnd = useCallback((e: React.TouchEvent) => {
    if (bodyTouchStartY.current === null) { return; }
    const delta = e.changedTouches[0].clientY - bodyTouchStartY.current;
    bodyTouchStartY.current = null;
    const atTop = (bodyRef.current?.scrollTop ?? 0) === 0;
    if (atTop && delta > SWIPE_THRESHOLD_PX) { onClose(); }
  }, [onClose]);

  if (!isOpen) { return null; }

  return (
    <>
      <div
        className="bds-backdrop ts-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        className="bds-sheet ts-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ts-title"
      >
        <div
          className="bds-handle"
          onTouchStart={handleGrabberTouchStart}
          onTouchEnd={handleGrabberTouchEnd}
          onTouchCancel={handleGrabberTouchCancel}
          aria-hidden="true"
        />

        <header
          className="ts-heading"
          onTouchStart={handleGrabberTouchStart}
          onTouchEnd={handleGrabberTouchEnd}
          onTouchCancel={handleGrabberTouchCancel}
        >
          <h2 className="ts-heading__title" id="ts-title">Transcript</h2>
          {videoTitle && (
            <p className="ts-heading__subtitle">{videoTitle}</p>
          )}
        </header>

        <div
          ref={bodyRef}
          className="ts-body"
          tabIndex={0}
          aria-label="Transcript text, scrollable"
          onTouchStart={handleBodyTouchStart}
          onTouchEnd={handleBodyTouchEnd}
          onTouchCancel={handleBodyTouchCancel}
        >
          {status === 'loading' && (
            <div className="ts-loading" aria-live="polite" aria-busy="true" aria-label="Loading transcript">
              <div className="ts-loading__bar" />
              <div className="ts-loading__bar ts-loading__bar--short" />
              <div className="ts-loading__bar" />
              <div className="ts-loading__bar ts-loading__bar--short" />
            </div>
          )}

          {status === 'error' && (
            <p className="ts-error" role="status">
              Transcript not available for this video.
            </p>
          )}

          {status === 'success' && (
            <div className="ts-transcript">
              {paragraphs.map((para, i) => (
                // paragraph identity is position-stable for a given transcript fetch
                // eslint-disable-next-line react/no-array-index-key
                <p key={i} className="ts-transcript__para">{para}</p>
              ))}
            </div>
          )}
        </div>

        <div className="ts-footer">
          <button
            type="button"
            className="btn-primary ts-footer__btn"
            onClick={onClose}
          >
            Back to video
          </button>
        </div>
      </div>
    </>
  );
};
