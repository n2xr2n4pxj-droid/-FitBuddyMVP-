import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { inArray } from "drizzle-orm";
import { db } from "../../server/db";
import { users } from "../../server/db/schema";
import { createUser } from "../../server/db/queries";
import { hashPassword } from "../../server/replitAuth";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const REFRESH_COOKIE_NAME = "fitbuddy_refresh_token";
const TEST_PASSWORD = "E2eRefreshCookie!123";

const createdEmails: string[] = [];

function findRefreshCookie(
  setCookie: string | string[] | undefined,
): string | undefined {
  if (!setCookie) return undefined;
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  return cookies.find((entry) => entry.startsWith(`${REFRESH_COOKIE_NAME}=`));
}

describe("Phase 7.4 - refresh token HttpOnly cookie", () => {
  let email = "";
  const password = TEST_PASSWORD;

  beforeAll(async () => {
    email = `phase74-refresh-cookie-${Date.now()}@fitbuddy.test`;
    createdEmails.push(email);
    await createUser({
      email,
      passwordHash: hashPassword(password),
      firstName: "E2E",
      lastName: "RefreshCookie",
      role: "USER",
      emailVerified: true,
    });
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await db.delete(users).where(inArray(users.email, createdEmails));
    }
  });

  it("covers login cookie, refresh, logout, and body fallback in one login session", async () => {
    const noCookieRes = await request(BASE_URL).post("/api/auth/refresh").send({});
    expect(noCookieRes.status).toBe(401);

    const agent = request.agent(BASE_URL);
    const loginRes = await agent
      .post("/api/auth/login")
      .send({ email, password })
      .expect(200);

    expect(loginRes.body.token).toBeDefined();
    expect(loginRes.body.refreshToken).toBeUndefined();

    const refreshCookie = findRefreshCookie(loginRes.headers["set-cookie"]);
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain("HttpOnly");

    const tokenMatch = refreshCookie!.match(
      new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`),
    );
    expect(tokenMatch?.[1]).toBeDefined();
    const refreshJwt = decodeURIComponent(tokenMatch![1]);

    const refreshRes = await agent.post("/api/auth/refresh").send({}).expect(200);
    expect(refreshRes.body.token).toBeDefined();
    expect(refreshRes.body.refreshToken).toBeUndefined();
    expect(findRefreshCookie(refreshRes.headers["set-cookie"])).toBeDefined();

    const bodyOnlyRes = await request(BASE_URL)
      .post("/api/auth/refresh")
      .send({ refreshToken: refreshJwt })
      .expect(200);
    expect(bodyOnlyRes.body.token).toBeDefined();
    expect(bodyOnlyRes.body.refreshToken).toBeUndefined();

    const logoutRes = await agent.post("/api/auth/logout").send({}).expect(200);
    expect(logoutRes.body.success).toBe(true);

    const cleared = findRefreshCookie(logoutRes.headers["set-cookie"]);
    if (cleared) {
      expect(cleared).toMatch(/Max-Age=0|Expires=/i);
    }

    const afterLogoutRefresh = await agent.post("/api/auth/refresh").send({});
    expect(afterLogoutRefresh.status).toBe(401);
  });
});
