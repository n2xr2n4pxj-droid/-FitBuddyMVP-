import { describe, expect, it } from "vitest";
import request from "supertest";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";

describe("Phase 7.2 - auth verify-email deprecation headers", () => {
  it("legacy /api/auth/verify-email should include Deprecation headers", async () => {
    const res = await request(BASE_URL).get("/api/auth/verify-email/invalid-token");

    expect(res.headers.deprecation).toBe("true");
    expect(res.headers.sunset).toBeDefined();
    expect(res.headers.link).toContain("/api/v1/auth/verify-email");
  });

  it("v1 /api/v1/auth/verify-email should not include Deprecation headers", async () => {
    const res = await request(BASE_URL).get("/api/v1/auth/verify-email/invalid-token");

    expect(res.headers.deprecation).toBeUndefined();
    expect(res.headers.sunset).toBeUndefined();
  });
});
