import React, {
  Component, Suspense, useEffect,
} from 'react';
import {
  Routes, Route, Navigate, useParams, useNavigate,
} from 'react-router-dom';
import { logError } from '@edx/frontend-platform/logging';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionEndedView } from './components/ui/SessionEndedView';
import { UnsupportedVersionView } from './components/ui/UnsupportedVersionView';
import { CourseCatalog } from './pages/CourseCatalog';
import { CourseLibrary } from './pages/CourseLibrary';
import { CourseOverview } from './pages/CourseOverview';
import { ActivityView } from './pages/ActivityView';
import { SaveAndResumePage } from './pages/CourseIntroductionPage';
import { SearchPage } from './pages/SearchPage';
import { NoRequiredCoursesPage } from './pages/NoRequiredCoursesPage';
import { VideoCouldntLoadPage } from './pages/VideoCouldntLoadPage';
import { CourseNotAvailablePage } from './pages/CourseNotAvailablePage';

import { useSequence } from './hooks/useSequence';
import { LoadingSkeleton } from './components/ui/LoadingSkeleton';

import './styles/tokens.scss';
import './styles/typography.scss';
import './styles/global.scss';

// Heavy pages — code-split so they don't inflate the initial bundle
const LearningProgress = React.lazy(() => import('./pages/LearningProgress').then((m) => ({ default: m.LearningProgress })));
const AllLearningPathsPage = React.lazy(() => import('./pages/AllLearningPathsPage').then((m) => ({ default: m.AllLearningPathsPage })));
const LearningPathView = React.lazy(() => import('./pages/LearningPathView').then((m) => ({ default: m.LearningPathView })));
const ThirtyDayChecksPage = React.lazy(() => import('./pages/ThirtyDayChecksPage').then((m) => ({ default: m.ThirtyDayChecksPage })));
const LessonCompletePage = React.lazy(() => import('./pages/CompletionPage').then((m) => ({ default: m.LessonCompletePage })));
const CourseCompletePage = React.lazy(() => import('./pages/CompletionPage').then((m) => ({ default: m.CourseCompletePage })));
const RetentionInvitePage = React.lazy(() => import('./pages/CompletionPage').then((m) => ({ default: m.RetentionInvitePage })));
const RetentionCheckResultPage = React.lazy(() => import('./pages/CompletionPage').then((m) => ({ default: m.RetentionCheckResultPage })));

// Forces ActivityView to remount when the lesson changes so all state
// (completion, iframe, step progress) resets cleanly for the new sequence.
const ActivityViewRoute = () => {
  const { sequenceId = '' } = useParams<{ sequenceId: string }>();
  return <ActivityView key={sequenceId} />;
};

interface ErrorBoundaryState { hasError: boolean }

class AppErrorBoundary extends Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    logError(error, { componentStack: info.componentStack, path: window.location.pathname });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-error-wrap">
          <p className="app-error-message">Something went wrong.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="app-error-btn"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Route wrappers for system state views ─────────────────────────────────

const SessionEndedRoute = () => {
  const navigate = useNavigate();
  return <SessionEndedView onClose={() => navigate('/', { replace: true })} />;
};

const UnsupportedVersionRoute = () => {
  const navigate = useNavigate();
  return <UnsupportedVersionView onClose={() => navigate('/', { replace: true })} />;
};

// ── Global 401 interceptor ──────────────────────────────────────────────────
// Adds an axios response interceptor to the platform's authenticated client.
// On a persistent 401 (after the platform's own JWT-refresh attempt), navigates
// to /session-ended so the user sees a clear "session ended" message.

const AuthInterceptor = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const client = getAuthenticatedHttpClient();
    const interceptorId = client.interceptors.response.use(
      (response) => response,
      (err) => {
        if (
          err?.response?.status === 401
          && window.location.pathname !== '/session-ended'
        ) {
          navigate('/session-ended', { replace: true });
        }
        return Promise.reject(err);
      },
    );
    return () => {
      client.interceptors.response.eject(interceptorId);
    };
  }, [navigate]);
  return null;
};

const CourseHomeRedirect = () => {
  const { courseId } = useParams<{ courseId: string }>();
  return <Navigate to={`/course/${courseId}`} replace />;
};

