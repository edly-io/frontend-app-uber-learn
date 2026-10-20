/**
 * Unit/integration tests for the CourseCatalog page.
 *
 * Strategy: mock all API functions and hooks so the component renders
 * synchronously (or resolves immediately with test fixtures) without
 * real HTTP calls.
 *
 * AC coverage:
 *   - CC-LOADING:       loading skeleton shown while courses query is in-flight
 *   - CC-ERROR:         ErrorView shown when courses query fails
 *   - CC-EMPTY:         navigates to /no-courses when no courses enrolled (HOME-010)
 *   - CC-ENROLLED:      Continue card shown when courses are enrolled
 *   - CC-STAT-POINTS:   points stat chip renders with lifetime_points value from gamification
 *   - CC-STAT-STREAK:   streak stat chip renders with current_streak_weeks value
 *   - CC-STAT-BADGES:   badge stat chip renders "0" when no badge data
 *   - CC-NAV-POINTS:    clicking points chip navigates to /progress with { tab: 'Points' }
 *   - CC-NAV-STREAK:    clicking streak chip navigates to /progress with { tab: 'Streak' }
 *   - CC-NAV-BADGES:    clicking badges chip navigates to /progress with { tab: 'Badges' }
 *   - CC-PATHS-SHOWN:   "Your learning paths" section visible when curriculums is non-empty
 *   - CC-PATHS-HIDDEN:  "Your learning paths" section absent when curriculums is empty
 *   - CC-THIS-WEEK:     "This week" section always visible
 *   - CC-OPTIONAL:      Optional courses section (hidden when empty or failed,
 *                       cards, open/enroll on tap, enroll errors,
 *                       `?section=optional` scroll, no /no-courses redirect
 *                       while optional courses are on offer)
 */
import React from 'react';
import {
  render, screen, fireEvent, waitFor, within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CourseCatalog } from '../pages/CourseCatalog';
import type { LearnerCurriculum } from '../api/curriculum';
import type { LearnCourse } from '../api/learn';
import type { OptionalCourse } from '../api/optionalCourses';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Learn API — getLearnCourses returns every enrolled course with its progress in one call
jest.mock('../api/learn', () => ({
  getLearnCourses: jest.fn(),
}));

// Courseware API — getResumeBlock is called inside ConnectedContinueCard
jest.mock('../api/courseware', () => ({
  getResumeBlock: jest.fn().mockResolvedValue(null),
}));

// Curriculum API — getLastActivity drives which course the continue card features
const mockGetLastActivity = jest.fn();
jest.mock('../api/curriculum', () => ({
  getLastActivity: (...args: unknown[]) => mockGetLastActivity(...args),
}));

// Optional courses API — the list and the enroll POST; the error-code reader stays real
const mockGetOptionalCourses = jest.fn();
const mockEnrollInOptionalCourse = jest.fn();
jest.mock('../api/optionalCourses', () => ({
  ...jest.requireActual('../api/optionalCourses'),
  getOptionalCourses: (...args: unknown[]) => mockGetOptionalCourses(...args),
  enrollInOptionalCourse: (...args: unknown[]) => mockEnrollInOptionalCourse(...args),
}));

// Mock the three hook-based data sources used in the page header/body
const mockUseGamification = jest.fn();
const mockUseCurriculums = jest.fn();
const mockUseBadges = jest.fn();
const mockUseCourseOutline = jest.fn();
const mockUseSequence = jest.fn();

