/**
 * Centralised TanStack Query key factory.
 * Every key is a readonly tuple for type-safe invalidation.
 */
export const qk = {
  outline: (courseId: string) => ['outline', courseId] as const,
  course: (courseId: string) => ['course', courseId] as const,
  sequence: (seqId: string) => ['sequence', seqId] as const,
  progress: (courseId: string) => ['progress', courseId] as const,
  resume: (courseId: string) => ['resume', courseId] as const,
  gamification: () => ['gamification', 'summary'] as const,
  leaderboard: () => ['gamification', 'leaderboard'] as const,
  curriculums: () => ['curriculum', 'learner'] as const,
  badges: (unseen?: boolean) => ['curriculum', 'badges', unseen ?? false] as const,
} as const;
