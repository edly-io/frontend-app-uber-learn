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
  /** True when every unit in this sequence is complete. Populated from the API when available. */
  complete: boolean;
}

export interface CourseOutline {
  courseId: string;
  title: string;
  /** Short commitment/description text from the course, when the platform exposes it. */
  shortDescription?: string | null;
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
// Course-home course outline
// ---------------------------------------------------------------------------

export async function getCourseOutline(courseId: string): Promise<CourseOutline> {
  const url = `${getConfig().LMS_BASE_URL}/api/course_home/v1/outline/${courseId}`;
  const { data } = await getAuthenticatedHttpClient().get(url);

  type RawBlock = {
    id: string;
    display_name: string;
    type: string;
    complete?: boolean;
    children?: string[];
  };

  const blocks: Record<string, RawBlock> = data.course_blocks?.blocks ?? {};

  const sections: Record<string, OutlineSection> = {};
  const sequences: Record<string, OutlineSequence> = {};

  // Find the root course block to get ordered chapter IDs; fall back to scanning all blocks.
  const courseBlock = Object.values(blocks).find((b) => b.type === 'course');
  const sectionIds: string[] = courseBlock?.children
    ?? Object.keys(blocks).filter((k) => blocks[k].type === 'chapter');

  sectionIds.forEach((sectionId) => {
    const sectionBlock = blocks[sectionId];
    if (!sectionBlock || sectionBlock.type !== 'chapter') { return; }

    const seqIds = (sectionBlock.children ?? []).filter((k) => {
      const b = blocks[k];
      return b != null && b.type === 'sequential';
    });

    sections[sectionId] = {
      id: sectionId,
      title: sectionBlock.display_name,
      sequenceIds: seqIds,
    };

    seqIds.forEach((seqId) => {
      const seqBlock = blocks[seqId];
      if (!seqBlock) { return; }
      sequences[seqId] = {
        id: seqId,
        title: seqBlock.display_name,
        sectionId,
        // The course_home outline exposes a per-sequence complete boolean directly.
        complete: seqBlock.complete === true,
      };
    });
  });

  // Title: prefer the course block's display_name, fall back to top-level title.
  const courseTitle: string = courseBlock?.display_name ?? (data.title as string | undefined) ?? courseId;

  // Short description / commitment text — field name varies by platform version.
  const rawBlock = courseBlock as Record<string, unknown> | undefined;
  const shortDescription: string | null = (
    (rawBlock?.short_description as string | undefined)
    ?? (rawBlock?.description as string | undefined)
    ?? (data.short_description as string | undefined)
    ?? null
  ) || null;

  return {
    courseId,
    title: courseTitle,
    shortDescription,
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