jest.mock('../hooks/useGamification', () => ({
  useGamification: (...args: unknown[]) => mockUseGamification(...args),
}));
jest.mock('../hooks/useCurriculums', () => ({
  useCurriculums: (...args: unknown[]) => mockUseCurriculums(...args),
}));
jest.mock('../hooks/useBadges', () => ({
  useBadges: (...args: unknown[]) => mockUseBadges(...args),
}));
jest.mock('../hooks/useCourseOutline', () => ({
  useCourseOutline: (...args: unknown[]) => mockUseCourseOutline(...args),
}));
jest.mock('../hooks/useSequence', () => ({
  useSequence: (...args: unknown[]) => mockUseSequence(...args),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COURSE: LearnCourse = {
  courseId: 'course-v1:Uber+Safety+2026',
  title: 'Road safety fundamentals',
  imageUrl: null,
  courseStart: null,
  courseEnd: null,
  lessonCount: 0,
  completedLessons: 0,
  progress: 0,
  nextLesson: null,
  status: 'not_started',
  curriculum: null,
  lastActivity: null,
  points: 0,
};

const CURRICULUM: LearnerCurriculum = {
  uuid: 'curr-1',
  title: 'New driver onboarding',
  description: '',
  image_url: null,
  assigned_at: '2026-01-01T00:00:00Z',
  courses: [],
  courses_finished: 1,
  courses_total: 3,
  milestones: {
    complete: { reached_at: null, badge: null },
    retained: { reached_at: null, badge: null },
  },
  knowledge_check: {
    course_id: 'kc-1', display_name: null, exists: true, unlocks_at: null, is_open: false,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Each test gets a fresh QueryClient to prevent cache bleed-through
const makeQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: 0 } },
});

function renderComponent(qc = makeQueryClient(), initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={qc}>
        <CourseCatalog />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function getLearnMock() {
  // eslint-disable-next-line global-require
  return jest.requireMock('../api/learn') as { getLearnCourses: jest.Mock };
}

function setDefaultMocks() {
  getLearnMock().getLearnCourses.mockResolvedValue([]);
  mockUseGamification.mockReturnValue({ data: undefined });
  mockUseCurriculums.mockReturnValue({ data: [] });
  mockUseBadges.mockReturnValue({ data: undefined });
  mockUseCourseOutline.mockReturnValue({ data: null });
  mockUseSequence.mockReturnValue({ units: [] });
  mockGetLastActivity.mockResolvedValue({ course: null });
  mockGetOptionalCourses.mockResolvedValue([]);
  mockEnrollInOptionalCourse.mockResolvedValue(undefined);
}

const makeCourse = (courseId: string, title: string): LearnCourse => ({
  ...COURSE, courseId, title,
});

const makeCurriculumCourse = (courseId: string, position: number, finished: boolean) => ({
  course_id: courseId,
  display_name: null,
  exists: true,
  position,
  finished,
  description: null,
  image_url: null,
});

async function clickContinueCard() {
  const btn = await screen.findByRole('button', { name: /^(Continue|Start)$/ });
  fireEvent.click(btn);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockNavigate.mockClear();
  jest.clearAllMocks();
  setDefaultMocks();
});

describe('CourseCatalog', () => {
  describe('CC-LOADING: loading state', () => {
    it('shows loading skeleton while courses query is in-flight', () => {
      // Never-resolving promise keeps the query in "loading" state
      getLearnMock().getLearnCourses.mockReturnValue(new Promise(() => {}));
      renderComponent();
      expect(screen.getByLabelText('Loading…')).toBeInTheDocument();
    });
  });

  describe('CC-ERROR: error state', () => {
    it('shows ErrorView when courses query rejects', async () => {
      getLearnMock().getLearnCourses.mockRejectedValue(new Error('Network failure'));
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/We could not retrieve your enrolled courses/i)).toBeInTheDocument();
      });
      // Retry button must be present
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  describe('CC-EMPTY: empty state (no enrolled courses) — HOME-010', () => {
    it('navigates to /no-courses when enrolled courses list is empty after loading', async () => {
      getLearnMock().getLearnCourses.mockResolvedValue([]);
      renderComponent();
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/no-courses', { replace: true });
      });
    });

    it('does not show the Continue card when no courses are enrolled', async () => {
      getLearnMock().getLearnCourses.mockResolvedValue([]);
      renderComponent();
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/no-courses', { replace: true });
      });
      // The Continue card renders "Continue" or "Start" button — should be absent
      expect(screen.queryByText('Continue')).not.toBeInTheDocument();
      expect(screen.queryByText('Start')).not.toBeInTheDocument();
    });
  });

  describe('CC-ENROLLED: enrolled courses', () => {
    it('shows a Continue/Start button when at least one course is enrolled', async () => {
      getLearnMock().getLearnCourses.mockResolvedValue([COURSE]);
      renderComponent();
      await waitFor(() => {
        // ConnectedContinueCard renders either "Continue" or "Start"
        const btn = screen.queryByText('Continue') ?? screen.queryByText('Start');
        expect(btn).toBeInTheDocument();
      });
    });
  });

  describe('CC-CONTINUE-PICK: which course the continue card features', () => {
    const DEMO = makeCourse('course-v1:OpenedX+DemoX+DemoCourse', 'Open edX Demo Course');
    const CON101 = makeCourse('course-v1:uber+CON101+2026', 'Code of Business Conduct');
    const CON102 = makeCourse('course-v1:uber+CON102+2026', 'Business Ethics');
    const SAF101 = makeCourse('course-v1:uber+SAF101+2026', 'Workplace Safety 101');

    const conductPath = (con101Finished: boolean): LearnerCurriculum => ({
      ...CURRICULUM,
      uuid: 'conduct',
      title: 'Business Conduct & Ethics',
      assigned_at: '2026-09-23T05:49:19Z',
      courses: [
        makeCurriculumCourse(CON101.courseId, 1, con101Finished),
        makeCurriculumCourse(CON102.courseId, 2, false),
      ],
      courses_finished: con101Finished ? 1 : 0,
      courses_total: 2,
    });
    // Assigned more recently than the conduct path but never touched.
    const safetyPath: LearnerCurriculum = {
      ...CURRICULUM,
      uuid: 'safety',
      title: 'Workplace Safety',
      assigned_at: '2026-09-30T05:49:19Z',
      courses: [makeCurriculumCourse(SAF101.courseId, 1, false)],
      courses_finished: 0,
      courses_total: 1,
    };

    it('does not feature a course outside every learning path just because the API lists it first', async () => {
      getLearnMock().getLearnCourses.mockResolvedValue([DEMO, CON101, CON102]);
      mockUseCurriculums.mockReturnValue({ data: [conductPath(true)] });
      renderComponent();
      await clickContinueCard();
      expect(mockNavigate).not.toHaveBeenCalledWith(`/course/${DEMO.courseId}`, expect.anything());
      expect(mockNavigate).toHaveBeenCalledWith(`/course/${CON102.courseId}`, { state: { origin: '/' } });
    });

    it('features the last-activity course when it is not finished, over a newer untouched path', async () => {
      getLearnMock().getLearnCourses.mockResolvedValue([DEMO, CON101, CON102, SAF101]);
      mockUseCurriculums.mockReturnValue({ data: [conductPath(false), safetyPath] });
      mockGetLastActivity.mockResolvedValue({
        course: {
          course_id: CON101.courseId,
          display_name: CON101.title,
          last_activity_at: '2026-10-14T06:59:24Z',
          curriculum_ids: ['conduct'],
        },
      });
      renderComponent();
      await waitFor(() => expect(mockGetLastActivity).toHaveBeenCalled());
      await clickContinueCard();
      expect(mockNavigate).toHaveBeenCalledWith(`/course/${CON101.courseId}`, { state: { origin: '/' } });
    });
  });

  describe('CC-STAT: stat chips in header', () => {
    it('CC-STAT-POINTS: shows lifetime_points value from gamification', async () => {
      mockUseGamification.mockReturnValue({
        data: {
          lifetime_points: 42,
          current_streak_weeks: 0,
          this_week: null,
          courses: [],
        },
      });
      getLearnMock().getLearnCourses.mockResolvedValue([]);
      renderComponent();
      await waitFor(() => {
        expect(screen.getByLabelText(/42 points/i)).toBeInTheDocument();
      });
    });

    it('CC-STAT-STREAK: shows current_streak_weeks value from gamification', async () => {
      mockUseGamification.mockReturnValue({
        data: {
          lifetime_points: 0,
          current_streak_weeks: 3,
          this_week: null,
          courses: [],
        },
      });
      getLearnMock().getLearnCourses.mockResolvedValue([]);
      renderComponent();
      await waitFor(() => {
        expect(screen.getByLabelText(/3-week streak/i)).toBeInTheDocument();
      });
    });

    it('CC-STAT-BADGES: shows "0" when no badge data is present', async () => {
      mockUseBadges.mockReturnValue({ data: undefined });
      getLearnMock().getLearnCourses.mockResolvedValue([]);
      renderComponent();
      await waitFor(() => {
        expect(screen.getByLabelText(/0 badges earned/i)).toBeInTheDocument();
      });
    });
  });

  describe('CC-NAV: stat chip navigation', () => {
    it('CC-NAV-POINTS: clicking points chip navigates to /progress with { tab: "Points" }', async () => {
      getLearnMock().getLearnCourses.mockResolvedValue([]);
      renderComponent();
      await waitFor(() => screen.getByLabelText(/points — view points/i));
      fireEvent.click(screen.getByLabelText(/points — view points/i));
      expect(mockNavigate).toHaveBeenCalledWith('/progress', { state: { tab: 'Points' } });
    });

    it('CC-NAV-STREAK: clicking streak chip navigates to /progress with { tab: "Streak" }', async () => {
      getLearnMock().getLearnCourses.mockResolvedValue([]);
      renderComponent();
      await waitFor(() => screen.getByLabelText(/streak — view streak/i));
      fireEvent.click(screen.getByLabelText(/streak — view streak/i));
      expect(mockNavigate).toHaveBeenCalledWith('/progress', { state: { tab: 'Streak' } });
    });

    it('CC-NAV-BADGES: clicking badges chip navigates to /progress with { tab: "Badges" }', async () => {
      getLearnMock().getLearnCourses.mockResolvedValue([]);
      renderComponent();
      await waitFor(() => screen.getByLabelText(/badges earned — view badges/i));
      fireEvent.click(screen.getByLabelText(/badges earned — view badges/i));
      expect(mockNavigate).toHaveBeenCalledWith('/progress', { state: { tab: 'Badges' } });
    });
  });

  describe('CC-PATHS: learning paths section', () => {
    it('CC-PATHS-SHOWN: "Your learning paths" section is visible when curriculums is non-empty', async () => {
      mockUseCurriculums.mockReturnValue({ data: [CURRICULUM] });
      // Use an enrolled course so the page does not redirect to /no-courses
      getLearnMock().getLearnCourses.mockResolvedValue([COURSE]);
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Your learning paths')).toBeInTheDocument();
        expect(screen.getByText('New driver onboarding')).toBeInTheDocument();
      });
    });

    it('CC-PATHS-HIDDEN: "Your learning paths" section absent when curriculums is empty', async () => {
      mockUseCurriculums.mockReturnValue({ data: [] });
      // Use an enrolled course so the page does not redirect to /no-courses
      getLearnMock().getLearnCourses.mockResolvedValue([COURSE]);
      renderComponent();
      await waitFor(() => {
        // The Continue card is present once the enrolled course is loaded
        const btn = screen.queryByText('Continue') ?? screen.queryByText('Start');
        expect(btn).toBeInTheDocument();
      });
      expect(screen.queryByText('Your learning paths')).not.toBeInTheDocument();
    });
  });

  describe('CC-THIS-WEEK: This week section', () => {
    it('CC-THIS-WEEK: "This week" section is always visible (even with no API data)', async () => {
      // Use an enrolled course so the page does not redirect to /no-courses
      getLearnMock().getLearnCourses.mockResolvedValue([COURSE]);
      renderComponent();
      await waitFor(() => {
        const btn = screen.queryByText('Continue') ?? screen.queryByText('Start');
        expect(btn).toBeInTheDocument();
      });
      expect(screen.getByText('This week')).toBeInTheDocument();
    });
  });
});

