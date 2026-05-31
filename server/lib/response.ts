/**
 * @file server/lib/response.ts
 * @description Standardized response helpers for Express routes.
 * Ensures all API responses follow the unified Error Contract.
 */

import { Response } from "express";
import { randomUUID } from "crypto";
import type { ErrorCode } from "@shared/error-codes";
import type { ApiErrorPayload } from "@shared/types/api";

/**
 * Sends a standardized successful JSON response.
 * @param res Express Response object
 * @param data The payload to be returned
 * @param status HTTP status code (default: 200)
 */
export function sendSuccess<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({
    success: true,
    data,
  });
}

/**
 * Sends a standardized error JSON response.
 * Automatically handles logId generation for 5xx errors and structured logging.
 * @param res Express Response object
 * @param status HTTP status code
 * @param errorCode The business error code from `ErrorCodes` / `ErrorCode`
 * @param message Human-readable error message
 * @param options Additional context (logId, details)
 */
export function sendError(
  res: Response,
  status: number,
  errorCode: ErrorCode | string,
  message: string,
  options?: { logId?: string; details?: Record<string, unknown> },
): void {
  // 1. Handle Log ID: Generate a new one for server errors if not provided
  const logId = options?.logId ?? (status >= 500 ? randomUUID() : undefined);

  // 2. Structured Logging for Server Errors (Observability)
  if (status >= 500) {
    console.error(
      JSON.stringify({
        event: "api_error",
        errorCode,
        message,
        logId,
        status,
        ts: new Date().toISOString(),
      }),
    );
  }

  // 2.5 Provide metadata for global security-event aggregation middleware.
  res.locals.securityMeta = {
    status,
    errorCode: String(errorCode),
    logId,
  };

  // 3. Construct the standardized error payload (Flat Shape)
  const body: ApiErrorPayload = {
    success: false,
    errorCode,
    message,
    ...(logId ? { logId } : {}),
    ...(options?.details ? { details: options.details } : {}),
  };

  res.status(status).json(body);
}