// Handles LMS jump_to URLs: /course/<key>/<sequence>/<unit>
// and staff preview: /preview/course/<key>/<sequence>/<unit>
const LmsJumpToRedirect = () => {
  const { courseId = '', sequenceId = '', unitId = '' } = useParams<{
    courseId: string; sequenceId: string; unitId: string;
  }>();
  const navigate = useNavigate();
  const { units, isLoading, isError } = useSequence(sequenceId);

  // Escape hatch: if the sequence fetch hangs (no error, no response) for 8 s,
  // bail to course overview so the user is never stuck on a spinner.
  useEffect(() => {
    if (!isLoading) { return undefined; }
    const tid = window.setTimeout(() => navigate(`/course/${courseId}`, { replace: true }), 8000);
    return () => window.clearTimeout(tid);
  }, [isLoading, courseId, navigate]);

  if (isLoading) { return <LoadingSkeleton />; }
  // On error or empty sequence fall back to course overview rather than silently landing on step/0.
  if (isError || units.length === 0) { return <Navigate to={`/course/${courseId}`} replace />; }
  const idx = units.findIndex((u) => u.id === unitId);
  return <Navigate to={`/course/${courseId}/lesson/${sequenceId}/step/${idx >= 0 ? idx : 0}`} replace />;
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
      <AuthInterceptor />
      <Routes>
        <Route path="/" element={<CourseCatalog />} />
        <Route path="/courses" element={<CourseLibrary />} />
        <Route path="/progress" element={<Suspense fallback={<LoadingSkeleton />}><LearningProgress /></Suspense>} />
        <Route path="/course/:courseId" element={<CourseOverview />} />
        <Route
          path="/course/:courseId/lesson/:sequenceId/step/:unitIdx"
          element={<ActivityViewRoute />}
        />
        <Route path="/course/:courseId/lesson-complete/:sequenceId" element={<Suspense fallback={<LoadingSkeleton />}><LessonCompletePage /></Suspense>} />
        <Route path="/course/:courseId/complete" element={<Suspense fallback={<LoadingSkeleton />}><CourseCompletePage /></Suspense>} />
        <Route path="/course/:courseId/retention" element={<Suspense fallback={<LoadingSkeleton />}><RetentionInvitePage /></Suspense>} />
        <Route path="/course/:courseId/retention-result/:sequenceId" element={<Suspense fallback={<LoadingSkeleton />}><RetentionCheckResultPage /></Suspense>} />
        <Route path="/course/:courseId/resume" element={<SaveAndResumePage />} />

        <Route path="/learning-paths" element={<Suspense fallback={<LoadingSkeleton />}><AllLearningPathsPage /></Suspense>} />
        <Route path="/learning-path/:curriculumId" element={<Suspense fallback={<LoadingSkeleton />}><LearningPathView /></Suspense>} />
        <Route path="/30-day-checks" element={<Suspense fallback={<LoadingSkeleton />}><ThirtyDayChecksPage /></Suspense>} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/no-courses" element={<NoRequiredCoursesPage />} />
        <Route path="/course/:courseId/unavailable" element={<CourseNotAvailablePage />} />
        <Route path="/course/:courseId/lesson/:sequenceId/video-error" element={<VideoCouldntLoadPage />} />
        <Route path="/session-ended" element={<SessionEndedRoute />} />
        <Route path="/unsupported-version" element={<UnsupportedVersionRoute />} />
        {/* LMS-generated deep links */}
        <Route path="/course/:courseId/home" element={<CourseHomeRedirect />} />
        <Route path="/course/:courseId/progress" element={<Navigate to="/progress" replace />} />
        <Route path="/course/:courseId/dates" element={<CourseHomeRedirect />} />
        {/* LMS jump_to / courseware: /course/<key>/<sequence>/<unit> */}
        <Route path="/course/:courseId/:sequenceId/:unitId" element={<LmsJumpToRedirect />} />
        {/* Staff preview mirrors the jump_to shape under /preview/course/ */}
        <Route path="/preview/course/:courseId/:sequenceId/:unitId" element={<LmsJumpToRedirect />} />
        <Route path="/preview/course/:courseId/*" element={<CourseHomeRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
