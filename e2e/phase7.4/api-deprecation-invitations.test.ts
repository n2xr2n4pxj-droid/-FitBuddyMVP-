import { describe, expect, it } from "vitest";
import request from "supertest";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const LEGACY_PATH = "/api/invitations/share-token";
const V1_PATH = "/api/v1/invitations/share-token";

describe("Phase 7.2 - invitations legacy deprecation headers", () => {
  it("legacy /api/invitations should include Deprecation headers", async () => {
    const res = await request(BASE_URL).get(LEGACY_PATH);

    expect(res.headers.deprecation).toBe("true");
    expect(res.headers.sunset).toBeDefined();
    expect(res.headers.link).toContain('/api/v1/invitations');
    expect(res.headers.link).toContain('rel="successor-version"');
  });

  it("v1 /api/v1/invitations should not include Deprecation headers", async () => {
    const res = await request(BASE_URL).get(V1_PATH);

    expect(res.headers.deprecation).toBeUndefined();
    expect(res.headers.sunset).toBeUndefined();
  });
});
