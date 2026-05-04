import type { AppApiError } from './api-error';

export function isUnauthorizedError(error: unknown): boolean {
  if (error instanceof Error && error.name === 'AppApiError') {
    return (error as AppApiError).statusCode === 401;
  }
  if (error instanceof Error) {
    return /^401/.test(error.message);
  }
  return false;
}