describe('CC-OPTIONAL: Optional courses section', () => {
  const OPTIONAL_NEW: OptionalCourse = {
    course_id: 'course-v1:Uber+OPT101+2026',
    display_name: 'Night driving tips',
    short_description: 'Stay safe after dark.',
    image_url: null,
    is_enrolled: false,
    groups: [{ slug: 'night', title: 'Night drivers' }],
  };
  const OPTIONAL_ENROLLED: OptionalCourse = {
    course_id: 'course-v1:Uber+OPT102+2026',
    display_name: 'Airport pickups',
    short_description: 'Find riders fast at the airport.',
    image_url: 'https://cdn.example/airport.png',
    is_enrolled: true,
    groups: [],
  };

  /** An axios-style error carrying an HTTP response. */
  const httpError = (status: number, data: unknown) => Object.assign(
    new Error(`Request failed with status code ${status}`),
    { response: { status, data } },
  );

  const findSection = async () => {
    await screen.findByRole('heading', { name: 'Optional courses' });
    return document.getElementById('optional-courses') as HTMLElement;
  };

  const scrollIntoView = jest.fn();
  let originalScrollIntoView: typeof Element.prototype.scrollIntoView;

  beforeAll(() => {
    originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  afterAll(() => {
    Element.prototype.scrollIntoView = originalScrollIntoView;
  });

  beforeEach(() => {
    scrollIntoView.mockClear();
    getLearnMock().getLearnCourses.mockResolvedValue([COURSE]);
  });

  it('is hidden when no optional courses are offered', async () => {
    renderComponent();
    await waitFor(() => expect(mockGetOptionalCourses).toHaveBeenCalled());
    await screen.findByRole('button', { name: /^(Continue|Start)$/ });
    expect(screen.queryByText('Optional courses')).not.toBeInTheDocument();
    expect(document.getElementById('optional-courses')).toBeNull();
  });

  it('is hidden, and home still renders, when the request fails', async () => {
    mockGetOptionalCourses.mockRejectedValue(new Error('Network failure'));
    renderComponent();
    await screen.findByRole('button', { name: /^(Continue|Start)$/ });
    await waitFor(() => expect(mockGetOptionalCourses).toHaveBeenCalled());
    expect(screen.queryByText('Optional courses')).not.toBeInTheDocument();
    expect(screen.getByText('This week')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'See all courses' })).toBeInTheDocument();
  });

  it('renders a card for every optional course, with its status', async () => {
    mockGetOptionalCourses.mockResolvedValue([OPTIONAL_NEW, OPTIONAL_ENROLLED]);
    renderComponent();
    const section = await findSection();

    expect(section).toHaveAttribute('id', 'optional-courses');
    expect(within(section).getAllByRole('listitem')).toHaveLength(2);
    const startCard = within(section).getByRole('button', { name: 'Start Night driving tips' });
    expect(startCard).toHaveTextContent('Night drivers');
    expect(startCard).toHaveTextContent('Stay safe after dark.');
    expect(startCard).toHaveTextContent('Start');
    const enrolledCard = within(section).getByRole('button', { name: 'Open Airport pickups' });
    expect(enrolledCard).toHaveTextContent('Enrolled');
    expect(enrolledCard.querySelector('img.course-tile__image')).toHaveAttribute('src', OPTIONAL_ENROLLED.image_url);
    // No image: falls back to the deterministic course art.
    expect(startCard.querySelector('img.course-tile__art')).not.toBeNull();
  });

  it('is placed after the learning paths and before the All courses card', async () => {
    mockUseCurriculums.mockReturnValue({ data: [CURRICULUM] });
    mockGetOptionalCourses.mockResolvedValue([OPTIONAL_NEW]);
    renderComponent();
    const section = await findSection();

    const paths = screen.getByText('Your learning paths');
    const allCourses = screen.getByRole('button', { name: 'See all courses' });
    // eslint-disable-next-line no-bitwise
    expect(paths.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // eslint-disable-next-line no-bitwise
    expect(section.compareDocumentPosition(allCourses) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('opens an enrolled course without enrolling', async () => {
    mockGetOptionalCourses.mockResolvedValue([OPTIONAL_ENROLLED]);
    renderComponent();
    await findSection();

    fireEvent.click(screen.getByRole('button', { name: 'Open Airport pickups' }));

    expect(mockNavigate).toHaveBeenCalledWith(`/course/${OPTIONAL_ENROLLED.course_id}`, { state: { origin: '/' } });
    expect(mockEnrollInOptionalCourse).not.toHaveBeenCalled();
  });

  it('enrolls in a course that is not enrolled, refetches, then opens it', async () => {
    mockGetOptionalCourses.mockResolvedValue([OPTIONAL_NEW]);
    let finishEnroll: () => void = () => {};
    mockEnrollInOptionalCourse.mockReturnValue(new Promise<void>((resolve) => { finishEnroll = resolve; }));
    renderComponent();
    await findSection();
    const learnCalls = getLearnMock().getLearnCourses.mock.calls.length;
    const optionalCalls = mockGetOptionalCourses.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'Start Night driving tips' }));

    // Pending: the tapped card says so and cannot be tapped again.
    const card = await screen.findByRole('button', { name: 'Start Night driving tips' });
    await waitFor(() => expect(card).toHaveTextContent('Starting…'));
    expect(card).toHaveAttribute('aria-busy', 'true');
    expect(card).toBeDisabled();
    expect(mockEnrollInOptionalCourse).toHaveBeenCalledTimes(1);
    expect(mockEnrollInOptionalCourse.mock.calls[0][0]).toBe(OPTIONAL_NEW.course_id);
    expect(mockNavigate).not.toHaveBeenCalledWith(`/course/${OPTIONAL_NEW.course_id}`, expect.anything());

    finishEnroll();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(`/course/${OPTIONAL_NEW.course_id}`, { state: { origin: '/' } });
    });
    // The enrolled courses and the optional courses were refetched first.
    expect(getLearnMock().getLearnCourses.mock.calls.length).toBeGreaterThan(learnCalls);
    expect(mockGetOptionalCourses.mock.calls.length).toBeGreaterThan(optionalCalls);
  });

  it.each([
    [httpError(404, { error_code: 'not_optional_for_learner' }), 'This course is no longer offered to you.'],
    [httpError(403, { error_code: 'enrollment_not_allowed' }), "You can't start this course yet."],
    [httpError(500, '<html></html>'), "We couldn't start this course. Check your connection and try again."],
  ])('shows an inline error and stays on home when enrolling fails (%#)', async (error, message) => {
    mockGetOptionalCourses.mockResolvedValue([OPTIONAL_NEW]);
    mockEnrollInOptionalCourse.mockRejectedValue(error);
    renderComponent();
    const section = await findSection();

    fireEvent.click(screen.getByRole('button', { name: 'Start Night driving tips' }));

    const alert = await within(section).findByRole('alert');
    expect(alert).toHaveTextContent('Night driving tips');
    expect(alert).toHaveTextContent(message);
    expect(mockNavigate).not.toHaveBeenCalledWith(`/course/${OPTIONAL_NEW.course_id}`, expect.anything());
    // The card is usable again.
    expect(screen.getByRole('button', { name: 'Start Night driving tips' })).toBeEnabled();
  });

  it('scrolls the section into view once on ?section=optional and drops the parameter', async () => {
    mockGetOptionalCourses.mockResolvedValue([OPTIONAL_NEW]);
    renderComponent(makeQueryClient(), '/?section=optional');
    const section = await findSection();

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    expect(scrollIntoView.mock.contexts[0]).toBe(section);
    expect(mockNavigate).toHaveBeenCalledWith({ search: '' }, { replace: true });

    // Later renders (e.g. a refetch) do not scroll again.
    fireEvent.click(screen.getByRole('button', { name: 'Start Night driving tips' }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(
      `/course/${OPTIONAL_NEW.course_id}`,
      { state: { origin: '/' } },
    ));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('keeps other query parameters when it drops section', async () => {
    mockGetOptionalCourses.mockResolvedValue([OPTIONAL_NEW]);
    renderComponent(makeQueryClient(), '/?utm=uber&section=optional');
    await findSection();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ search: '?utm=uber' }, { replace: true }));
  });

  it('does not scroll without ?section=optional', async () => {
    mockGetOptionalCourses.mockResolvedValue([OPTIONAL_NEW]);
    renderComponent();
    await findSection();

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalledWith(
      expect.objectContaining({ search: expect.anything() }),
      expect.anything(),
    );
  });

  it('does not redirect to /no-courses when optional courses are offered', async () => {
    getLearnMock().getLearnCourses.mockResolvedValue([]);
    mockGetOptionalCourses.mockResolvedValue([OPTIONAL_NEW]);
    renderComponent(makeQueryClient(), '/?section=optional');
    const section = await findSection();

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    expect(section).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalledWith('/no-courses', expect.anything());
  });

  it('waits for the optional courses before redirecting to /no-courses', async () => {
    getLearnMock().getLearnCourses.mockResolvedValue([]);
    let resolveOptional: (courses: OptionalCourse[]) => void = () => {};
    mockGetOptionalCourses.mockReturnValue(new Promise((resolve) => { resolveOptional = resolve; }));
    renderComponent();
    await waitFor(() => expect(getLearnMock().getLearnCourses).toHaveBeenCalled());
    await screen.findByText('This week');
    expect(mockNavigate).not.toHaveBeenCalledWith('/no-courses', expect.anything());

    resolveOptional([]);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/no-courses', { replace: true }));
  });

  it('still redirects to /no-courses when the optional-courses request fails', async () => {
    getLearnMock().getLearnCourses.mockResolvedValue([]);
    mockGetOptionalCourses.mockRejectedValue(new Error('Network failure'));
    renderComponent();

    // useOptionalCourses retries once (after about a second) before failing.
    await waitFor(
      () => expect(mockNavigate).toHaveBeenCalledWith('/no-courses', { replace: true }),
      { timeout: 4000 },
    );
  });
});
