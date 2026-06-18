import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { inArray } from "drizzle-orm";
import { db } from "../../server/db";
import { users } from "../../server/db/schema";
import { createUser, getUserByEmail } from "../../server/db/queries";
import { hashPassword } from "../../server/replitAuth";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-jwt-secret-key";
const REFRESH_COOKIE_NAME = "fitbuddy_refresh_token";
const TEST_PASSWORD = "E2eRevocation!123";
const ME_PATH = "/api/auth/me";

const createdEmails: string[] = [];

function extractRefreshJwt(setCookie: string | string[] | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? ""];
  const cookie = cookies.find((entry) => entry.startsWith(`${REFRESH_COOKIE_NAME}=`));
  const match = cookie?.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`));
  if (!match?.[1]) {
    throw new Error("Refresh cookie not found in Set-Cookie");
  }
  return decodeURIComponent(match[1]);
}

async function seedVerifiedUser() {
  const email = `phase74-revocation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@fitbuddy.test`;
  createdEmails.push(email);
  await createUser({
    email,
    passwordHash: hashPassword(TEST_PASSWORD),
    firstName: "E2E",
    lastName: "Revocation",
    role: "USER",
    emailVerified: true,
  });
  return { email, password: TEST_PASSWORD };
}

async function loginWithAgent(email: string, password: string) {
  const agent = request.agent(BASE_URL);
  const res = await agent
    .post("/api/auth/login")
    .send({ email, password })
    .expect(200);

  return {
    agent,
    accessToken: res.body.token as string,
    refreshJwt: extractRefreshJwt(res.headers["set-cookie"]),
  };
}

describe("Phase 7.4 - token revocation (tokenVersion)", () => {
  let credentials!: { email: string; password: string };

  beforeAll(async () => {
    credentials = await seedVerifiedUser();
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await db.delete(users).where(inArray(users.email, createdEmails));
    }
  });

  it("logout revokes access and refresh tokens from the same session", async () => {
    const { agent, accessToken, refreshJwt } = await loginWithAgent(
      credentials.email,
      credentials.password,
    );

    await agent.get(ME_PATH).set("Authorization", `Bearer ${accessToken}`).expect(200);

    await agent
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    const meRes = await agent
      .get(ME_PATH)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(meRes.status).toBe(401);

    const refreshRes = await request(BASE_URL)
      .post("/api/auth/refresh")
      .send({ refreshToken: refreshJwt });
    expect(refreshRes.status).toBe(401);
  });

  it("allows re-login and rejects the pre-logout access token", async () => {
    const first = await loginWithAgent(credentials.email, credentials.password);

    await first.agent
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${first.accessToken}`)
      .expect(200);

    const second = await loginWithAgent(credentials.email, credentials.password);

    await second.agent
      .get(ME_PATH)
      .set("Authorization", `Bearer ${second.accessToken}`)
      .expect(200);

    const stale = await request(BASE_URL)
      .get(ME_PATH)
      .set("Authorization", `Bearer ${first.accessToken}`);
    expect(stale.status).toBe(401);
  });

  it("logout on one device revokes tokens issued to another device", async () => {
    const user = await getUserByEmail(credentials.email);
    expect(user?.id).toBeDefined();

    const tv = user!.tokenVersion ?? 0;
    const payload = {
      sub: String(user!.id),
      email: credentials.email,
      role: "USER",
      tv,
    };

    const device1Token = jwt.sign(payload, JWT_SECRET, { expiresIn: "60m" });
    const device2Token = jwt.sign(payload, JWT_SECRET, { expiresIn: "60m" });

    await request(BASE_URL)
      .get(ME_PATH)
      .set("Authorization", `Bearer ${device1Token}`)
      .expect(200);
    await request(BASE_URL)
      .get(ME_PATH)
      .set("Authorization", `Bearer ${device2Token}`)
      .expect(200);

    await request(BASE_URL)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${device1Token}`)
      .expect(200);

    const res = await request(BASE_URL)
      .get(ME_PATH)
      .set("Authorization", `Bearer ${device2Token}`);
    expect(res.status).toBe(401);
  });
});
