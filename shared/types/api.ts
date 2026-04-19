import type { ErrorCode } from "../error-codes";

/**
 * 標準化 API 錯誤 JSON body（第 5 項契約，含 `success: false` 與選用欄位）。
 */
export interface ApiErrorPayload {
  success: false;
  errorCode: ErrorCode | string;
  message: string;
  logId?: string;
  details?: Record<string, unknown>;
}
