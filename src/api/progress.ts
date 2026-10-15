import { getConfig } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';

function getXBlockHandlerUrl(courseId: string, sequenceId: string): string {
  return `${getConfig().LMS_BASE_URL}/courses/${courseId}/xblock/${sequenceId}/handler`;
}

/**
 * Saves the learner's current position in a sequence.
 * unitIndex is 0-based; the LMS expects 1-based.
 */
export async function saveSequencePosition(
  courseId: string,
  sequenceId: string,
  unitIndex: number,
): Promise<void> {
  await getAuthenticatedHttpClient().post(
    `${getXBlockHandlerUrl(courseId, sequenceId)}/goto_position`,
    { position: unitIndex + 1 },
  );
}

/**
 * Reads whether a unit block is complete. Mirrors frontend-app-learning's getBlockCompletion.
 * POST to the sequence's get_completion XBlock handler — the platform derives unit completion
 * from leaf-block completions recorded by each XBlock's own handler.
 */
export async function getBlockCompletion(
  courseId: string,
  sequenceId: string,
  unitId: string,
): Promise<boolean> {
  const { data } = await getAuthenticatedHttpClient().post(
    `${getXBlockHandlerUrl(courseId, sequenceId)}/get_completion`,
    { usage_key: unitId },
  );
  return data.complete === true;
}

