// The API answers 429 once a sign-in, signup, or password attempt limit is hit - callers show a
// "wait and retry" message instead of implying the credentials were wrong.
export const isRateLimitedError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { status?: unknown }).status === 429;

export const RATE_LIMITED_MESSAGE = 'Too many attempts. Please wait a few minutes and try again.';
