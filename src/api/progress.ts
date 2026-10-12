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
 * Submits 100% completion for a unit (vertical) directly to the Open edX
 * completion batch API. Use this when the XBlock may not have self-reported
 * (e.g. YouTube videos on HTTP where the JS API events don't fire).
 */
export async function submitUnitCompletion(
  courseId: string,
  usageKey: string,
): Promise<void> {
  const { username } = getAuthenticatedUser() as { username: string };
  await getAuthenticatedHttpClient().post(
    `${getConfig().LMS_BASE_URL}/api/completion/v1/completion-batch/`,
    {
      username,
      course_key: courseId,
      blocks: { [usageKey]: 1.0 },
    },
  );
}

/**
 * Checks whether a specific unit (vertical) is marked complete by the LMS.
 */
export async function getUnitCompletion(
  courseId: string,
  sequenceId: string,
  usageKey: string,
): Promise<boolean> {
  const { data } = await getAuthenticatedHttpClient().post(
    `${getXBlockHandlerUrl(courseId, sequenceId)}/get_completion`,
    { usage_key: usageKey },
  );
  return (data as { complete: boolean }).complete === true;
}
