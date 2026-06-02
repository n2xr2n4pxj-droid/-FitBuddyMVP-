import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../server/db";
import { users, coachClients } from "../../server/db/schema";
import { createUser } from "../../server/db/queries";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-jwt-secret-key";

type Actor = { id: string; email: string; token: string };
const createdEmails: string[] = [];
const createdRelationshipIds: string[] = [];

async function seedActor(role: "COACH" | "USER"): Promise<Actor> {
  const email = `phase74-wla-${role.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@fitbuddy.test`;
  const user = await createUser({
    email,
    passwordHash: "e2e-not-used",
    firstName: "E2E",
    lastName: role,
    role,
    emailVerified: true,
  });
  if (!user?.id) throw new Error(`Failed to seed ${role}`);
  createdEmails.push(email);
  const token = jwt.sign({ sub: String(user.id), email, role }, JWT_SECRET, {
    expiresIn: "60m",
  });
  return { id: String(user.id), email, token };
}

describe("Phase 7.4 - authorization boundary (GET /workouts/sessions/learner/:learnerId)", () => {
  let activeCoach: Actor;
  let ghostCoach: Actor;
  let learner: Actor;
  let strangerUser: Actor;

  beforeAll(async () => {
    [activeCoach, ghostCoach, learner, strangerUser] = await Promise.all([
      seedActor("COACH"),
      seedActor("COACH"),
      seedActor("USER"),
      seedActor("USER"),
    ]);

    // activeCoach ↔ learner: active
    const [relA] = await db
      .insert(coachClients)
      .values({ coachId: activeCoach.id, clientId: learner.id, status: "active" })
      .returning({ id: coachClients.id });
    createdRelationshipIds.push(relA.id);

    // ghostCoach ↔ learner: 曾 active -> 現在 paused
    const [relG] = await db
      .insert(coachClients)
      .values({ coachId: ghostCoach.id, clientId: learner.id, status: "active" })
      .returning({ id: coachClients.id });
    await db
      .update(coachClients)
      .set({ status: "paused" })
      .where(eq(coachClients.id, relG.id));
    createdRelationshipIds.push(relG.id);
  });

  afterAll(async () => {
    if (createdRelationshipIds.length > 0) {
      await db
        .delete(coachClients)
        .where(inArray(coachClients.id, createdRelationshipIds));
    }
    if (createdEmails.length > 0) {
      await db.delete(users).where(inArray(users.email, createdEmails));
    }
  });

  it("should return 401 when no token is provided", async () => {
    const res = await request(BASE_URL).get(
      `/api/workouts/sessions/learner/${learner.id}`,
    );
    expect(res.status).toBe(401);
    expect(
      res.body?.errorCode ?? res.body?.error ?? res.body?.message,
    ).toBeDefined();
  });

  it("should return 403 when USER accesses trainer-only learner sessions endpoint", async () => {
    const res = await request(BASE_URL)
      .get(`/api/workouts/sessions/learner/${learner.id}`)
      .set("Authorization", `Bearer ${strangerUser.token}`);
    expect(res.status).toBe(403);
    expect(res.body?.errorCode).toBe("FORBIDDEN");
  });

  it("should return 403 when coach with paused relationship accesses learner sessions (ReBAC)", async () => {
    const res = await request(BASE_URL)
      .get(`/api/workouts/sessions/learner/${learner.id}`)
      .set("Authorization", `Bearer ${ghostCoach.token}`);
    expect(res.status).toBe(403);
    expect(res.body?.errorCode).toBe("FORBIDDEN");
  });

  it("should return 200 when active coach accesses their learner's sessions", async () => {
    const res = await request(BASE_URL)
      .get(`/api/workouts/sessions/learner/${learner.id}`)
      .set("Authorization", `Bearer ${activeCoach.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
