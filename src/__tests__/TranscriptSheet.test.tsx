/**
 * Unit tests for TranscriptSheet bottom sheet.
 *
 * AC coverage:
 *   - TS-NULL: renders nothing when usageId is null
 *   - TS-EMPTY: renders nothing when usageId is empty string
 *   - TS-DIALOG: has role="dialog" and aria-modal="true" when open
 *   - TS-TITLE: always shows "Transcript" heading
 *   - TS-SUBTITLE: shows videoTitle prop when provided
 *   - TS-LOADING: shows loading skeleton when status is loading
 *   - TS-PARAGRAPHS: renders transcript paragraphs when status is success
 *   - TS-ERROR: shows unavailable message when status is error
 *   - TS-BACKDROP-CLOSE: backdrop click triggers onClose
 *   - TS-BUTTON-CLOSE: "Back to video" button triggers onClose
 *   - TS-ESCAPE-CLOSE: Escape key triggers onClose
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TranscriptSheet } from '../components/transcript-sheet/TranscriptSheet';

// ── Mock useTranscript ────────────────────────────────────────────────────────

const mockUseTranscript = jest.fn();
jest.mock('../hooks/useTranscript', () => ({
  useTranscript: (...args: unknown[]) => mockUseTranscript(...args),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderSheet(
  usageId: string | null,
  onClose = jest.fn(),
  videoTitle?: string,
) {
  return render(
    <TranscriptSheet
      usageId={usageId}
      courseId="course-v1:uber+Uber+Demo_2026"
      videoTitle={videoTitle}
      onClose={onClose}
    />,
  );
}

beforeEach(() => {
  mockUseTranscript.mockReturnValue({ paragraphs: [], status: 'idle' });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

test('TS-NULL: renders nothing when usageId is null', () => {
  const { container } = renderSheet(null);
  expect(container.firstChild).toBeNull();
});

test('TS-EMPTY: renders nothing when usageId is empty string', () => {
  const { container } = renderSheet('');
  expect(container.firstChild).toBeNull();
});

test('TS-DIALOG: has role dialog and aria-modal when open', () => {
  const { container } = renderSheet('block@abc');
  const dialog = container.querySelector('[role="dialog"]');
  expect(dialog).not.toBeNull();
  expect(dialog).toHaveAttribute('aria-modal', 'true');
});

test('TS-TITLE: always shows "Transcript" heading', () => {
  renderSheet('block@abc');
  expect(screen.getByRole('heading', { name: 'Transcript' })).toBeInTheDocument();
});

test('TS-SUBTITLE: shows videoTitle prop when provided', () => {
  renderSheet('block@abc', jest.fn(), 'Conversational boundaries');
  expect(screen.getByText('Conversational boundaries')).toBeInTheDocument();
});

test('TS-LOADING: shows loading state', () => {
  mockUseTranscript.mockReturnValue({ paragraphs: [], status: 'loading' });
  const { container } = renderSheet('block@abc');
  expect(container.querySelector('.ts-loading')).not.toBeNull();
  expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
});

test('TS-PARAGRAPHS: renders transcript paragraphs', () => {
  mockUseTranscript.mockReturnValue({
    paragraphs: ['Para one.', 'Para two.'],
    status: 'success',
  });
  renderSheet('block@abc');
  expect(screen.getByText('Para one.')).toBeInTheDocument();
  expect(screen.getByText('Para two.')).toBeInTheDocument();
});

test('TS-ERROR: shows unavailable message when status is error', () => {
  mockUseTranscript.mockReturnValue({ paragraphs: [], status: 'error' });
  renderSheet('block@abc');
  expect(screen.getByText(/Transcript not available/)).toBeInTheDocument();
});

test('TS-BACKDROP-CLOSE: backdrop click triggers onClose', () => {
  const onClose = jest.fn();
  const { container } = renderSheet('block@abc', onClose);
  const backdrop = container.querySelector('.bds-backdrop')!;
  fireEvent.click(backdrop);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('TS-BUTTON-CLOSE: "Back to video" button triggers onClose', () => {
  mockUseTranscript.mockReturnValue({
    paragraphs: ['Text.'],
    status: 'success',
  });
  const onClose = jest.fn();
  renderSheet('block@abc', onClose);
  fireEvent.click(screen.getByRole('button', { name: 'Back to video' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('TS-ESCAPE-CLOSE: Escape key triggers onClose', () => {
  const onClose = jest.fn();
  renderSheet('block@abc', onClose);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('TS-SWIPE-GRABBER-DOWN: swipe down on grabber beyond threshold triggers onClose', () => {
  const onClose = jest.fn();
  const { container } = renderSheet('block@abc', onClose);
  const handle = container.querySelector('.bds-handle')!;
  fireEvent.touchStart(handle, { touches: [{ clientY: 100 }] });
  fireEvent.touchEnd(handle, { changedTouches: [{ clientY: 170 }] });
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('TS-SWIPE-GRABBER-SHORT: swipe less than threshold does not trigger onClose', () => {
  const onClose = jest.fn();
  const { container } = renderSheet('block@abc', onClose);
  const handle = container.querySelector('.bds-handle')!;
  fireEvent.touchStart(handle, { touches: [{ clientY: 100 }] });
  fireEvent.touchEnd(handle, { changedTouches: [{ clientY: 140 }] });
  expect(onClose).not.toHaveBeenCalled();
});

test('TS-SWIPE-GRABBER-CANCEL: touch cancel on grabber resets without triggering close', () => {
  const onClose = jest.fn();
  const { container } = renderSheet('block@abc', onClose);
  const handle = container.querySelector('.bds-handle')!;
  fireEvent.touchStart(handle, { touches: [{ clientY: 100 }] });
  fireEvent.touchCancel(handle);
  fireEvent.touchEnd(handle, { changedTouches: [{ clientY: 200 }] });
  expect(onClose).not.toHaveBeenCalled();
});

test('TS-SWIPE-BODY-DOWN: swipe down on body at scroll top triggers onClose', () => {
  const onClose = jest.fn();
  const { container } = renderSheet('block@abc', onClose);
  const body = container.querySelector('.ts-body')!;
  // scrollTop defaults to 0 in jsdom
  fireEvent.touchStart(body, { touches: [{ clientY: 50 }] });
  fireEvent.touchEnd(body, { changedTouches: [{ clientY: 120 }] });
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('TS-SWIPE-BODY-CANCEL: touch cancel on body resets without triggering close', () => {
  const onClose = jest.fn();
  const { container } = renderSheet('block@abc', onClose);
  const body = container.querySelector('.ts-body')!;
  fireEvent.touchStart(body, { touches: [{ clientY: 50 }] });
  fireEvent.touchCancel(body);
  fireEvent.touchEnd(body, { changedTouches: [{ clientY: 200 }] });
  expect(onClose).not.toHaveBeenCalled();
});
