import { describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const PROTECTED_PATH = "/api/auth/me";
const JWT_SECRET = process.env.JWT_SECRET ?? "test-secret";

function expectUnauthorized(res: request.Response) {
  expect(res.status).toBe(401);
}

describe("Phase 7.4 - auth token hardening", () => {
  it("expired token should be rejected", async () => {
    const expiredToken = jwt.sign(
      { sub: "user-expired", email: "expired@fitbuddy.test" },
      JWT_SECRET,
      { expiresIn: -1 },
    );

    const res = await request(BASE_URL)
      .get(PROTECTED_PATH)
      .set("Authorization", `Bearer ${expiredToken}`);

    expectUnauthorized(res);
  });

  it("forged signature token should be rejected", async () => {
    const forgedToken = jwt.sign(
      { sub: "attacker", email: "attacker@evil.test" },
      "wrong-secret-for-forged-token",
      { expiresIn: "1h" },
    );

    const res = await request(BASE_URL)
      .get(PROTECTED_PATH)
      .set("Authorization", `Bearer ${forgedToken}`);

    expectUnauthorized(res);
  });

  it("malformed token should be rejected", async () => {
    const res = await request(BASE_URL)
      .get(PROTECTED_PATH)
      .set("Authorization", "Bearer not-a-jwt-token");

    expectUnauthorized(res);
  });

  it("missing authorization header should be rejected", async () => {
    const res = await request(BASE_URL).get(PROTECTED_PATH);
    expectUnauthorized(res);
  });

  it("alg none token should be rejected", async () => {
    const header = Buffer.from(
      JSON.stringify({ alg: "none", typ: "JWT" }),
      "utf8",
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({ sub: "admin", email: "admin@fitbuddy.test" }),
      "utf8",
    ).toString("base64url");
    const noneToken = `${header}.${payload}.`;

    const res = await request(BASE_URL)
      .get(PROTECTED_PATH)
      .set("Authorization", `Bearer ${noneToken}`);

    expectUnauthorized(res);
  });
});
