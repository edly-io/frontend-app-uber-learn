import React, { useCallback, useRef } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import './info-sheet.scss';

export interface InfoSheetData {
  title: string;
  bullets: string[];
}

interface InfoSheetProps {
  data: InfoSheetData | null;
  onClose: () => void;
}

export const InfoSheet = ({ data, onClose }: InfoSheetProps) => {
  const sheetRef = useRef<HTMLDivElement>(null);

  // useCallback ensures useFocusTrap's effect does not re-run on every render
  // due to an unstable onClose reference from the parent.
  const stableOnClose = useCallback(onClose, [onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  // WCAG 2.1 SC 2.4.3 / SC 2.1.2: trap focus and handle Escape when open.
  useFocusTrap(sheetRef, data !== null, stableOnClose);

  if (!data) { return null; }

  return (
    <>
      <div className="bds-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        className="bds-sheet info-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-sheet-title"
      >
        <div className="bds-handle" />
        <h2 className="info-sheet__title" id="info-sheet-title">{data.title}</h2>
        <ul className="info-sheet__bullets">
          {data.bullets.map((bullet) => (
            <li key={bullet} className="info-sheet__bullet">{bullet}</li>
          ))}
        </ul>
        <button type="button" className="btn-primary info-sheet__done" onClick={onClose}>
          Done
        </button>
      </div>
    </>
  );
};
