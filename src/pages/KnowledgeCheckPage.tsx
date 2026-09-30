import React, { useState, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { NavHeader } from '../components/nav-header/NavHeader';
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

interface AnswerOptionProps {
  optionKey: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
}

const AnswerOption = ({
  optionKey, label, selected, onSelect,
}: AnswerOptionProps) => (
  <button
    type="button"
    className={`kc-option${selected ? ' kc-option--selected' : ''}`}
    onClick={onSelect}
    aria-pressed={selected}
  >
    <span className={`kc-option__key${selected ? ' kc-option__key--selected' : ''}`}>
      {optionKey}
    </span>
    <span className="kc-option__label">{label}</span>
  </button>
);

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
  const [answers, setAnswers] = useState<number[]>([]);

  const currentQuestion = questions[currentIdx];
  const isLastQuestion = currentIdx === questions.length - 1;
  const buttonLabel = isLastQuestion ? 'Check answer' : 'Next question';
  const canProceed = selectedOption !== null;

  const handleBack = () => navigate(`/course/${courseId}`);

  const handleNext = useCallback(() => {
    if (selectedOption === null) { return; }

    const newAnswers = [...answers, selectedOption];

    if (isLastQuestion) {
      // Calculate score
      const correctCount = newAnswers.filter(
        (ans, idx) => questions[idx].correctIndex === undefined || ans === questions[idx].correctIndex,
      ).length;
      const scoreTotal = checkType === 'baseline'
        ? questions.length
        : questions.filter((q) => q.correctIndex !== undefined).length;

      navigate(`/course/${courseId}/check-result/${checkType}`, {
        state: {
          checkType,
          score: checkType === 'baseline' ? Math.floor(questions.length * 0.4) : correctCount,
          total: questions.length,
          baselineScore: checkType === 'final' ? (baselineScore ?? Math.floor(questions.length * 0.4)) : undefined,
          baselineTotal: checkType === 'final' ? (baselineTotal ?? questions.length) : undefined,
        },
      });
    } else {
      setAnswers(newAnswers);
      setCurrentIdx((i) => i + 1);
      setSelectedOption(null);
    }
  }, [selectedOption, answers, isLastQuestion, questions, currentIdx, checkType, courseId, baselineScore, baselineTotal, navigate]);

  const headerLabel = checkType === 'final' ? 'Final check' : 'Quick check';
  const progressPercent = questions.length > 0
    ? ((currentIdx + 1) / questions.length) * 100
    : 0;

  return (
    <div className="kc-page">
      <NavHeader title={headerLabel} onBack={handleBack} />

      <main className="kc-content">
        {/* Progress */}
        <div className="kc-progress">
          <div className="kc-progress-labels">
            <span className="kc-progress-label">{headerLabel}</span>
            <span className="kc-progress-position">
              {currentIdx + 1}
              {' '}
              /
              {' '}
              {questions.length}
            </span>
          </div>
          <div className="kc-progress-track">
            <div className="kc-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        {/* Kicker */}
        <p className="kc-kicker">Knowledge check</p>

        {/* Question */}
        <h1 className="kc-question">{currentQuestion.text}</h1>

        {/* Lead */}
        <p className="kc-lead">
          {checkType === 'baseline'
            ? 'Choose the best answer. This establishes your starting knowledge.'
            : 'Choose the best answer. Your result does not change your points.'}
        </p>

        {/* Options */}
        <div className="kc-options" role="group" aria-label="Answer options">
          {currentQuestion.options.map((option, idx) => (
            <AnswerOption
              key={option.key}
              optionKey={option.key}
              label={option.label}
              selected={selectedOption === idx}
              onSelect={() => setSelectedOption(idx)}
            />
          ))}
        </div>
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

  const kicker = isBaseline ? 'Baseline recorded' : 'Final knowledge check';
  const statusTitle = isBaseline
    ? 'Your starting point is recorded'
    : (passed ? 'Ready to complete' : 'Keep going');
  const statusBody = isBaseline
    ? `You answered ${score} of ${total} questions. This sets your starting knowledge level.`
    : (passed
      ? `You answered ${score} of ${total} questions correctly.`
      : `You answered ${score} of ${total} questions correctly. Review and try again.`);

  const scoreDisplay = isBaseline ? `${score} / ${total}` : `${score} / ${total}`;

  const handleBack = () => navigate(`/course/${courseId}`);
  const handlePrimary = () => {
    if (isBaseline) {
      navigate(`/course/${courseId}`);
    } else {
      navigate(`/course/${courseId}/complete`, {
        state: { courseTitle: 'Course complete' },
      });
    }
  };

  const primaryLabel = isBaseline ? 'Start course' : 'Complete course';

  return (
    <div className="kc-page">
      <NavHeader title="Knowledge check result" onBack={handleBack} />

      <main className="kc-content">
        {/* Result card */}
        <div className={`kcr-result-card${passed || isBaseline ? ' kcr-result-card--positive' : ' kcr-result-card--neutral'}`}>
          <p className="kcr-kicker">{kicker}</p>
          <p className={`kcr-score${passed && !isBaseline ? ' kcr-score--positive' : ''}`}>
            {scoreDisplay}
          </p>
          <p className="kcr-title">{statusTitle}</p>
          <p className="kcr-body">{statusBody}</p>
        </div>

        {/* Before / Now comparison — final check only */}
        {!isBaseline && (
          <div className="kcr-gain">
            <div className="kcr-gain__tile">
              <p className="kcr-gain__label">Before</p>
              <p className="kcr-gain__score">
                {baselineScore}
                /
                {baselineTotal}
              </p>
            </div>
            <div className="kcr-gain__tile">
              <p className="kcr-gain__label">Now</p>
              <p className="kcr-gain__score">
                {score}
                /
                {total}
              </p>
            </div>
          </div>
        )}

        {/* Measurement note */}
        <p className="kcr-note">
          Knowledge checks measure learning gain and do not award points.
        </p>

        {/* Care note */}
        <div className="kcr-care-note">
          <p className="kcr-care-note__title">Your learning is recorded</p>
          <p className="kcr-care-note__body">
            {isBaseline
              ? 'Your starting knowledge level is saved to your learning record.'
              : 'Your result and course completion are saved to your learning record.'}
          </p>
        </div>
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
