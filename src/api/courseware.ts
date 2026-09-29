import { getConfig, camelCaseObject } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResumeBlock {
  /**
   * The block's usage key for the deepest block the learner should resume.
   * Corresponds to the API field `block_id` (camelCased by the platform).
   */
  blockId: string | null;
  resumeBlock: boolean;
  /**
   * The SEQUENCE/SUBSECTION usage key. Corresponds to the API field `section_id`.
   * Despite the name "section", this is the sequential (subsection), not the chapter.
   */
  sectionId: string | null;
  unitId: string | null;
}

export interface SequenceUnit {
  id: string;
  sequenceId: string;
  title: string;
  complete: boolean;
  contentType: string;
  graded: boolean;
}

export interface SequenceData {
  id: string;
  title: string;
  unitIds: string[];
  activeUnitIndex: number;
}

export interface OutlineSection {
  id: string;
  title: string;
  sequenceIds: string[];
}

export interface OutlineSequence {
  id: string;
  title: string;
  sectionId: string;
}

export interface CourseOutline {
  courseId: string;
  title: string;
  sections: Record<string, OutlineSection>;
  sequences: Record<string, OutlineSequence>;
}

// ---------------------------------------------------------------------------
// Resume block
// ---------------------------------------------------------------------------

export async function getResumeBlock(courseId: string): Promise<ResumeBlock> {
  const url = `${getConfig().LMS_BASE_URL}/api/courseware/resume/${courseId}`;
  const { data } = await getAuthenticatedHttpClient().get(url);
  return camelCaseObject(data) as ResumeBlock;
}

// ---------------------------------------------------------------------------
// Learning-sequences course outline
// ---------------------------------------------------------------------------

export async function getCourseOutline(courseId: string): Promise<CourseOutline> {
  const url = `${getConfig().LMS_BASE_URL}/api/learning_sequences/v1/course_outline/${courseId}`;
  const { data } = await getAuthenticatedHttpClient().get(url);

  // Normalize the nested outline into a flat structure
  const sections: Record<string, OutlineSection> = {};
  const sequences: Record<string, OutlineSequence> = {};
  const now = new Date();

  type ReleasedBlock = { accessible?: boolean; effective_start?: string | null };
  type RawSeq = ReleasedBlock & { title: string };
  type RawSection = ReleasedBlock & {
    id: string; title: string; sequence_ids: string[];
  };

  function isReleased(block: ReleasedBlock): boolean {
    return (
      Boolean(block.accessible)
      || !block.effective_start
      || now >= new Date(block.effective_start)
    );
  }

  // Collect released sequences first
  Object.entries(data.outline.sequences as Record<string, RawSeq>).forEach(
    ([seqId, seq]) => {
      if (!isReleased(seq)) { return; }
      sequences[seqId] = { id: seqId, title: seq.title, sectionId: '' };
    },
  );

  // Collect sections
  (data.outline.sections as RawSection[]).forEach((section) => {
    const availableSeqIds = section.sequence_ids.filter((id) => id in sequences);
    if (!isReleased(section) && availableSeqIds.length === 0) { return; }

    sections[section.id] = {
      id: section.id,
      title: section.title,
      sequenceIds: availableSeqIds,
    };
    // Back-fill sectionId on each child sequence
    availableSeqIds.forEach((seqId) => {
      sequences[seqId] = { ...sequences[seqId], sectionId: section.id };
    });
  });

  return {
    courseId: data.course_key as string,
    title: data.title as string,
    sections,
    sequences,
  };
}

// ---------------------------------------------------------------------------
// Sequence metadata
// ---------------------------------------------------------------------------

export async function getSequenceMetadata(
  sequenceId: string,
): Promise<{ sequence: SequenceData; units: SequenceUnit[] }> {
  const url = `${getConfig().LMS_BASE_URL}/api/courseware/sequence/${sequenceId}`;
  const { data } = await getAuthenticatedHttpClient().get(url);

  const sequence: SequenceData = {
    id: data.item_id as string,
    title: data.display_name as string,
    unitIds: (data.items as Array<{ id: string }>).map((u) => u.id),
    // Position comes back 1-indexed from the server; convert to 0-indexed.
    activeUnitIndex: data.position ? (data.position as number) - 1 : 0,
  };

  const units: SequenceUnit[] = (data.items as Array<{
    id: string;
    page_title: string;
    complete: boolean;
    type: string;
    graded: boolean;
  }>).map((unit) => ({
    id: unit.id,
    sequenceId: data.item_id as string,
    title: unit.page_title,
    complete: unit.complete,
    contentType: unit.type,
    graded: unit.graded,
  }));

  return { sequence, units };
}
