import React, { useState, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { NavHeader } from '../components/nav-header/NavHeader';
import { StepIndicator } from '../components/step-indicator/StepIndicator';
import courseArtBook from '../assets/icons/course-art-book.svg';
import iconArrowLeft from '../assets/icons/icon-arrow-left.svg';
import iconClockFilled from '../assets/icons/icon-clock-filled.svg';
import iconCircleCheck from '../assets/icons/icon-circle-check.svg';
import iconCircleX from '../assets/icons/icon-circle-x.svg';
import iconChartBar from '../assets/icons/icon-chart-bar.svg';
import iconDiamond from '../assets/icons/icon-diamond.svg';
import './knowledge-check.css';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CheckQuestion {
  id: string;
  text: string;
  options: Array<{ key: string; label: string }>;
  correctIndex?: number; // undefined = baseline (never reveal correct/incorrect)
}

export type CheckType = 'baseline' | 'final';

interface KnowledgeCheckState {
  checkType?: CheckType;
  questions?: CheckQuestion[];
  baselineScore?: number;
  baselineTotal?: number;
}

// ── Answer option component ────────────────────────────────────────────────

type AnswerState = 'idle' | 'selected' | 'incorrect' | 'disabled';

interface AnswerOptionProps {
  optionKey: string;
  label: string;
  answerState: AnswerState;
  onSelect: () => void;
}

const AnswerOption = ({
  optionKey, label, answerState, onSelect,
}: AnswerOptionProps) => {
  const isDisabled = answerState === 'disabled' || answerState === 'incorrect';
  return (
    <button
      type="button"
      className={[
        'kc-option',
        answerState === 'selected' ? 'kc-option--selected' : '',
        answerState === 'incorrect' ? 'kc-option--incorrect' : '',
        answerState === 'disabled' ? 'kc-option--disabled' : '',
      ].filter(Boolean).join(' ')}
      onClick={isDisabled ? undefined : onSelect}
      aria-pressed={answerState === 'selected'}
      disabled={isDisabled}
    >
      <span className={[
        'kc-option__key',
        answerState === 'selected' ? 'kc-option__key--selected' : '',
        answerState === 'incorrect' ? 'kc-option__key--incorrect' : '',
        answerState === 'disabled' ? 'kc-option__key--disabled' : '',
      ].filter(Boolean).join(' ')}>
        {optionKey}
      </span>
      <span className={`kc-option__label${answerState === 'disabled' ? ' kc-option__label--disabled' : ''}`}>
        {label}
      </span>
      {answerState === 'incorrect' && (
        <img src={iconCircleX} alt="" aria-hidden="true" className="kc-option__result-icon" />
      )}
    </button>
  );
};

// ── KnowledgeCheckPage (question flow) ─────────────────────────────────────

const PLACEHOLDER_QUESTIONS: CheckQuestion[] = [
  {
    id: 'q1',
    text: 'You are unsure whether a personal question may make a rider uncomfortable. What is the safest choice?',
    options: [
      { key: 'A', label: 'Ask, but explain your intention' },
      { key: 'B', label: 'Do not ask the question' },
      { key: 'C', label: 'Ask only near the end of the trip' },
    ],
    correctIndex: 1,
  },
  {
    id: 'q2',
    text: 'A rider shares personal information during the trip. What should you do with that information?',
    options: [
      { key: 'A', label: 'Keep it confidential and do not share it' },
      { key: 'B', label: 'Mention it to other drivers as a safety tip' },
      { key: 'C', label: 'Save it in case it is useful later' },
    ],
    correctIndex: 0,
  },
  {
    id: 'q3',
    text: 'A rider asks you to take a different route than suggested. How do you respond?',
    options: [
      { key: 'A', label: 'Ignore the request and follow the app' },
      { key: 'B', label: 'Follow their preferred route if it is safe and legal' },
      { key: 'C', label: 'Ask them to explain why before deciding' },
    ],
    correctIndex: 1,
  },
  {
    id: 'q4',
    text: 'A rider appears distressed during the trip. What is the best immediate response?',
    options: [
      { key: 'A', label: 'Continue the trip without interruption' },
      { key: 'B', label: 'Ask if they are okay and offer to adjust the environment' },
      { key: 'C', label: 'End the trip and report to support' },
    ],
    correctIndex: 1,
  },
  {
    id: 'q5',
    text: 'You witness a rider behaving in a way that concerns you. What should you do?',
    options: [
      { key: 'A', label: 'Say nothing to avoid conflict' },
      { key: 'B', label: 'Report the concern after completing the trip' },
      { key: 'C', label: 'Immediately end the trip in a safe location and report' },
    ],
    correctIndex: 2,
  },
];

export const KnowledgeCheckPage = () => {
  const { courseId = '', type = 'baseline' } = useParams<{ courseId: string; type: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as KnowledgeCheckState) ?? {};

  const checkType = (state.checkType ?? type) as CheckType;
  const questions = state.questions ?? PLACEHOLDER_QUESTIONS;
  const baselineScore = state.baselineScore;
  const baselineTotal = state.baselineTotal;

  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);

  const currentQuestion = questions[currentIdx];
  const isLastQuestion = currentIdx === questions.length - 1;
  const hasCorrectIndex = currentQuestion.correctIndex !== undefined;
  const isBaseline = checkType === 'baseline';

  // After answering a final-check question, check if the selected answer is wrong
  const isIncorrect = answered && hasCorrectIndex && selectedOption !== currentQuestion.correctIndex;

  const canProceed = selectedOption !== null;
  const buttonLabel = answered ? 'Continue' : 'Check answer';

  const handleBack = () => navigate(`/course/${courseId}`);

  const handleNext = useCallback(() => {
    if (selectedOption === null) { return; }

    // First click on "Check answer": reveal feedback (for non-baseline questions)
    if (!answered && !isBaseline && hasCorrectIndex) {
      setAnswered(true);
      return;
    }

    const newAnswers = [...answers, selectedOption];

    if (isLastQuestion) {
      const correctCount = newAnswers.filter(
        (ans, idx) => questions[idx].correctIndex === undefined || ans === questions[idx].correctIndex,
      ).length;

      navigate(`/course/${courseId}/check-result/${checkType}`, {
        state: {
          checkType,
          score: isBaseline ? Math.floor(questions.length * 0.4) : correctCount,
          total: questions.length,
          baselineScore: !isBaseline ? (baselineScore ?? Math.floor(questions.length * 0.4)) : undefined,
          baselineTotal: !isBaseline ? (baselineTotal ?? questions.length) : undefined,
        },
      });
    } else {
      setAnswers(newAnswers);
      setCurrentIdx((i) => i + 1);
      setSelectedOption(null);
      setAnswered(false);
    }
  }, [selectedOption, answered, answers, isLastQuestion, questions, checkType, isBaseline,
    hasCorrectIndex, courseId, baselineScore, baselineTotal, navigate]);

  const headerLabel = checkType === 'final' ? 'Final check' : 'Quick check';

  return (
    <div className="kc-page">
      <NavHeader title={headerLabel} onBack={handleBack} />
      <StepIndicator current={currentIdx} total={questions.length} />

      <main className="kc-content">
        {/* Progress label */}
        <p className="kc-progress-label">
          Question
          {' '}
          {currentIdx + 1}
          {' '}
          of
          {' '}
          {questions.length}
        </p>

        {/* Activity chip */}
        <div className="kc-chip kc-chip--practice" aria-label="Practice">
          <img src={iconDiamond} alt="" aria-hidden="true" className="kc-chip__icon" />
          <span className="kc-chip__label">Practice</span>
        </div>

        {/* Question */}
        <h1 className="kc-question">{currentQuestion.text}</h1>

        {/* Lead */}
        <p className="kc-lead">
          {isBaseline
            ? 'Choose the best answer. This establishes your starting knowledge.'
            : 'Choose the best answer. Your result does not change your points.'}
        </p>

        {/* Options */}
        <div className="kc-options" role="group" aria-label="Answer options">
          {currentQuestion.options.map((option, idx) => {
            let answerState: AnswerState = 'idle';
            if (!answered) {
              answerState = selectedOption === idx ? 'selected' : 'idle';
            } else if (idx === selectedOption && isIncorrect) {
              answerState = 'incorrect';
            } else if (idx !== selectedOption) {
              answerState = 'disabled';
            } else {
              answerState = 'selected';
            }
            return (
              <AnswerOption
                key={option.key}
                optionKey={option.key}
                label={option.label}
                answerState={answerState}
                onSelect={() => !answered && setSelectedOption(idx)}
              />
            );
          })}
        </div>

        {/* Feedback card (shown when answer is incorrect) */}
        {isIncorrect && (
          <div className="kc-feedback" role="alert">
            <div className="kc-feedback__head">
              <div className="kc-feedback__mark" aria-hidden="true">
                <img src={iconCircleX} alt="" className="kc-feedback__mark-icon" />
              </div>
              <p className="kc-feedback__title">Not quite</p>
            </div>
            <p className="kc-feedback__body">
              If you are unsure how someone might respond to a question or comment,
              it is best not to say it.
            </p>
          </div>
        )}
      </main>

      <footer className="kc-footer">
        <button
          type="button"
          className="kc-footer__btn"
          onClick={handleNext}
          disabled={!canProceed}
        >
          {buttonLabel}
        </button>
      </footer>
    </div>
  );
};

