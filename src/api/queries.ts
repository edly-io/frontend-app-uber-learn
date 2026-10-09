/**
 * Centralised TanStack Query key factory.
 * Every key is a readonly tuple for type-safe invalidation.
 */
export const qk = {
  outline: (courseId: string) => ['outline', courseId] as const,
  course: (courseId: string) => ['course', courseId] as const,
  sequence: (seqId: string) => ['sequence', seqId] as const,
  resume: (courseId: string) => ['resume', courseId] as const,
  gamification: () => ['gamification', 'summary'] as const,
  leaderboard: () => ['gamification', 'leaderboard'] as const,
  lessonResults: (sequenceKey: string, since: string) => ['gamification', 'lesson-results', sequenceKey, since] as const,
  curriculums: () => ['curriculum', 'learner'] as const,
  badges: (unseen?: boolean) => ['curriculum', 'badges', unseen ?? false] as const,
  courseProgress: (courseId: string) => ['course-progress', courseId] as const,
} as const;
