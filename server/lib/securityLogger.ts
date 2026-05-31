import { randomUUID } from "crypto";

export type SecurityEventType =
  | "auth_unauthorized"
  | "auth_forbidden"
  | "rate_limited"
  | "server_error";

export interface SecurityEvent {
  eventType: SecurityEventType;
  status: number;
  errorCode: string;
  logId: string;
  path: string;
  method: string;
  userId?: string;
  ip?: string;
  ts: string;
}

export function deriveSecurityEventType(status: number): SecurityEventType {
  if (status === 401) return "auth_unauthorized";
  if (status === 403) return "auth_forbidden";
  if (status === 429) return "rate_limited";
  return "server_error";
}

export function emitSecurityEvent(
  event: Omit<SecurityEvent, "ts" | "logId" | "eventType"> & {
    eventType?: SecurityEventType;
    logId?: string;
  },
): void {
  const entry: SecurityEvent = {
    eventType: event.eventType ?? deriveSecurityEventType(event.status),
    status: event.status,
    errorCode: event.errorCode,
    logId: event.logId ?? randomUUID(),
    path: event.path,
    method: event.method,
    userId: event.userId,
    ip: event.ip,
    ts: new Date().toISOString(),
  };

  const line = JSON.stringify(entry);
  if (entry.status >= 500) {
    console.error(line);
  } else {
    console.warn(line);
  }
}
