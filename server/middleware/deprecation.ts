import type { NextFunction, Request, Response } from "express";

function toSunsetHttpDate(sunsetDate: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(sunsetDate)) {
    return new Date(`${sunsetDate}T23:59:59Z`).toUTCString();
  }
  return new Date(sunsetDate).toUTCString();
}

/**
 * 在 response 加入標準 deprecation headers，行為不變。
 *
 * @param successorPath 新路徑（絕對路徑，供 Link header 使用）
 * @param sunsetDate ISO 日期 `YYYY-MM-DD`（日末 UTC）或完整 HTTP-date
 */
export function deprecationMiddleware(successorPath: string, sunsetDate: string) {
  const sunsetHeader = toSunsetHttpDate(sunsetDate);

  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Deprecation", "true");
    res.setHeader("Sunset", sunsetHeader);
    res.setHeader("Link", `<${successorPath}>; rel="successor-version"`);
    next();
  };
}

export const INVITATIONS_LEGACY_SUNSET = "2026-09-01";