// ── KnowledgeCheckResultPage ───────────────────────────────────────────────

interface CheckResultState {
  checkType?: CheckType;
  score?: number;
  total?: number;
  baselineScore?: number;
  baselineTotal?: number;
  passed?: boolean;
}

export const KnowledgeCheckResultPage = () => {
  const { courseId = '', type = 'final' } = useParams<{ courseId: string; type: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as CheckResultState) ?? {};

  const checkType = (state.checkType ?? type) as CheckType;
  const score = state.score ?? 5;
  const total = state.total ?? 5;
  const baselineScore = state.baselineScore ?? 2;
  const baselineTotal = state.baselineTotal ?? 5;
  const passed = state.passed ?? score >= Math.ceil(total * 0.8);

  const isBaseline = checkType === 'baseline';
  const isFinalNotPassed = !isBaseline && !passed;

  const statusTitle = isBaseline
    ? 'Your starting point is recorded'
    : (passed ? 'Ready to complete' : 'Review, then try again');

  const handleBack = () => navigate(`/course/${courseId}`);
  const handlePrimary = () => {
    if (isBaseline) {
      navigate(`/course/${courseId}`);
    } else if (isFinalNotPassed) {
      navigate(`/course/${courseId}/check/${checkType}`);
    } else {
      navigate(`/course/${courseId}/complete`, {
        state: { courseTitle: 'Course complete' },
      });
    }
  };

  const primaryLabel = isBaseline
    ? 'Start course'
    : (isFinalNotPassed ? 'Try final check again' : 'Complete course');

  // Art panel color: warning (yellow) for final-not-passed, green otherwise
  const artPanelClass = `kcr-art-panel${isFinalNotPassed ? ' kcr-art-panel--warning' : ''}`;

  // Right tile: positive-light (green) when passed, grey/neutral when not passed
  const rightTileClass = `kcr-gain__tile${passed && !isBaseline ? ' kcr-gain__tile--positive' : ''}`;
  const rightIcon = passed && !isBaseline ? iconCircleCheck : iconChartBar;
  const rightIconClass = `kcr-gain__icon${passed && !isBaseline ? ' kcr-gain__icon--positive' : ''}`;

  return (
    <div className="kc-page kc-page--result">
      <div className={artPanelClass}>
        <div className="kcr-art-panel__halo">
          <div className="kcr-art-panel__disc">
            <img src={courseArtBook} alt="" aria-hidden="true" className="kcr-art-panel__art" />
          </div>
        </div>
        <button
          type="button"
          className="kcr-art-panel__back"
          onClick={handleBack}
          aria-label="Back"
        >
          <img src={iconArrowLeft} alt="" aria-hidden="true" width={24} height={24} />
        </button>
      </div>

      <main className="kc-content">
        <h1 className="kcr-heading">{statusTitle}</h1>

        {/* Before / after learning gain tiles */}
        <div className="kcr-gain">
          <div className="kcr-gain__tile">
            <img src={iconClockFilled} alt="" aria-hidden="true" className="kcr-gain__icon" />
            <p className="kcr-gain__score">
              {baselineScore}
              /
              {baselineTotal}
            </p>
            <p className="kcr-gain__label">before the course</p>
          </div>
          <div className={rightTileClass}>
            <img src={rightIcon} alt="" aria-hidden="true" className={rightIconClass} />
            <p className="kcr-gain__score">
              {score}
              /
              {total}
            </p>
            <p className="kcr-gain__label">after the course</p>
          </div>
        </div>

        {/* Measurement note */}
        <p className="kcr-note">
          {isFinalNotPassed
            ? "There's no penalty. Go over these topics, then take the check again."
            : 'Knowledge checks measure learning gain and do not award points.'}
        </p>

        {/* Care note (final check not passed) */}
        {isFinalNotPassed && (
          <div className="kcr-care-note">
            <p className="kcr-care-note__title">Review these topics</p>
            <p className="kcr-care-note__body">
              Respecting boundaries · Consent and personal space · Safe reporting
            </p>
          </div>
        )}
      </main>

      <footer className="kc-footer">
        <button type="button" className="kc-footer__btn" onClick={handlePrimary}>
          {primaryLabel}
        </button>
        <button type="button" className="kc-footer__secondary" onClick={handleBack}>
          Back to course
        </button>
      </footer>
    </div>
  );
};
