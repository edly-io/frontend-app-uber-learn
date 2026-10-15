import { getConfig } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient, getAuthenticatedUser } from '@edx/frontend-platform/auth';

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
 * Marks a block as complete via the LMS completion batch API.
 * This updates the BlockCompletion record so the resume-block API
 * returns the correct lesson after the learner advances past a unit.
 * Calling it on an already-complete block is idempotent.
 */
export async function markBlockComplete(courseId: string, blockKey: string): Promise<void> {
  const user = getAuthenticatedUser();
  if (!user) { return; }
  const { username } = user;
  await getAuthenticatedHttpClient().post(
    `${getConfig().LMS_BASE_URL}/api/completion/v1/completion-batch/`,
    {
      username,
      course_key: courseId,
      blocks: { [blockKey]: 1.0 },
    },
  );
}
