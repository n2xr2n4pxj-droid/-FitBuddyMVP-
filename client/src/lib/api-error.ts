export interface AppApiError extends Error {
  name: 'AppApiError';
  message: string;
  statusCode?: number;
  errorCode?: string;
  logId?: string;
  details?: unknown;
  isQueued?: boolean;
}

type ErrorPayload = {
  message?: unknown;
  error?: unknown;
  errorCode?: unknown;
  code?: unknown;
  logId?: unknown;
  details?: unknown;
};

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function createAppApiError(input: {
  message: string;
  statusCode?: number;
  errorCode?: string;
  logId?: string;
  details?: unknown;
  isQueued?: boolean;
}): AppApiError {
  const error = new Error(input.message) as AppApiError;
  error.name = 'AppApiError';
  error.statusCode = input.statusCode;
  error.errorCode = input.errorCode;
  error.logId = input.logId;
  error.details = input.details;
  error.isQueued = input.isQueued;
  return error;
}

export function extractErrorPayload(payload: unknown): {
  message?: string;
  errorCode?: string;
  logId?: string;
  details?: unknown;
} {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const record = payload as ErrorPayload;
  return {
    message: asString(record.message) ?? asString(record.error),
    errorCode: asString(record.errorCode) ?? asString(record.code),
    logId: asString(record.logId),
    details: record.details,
  };
}
