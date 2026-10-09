import React from 'react';
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
  if (!data) return null;

  return (
    <>
      <div className="bds-backdrop" onClick={onClose} aria-hidden="true" />
      <div
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
