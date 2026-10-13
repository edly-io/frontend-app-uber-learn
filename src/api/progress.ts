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
