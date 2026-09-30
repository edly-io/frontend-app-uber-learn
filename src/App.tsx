import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CourseCatalog } from './pages/CourseCatalog';
import { CourseLibrary } from './pages/CourseLibrary';
import { LearningProgress } from './pages/LearningProgress';
import { CourseOverview } from './pages/CourseOverview';
import { ActivityView } from './pages/ActivityView';
import { RewardsView } from './pages/RewardsView';
import {
  LessonCompletePage,
  CourseCompletePage,
  RetentionInvitePage,
} from './pages/CompletionPage';
import {
  KnowledgeCheckPage,
  KnowledgeCheckResultPage,
} from './pages/KnowledgeCheckPage';
import {
  CourseIntroductionPage,
  SaveAndResumePage,
} from './pages/CourseIntroductionPage';

import './styles/tokens.css';
import './styles/typography.css';
import './styles/global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      retry: 2,
    },
  },
});

export const App = () => (
  <QueryClientProvider client={queryClient}>
    <Routes>
      <Route path="/" element={<CourseCatalog />} />
      <Route path="/library" element={<CourseLibrary />} />
      <Route path="/progress" element={<LearningProgress />} />
      <Route path="/course/:courseId" element={<CourseOverview />} />
      <Route
        path="/course/:courseId/lesson/:sequenceId/step/:unitIdx"
        element={<ActivityView />}
      />
      <Route path="/course/:courseId/rewards" element={<RewardsView />} />
      <Route path="/course/:courseId/lesson-complete" element={<LessonCompletePage />} />
      <Route path="/course/:courseId/complete" element={<CourseCompletePage />} />
      <Route path="/course/:courseId/retention" element={<RetentionInvitePage />} />
      <Route path="/course/:courseId/intro" element={<CourseIntroductionPage />} />
      <Route path="/course/:courseId/resume" element={<SaveAndResumePage />} />
      <Route path="/course/:courseId/check/:type" element={<KnowledgeCheckPage />} />
      <Route path="/course/:courseId/check-result/:type" element={<KnowledgeCheckResultPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </QueryClientProvider>
);

export default App;
