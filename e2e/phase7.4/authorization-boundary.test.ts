import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { inArray } from "drizzle-orm";
import { db } from "../../server/db";
import { users } from "../../server/db/schema";
import { createUser } from "../../server/db/queries";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-jwt-secret-key";
const TARGET_PATH = "/api/invitations/share-token";

type Actor = { id: string; email: string; token: string };
const createdEmails: string[] = [];

async function seedActor(role: "COACH" | "USER"): Promise<Actor> {
  const email = `phase74-rbac-${role.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@fitbuddy.test`;
  const user = await createUser({
    email,
    passwordHash: "e2e-not-used",
    firstName: "E2E",
    lastName: role,
    role,
    emailVerified: true,
  });

  if (!user?.id) {
    throw new Error(`Failed to seed ${role}`);
  }

  createdEmails.push(email);
  const token = jwt.sign(
    { sub: String(user.id), email, role },
    JWT_SECRET,
    { expiresIn: "60m" },
  );

  return { id: String(user.id), email, token };
}

describe("Phase 7.4 - authorization boundary", () => {
  let coach!: Actor;
  let learner!: Actor;

  beforeAll(async () => {
    [coach, learner] = await Promise.all([seedActor("COACH"), seedActor("USER")]);
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await db.delete(users).where(inArray(users.email, createdEmails));
    }
  });

  it("should return 401 when no token is provided", async () => {
    const res = await request(BASE_URL).get(TARGET_PATH);
    expect(res.status).toBe(401);
    expect(
      res.body?.errorCode ?? res.body?.error ?? res.body?.message,
    ).toBeDefined();
  });

  it("should return 403 when USER role accesses coach-only endpoint", async () => {
    const res = await request(BASE_URL)
      .get(TARGET_PATH)
      .set("Authorization", `Bearer ${learner.token}`);
    expect(res.status).toBe(403);
    expect(res.body?.errorCode).toBe("FORBIDDEN");
  });

  it("should return 200 when COACH accesses coach-only endpoint", async () => {
    const res = await request(BASE_URL)
      .get(TARGET_PATH)
      .set("Authorization", `Bearer ${coach.token}`);
    expect(res.status).toBe(200);
    expect(res.body?.token).toBeDefined();
    expect(String(res.body?.coachId)).toBe(coach.id);
  });
});
