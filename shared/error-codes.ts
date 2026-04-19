/**
 * API 錯誤碼契約（與 HTTP body 的 `errorCode` 對齊）。
 * 新業務碼請追加於 `ErrorCodes`，避免魔法字串散落前後端。
 */
export const ErrorCodes = {
  UNKNOWN: "UNKNOWN",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
