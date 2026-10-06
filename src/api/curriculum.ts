import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { getConfig } from '@edx/frontend-platform';

export type BadgeSlot = 'halfway' | 'complete' | 'retained';

export interface BadgeDetail {
  uuid: string;
  title: string;
  description: string;
  image_url: string | null;
}

export interface CurriculumCourse {
  course_id: string;
  display_name: string | null;
  exists: boolean;
  position: number;
  passed: boolean;
}

export interface Milestone {
  reached_at: string | null;
  badge: BadgeDetail | null;
}

export interface KnowledgeCheck {
  course_id: string;
  display_name: string | null;
  exists: boolean;
  unlocks_at: string | null;
  is_open: boolean;
}

export interface LearnerCurriculum {
  uuid: string;
  title: string;
  description: string;
  assigned_at: string;
  courses: CurriculumCourse[];
  courses_passed: number;
  courses_total: number;
  milestones: Record<BadgeSlot, Milestone>;
  knowledge_check: KnowledgeCheck;
}

export type AwardSource =
  | { type: 'curriculum'; curriculum: { uuid: string; title: string }; slot: BadgeSlot }
  | { type: 'course'; course_id: string; display_name: string | null };

export interface BadgeAward {
  id: string;
  awarded_at: string;
  seen: boolean;
  badge: BadgeDetail;
  source: AwardSource;
}

export interface BadgesPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: BadgeAward[];
}

function lmsBase(): string {
  return getConfig().LMS_BASE_URL as string;
}

export async function getLearnerCurriculums(): Promise<LearnerCurriculum[]> {
  const { data } = await getAuthenticatedHttpClient().get(
    `${lmsBase()}/api/uber/curriculum/v1/learner/curriculums/`,
  );
  return data as LearnerCurriculum[];
}

export async function getLearnerBadges(unseen = false): Promise<BadgesPage> {
  const url = `${lmsBase()}/api/uber/curriculum/v1/learner/badges/${unseen ? '?unseen=true' : ''}`;
  const { data } = await getAuthenticatedHttpClient().get(url);
  return data as BadgesPage;
}

export async function markBadgesSeen(awardIds: string[]): Promise<void> {
  await getAuthenticatedHttpClient().post(
    `${lmsBase()}/api/uber/curriculum/v1/learner/badges/seen/`,
    { award_ids: awardIds },
  );
}
