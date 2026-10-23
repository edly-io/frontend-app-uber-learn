import { endsSession, isSessionEndedPath, NOT_ENROLLED_BODY } from '../lib/session';

const failure = (status: number, data?: unknown) => ({ response: { status, data } });

describe('endsSession', () => {
  it('treats a 401 as a lost session', () => {
    expect(endsSession(failure(401, { detail: 'Authentication credentials were not provided.' }))).toBe(true);
    expect(endsSession(failure(401))).toBe(true);
  });

  it("leaves the course home APIs' not-enrolled 401 to the page", () => {
    expect(endsSession(failure(401, NOT_ENROLLED_BODY))).toBe(false);
  });

  it('ignores other statuses and errors without a response', () => {
    expect(endsSession(failure(403))).toBe(false);
    expect(endsSession(failure(404, NOT_ENROLLED_BODY))).toBe(false);
    expect(endsSession(new Error('Network Error'))).toBe(false);
    expect(endsSession(null)).toBe(false);
    expect(endsSession(undefined)).toBe(false);
  });
});

describe('isSessionEndedPath', () => {
  it('matches the session-ended page under any base path', () => {
    expect(isSessionEndedPath('/session-ended')).toBe(true);
    expect(isSessionEndedPath('/uber-learn/session-ended')).toBe(true);
    expect(isSessionEndedPath('/uber-learn/course/course-v1:Uber+Demo+2026')).toBe(false);
  });
});
