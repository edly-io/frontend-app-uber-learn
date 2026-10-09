export type { AssessmentEntry, AssessmentState } from '../api/progress';

export interface AssessmentMetaResult {
  baseline: null;
  final: null;
  retention: null;
  isLoading: boolean;
  isError: boolean;
}

export const useAssessmentMeta = (_courseId: string): AssessmentMetaResult => ({
  baseline: null,
  final: null,
  retention: null,
  isLoading: false,
  isError: false,
});
