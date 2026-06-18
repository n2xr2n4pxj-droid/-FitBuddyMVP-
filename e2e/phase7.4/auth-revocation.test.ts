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

  it("revokes tokens on logout, allows re-login, and invalidates other devices", async () => {
    const agent = request.agent(BASE_URL);
    const loginRes = await agent
      .post("/api/auth/login")
      .send({ email: credentials.email, password: credentials.password })
      .expect(200);

    const firstAccessToken = loginRes.body.token as string;
    const firstRefreshJwt = extractRefreshJwt(loginRes.headers["set-cookie"]);

    await agent
      .get(ME_PATH)
      .set("Authorization", `Bearer ${firstAccessToken}`)
      .expect(200);

    await agent
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${firstAccessToken}`)
      .expect(200);

    expect(
      (await agent.get(ME_PATH).set("Authorization", `Bearer ${firstAccessToken}`)).status,
    ).toBe(401);

    expect(
      (
        await request(BASE_URL)
          .post("/api/auth/refresh")
          .send({ refreshToken: firstRefreshJwt })
      ).status,
    ).toBe(401);

    const reloginRes = await agent
      .post("/api/auth/login")
      .send({ email: credentials.email, password: credentials.password })
      .expect(200);

    const secondAccessToken = reloginRes.body.token as string;
    await agent
      .get(ME_PATH)
      .set("Authorization", `Bearer ${secondAccessToken}`)
      .expect(200);

    expect(
      (
        await request(BASE_URL)
          .get(ME_PATH)
          .set("Authorization", `Bearer ${firstAccessToken}`)
      ).status,
    ).toBe(401);

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

    expect(
      (
        await request(BASE_URL)
          .get(ME_PATH)
          .set("Authorization", `Bearer ${device2Token}`)
      ).status,
    ).toBe(401);
  });
});
