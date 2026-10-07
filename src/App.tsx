import React, { Component } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
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
import { BadgeEarned } from './pages/BadgeEarned';
import { LearningPathView } from './pages/LearningPathView';
import { SearchPage } from './pages/SearchPage';

import './styles/tokens.css';
import './styles/typography.css';
import './styles/global.css';

interface ErrorBoundaryState { hasError: boolean }

class AppErrorBoundary extends Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100dvh', gap: '16px',
          padding: '24px', textAlign: 'center',
          fontFamily: 'var(--u-font-body, system-ui, sans-serif)',
          background: 'var(--u-background-primary, #fff)',
          color: 'var(--u-content-primary, #000)',
        }}
        >
          <p style={{ fontSize: '16px', fontWeight: 500 }}>Something went wrong.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '14px 24px', borderRadius: '999px', border: 'none',
              background: 'var(--u-background-always-dark, #000)',
              color: 'var(--u-content-on-color, #fff)',
              fontFamily: 'inherit', fontSize: '16px', fontWeight: 500, cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const CourseHomeRedirect = () => {
  const { courseId } = useParams<{ courseId: string }>();
  return <Navigate to={`/course/${courseId}`} replace />;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      retry: 2,
    },
  },
});

export const App = () => (
  <AppErrorBoundary>
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
        <Route path="/badge/:type" element={<BadgeEarned />} />
        <Route path="/learning-path/:curriculumId" element={<LearningPathView />} />
        <Route path="/search" element={<SearchPage />} />
        {/* LMS-generated deep links */}
        <Route path="/course/:courseId/home" element={<CourseHomeRedirect />} />
        <Route path="/course/:courseId/progress" element={<Navigate to="/progress" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
