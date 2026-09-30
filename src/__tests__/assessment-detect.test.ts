import { detectAssessmentMeta } from '../lib/assessment-detect';

describe('detectAssessmentMeta', () => {
  it('returns type=none for null payload', () => {
    const result = detectAssessmentMeta(null);
    expect(result.type).toBe('none');
    expect(result.questionCount).toBe(0);
    expect(result.score).toBeNull();
  });

  it('returns type=none for undefined payload', () => {
    const result = detectAssessmentMeta(undefined);
    expect(result.type).toBe('none');
  });

  it('returns type=none when uber_learn_assessments is absent', () => {
    const result = detectAssessmentMeta({ correct: true });
    expect(result.type).toBe('none');
  });

  it('returns type=none when uber_learn_assessments is empty array', () => {
    const result = detectAssessmentMeta({ uber_learn_assessments: [] });
    expect(result.type).toBe('none');
  });

  it('detects graded assessment type when any item has graded=true', () => {
    const result = detectAssessmentMeta({
      uber_learn_assessments: [
        { graded: true, question_count: 5 },
        { graded: false, question_count: 2 },
      ],
    });
    expect(result.type).toBe('graded');
    expect(result.questionCount).toBe(7);
  });

  it('detects ungraded assessment type when no items have graded=true', () => {
    const result = detectAssessmentMeta({
      uber_learn_assessments: [
        { graded: false, question_count: 3 },
      ],
    });
    expect(result.type).toBe('ungraded');
    expect(result.questionCount).toBe(3);
  });

  it('parses score from payload root', () => {
    const result = detectAssessmentMeta({
      uber_learn_assessments: [{ graded: true, question_count: 1 }],
      score: 0.8,
    });
    expect(result.score).toBe(0.8);
  });

  it('returns null score when score is not a number', () => {
    const result = detectAssessmentMeta({
      uber_learn_assessments: [{ graded: true, question_count: 1 }],
      score: 'not-a-number',
    });
    expect(result.score).toBeNull();
  });

  it('handles non-object payload gracefully', () => {
    // Casting to satisfy TS for robustness test
    const result = detectAssessmentMeta('string' as unknown as Record<string, unknown>);
    expect(result.type).toBe('none');
  });
});
