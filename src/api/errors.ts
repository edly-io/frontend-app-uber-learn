/**
 * Custom error classes for the Uber Learn Progress API.
 * Two sibling error types live here together; the max-classes-per-file rule is
 * intentionally suppressed because splitting a two-class error module is busywork.
 */
/* eslint-disable max-classes-per-file */

export class CooldownError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super('Assessment is on cooldown');
    this.name = 'CooldownError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class AlreadyPassedError extends Error {
  constructor() {
    super('Assessment already passed');
    this.name = 'AlreadyPassedError';
  }
}

export class AssessmentIncompleteError extends Error {
  constructor() {
    super('Answer all questions before submitting');
    this.name = 'AssessmentIncompleteError';
  }
}
