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
  const email = `phase74-cc-${role.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@fitbuddy.test`;
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

describe("Phase 7.4 - authorization boundary (coach-client)", () => {
  let activeCoach: Actor;
  let ghostCoach: Actor;
  let learner: Actor;
  let strangerUser: Actor;
  const TODAY = new Date().toISOString().slice(0, 10);

  beforeAll(async () => {
    [activeCoach, ghostCoach, learner, strangerUser] = await Promise.all([
      seedActor("COACH"),
      seedActor("COACH"),
      seedActor("USER"),
      seedActor("USER"),
    ]);

    // activeCoach ↔ learner: 正常 active 關係
    const [activeRel] = await db
      .insert(coachClients)
      .values({
        coachId: activeCoach.id,
        clientId: learner.id,
        status: "active",
      })
      .returning({ id: coachClients.id });
    createdRelationshipIds.push(activeRel.id);

    // ghostCoach ↔ learner: 先建立再降為 paused（模擬解除綁定後的 Ghost Access）
    const [ghostRel] = await db
      .insert(coachClients)
      .values({
        coachId: ghostCoach.id,
        clientId: learner.id,
        status: "active",
      })
      .returning({ id: coachClients.id });
    createdRelationshipIds.push(ghostRel.id);

    await db
      .update(coachClients)
      .set({ status: "paused" })
      .where(eq(coachClients.id, ghostRel.id));
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

  it("should return 401 when no token for my-learners", async () => {
    const res = await request(BASE_URL).get("/api/coach-client/my-learners");
    expect(res.status).toBe(401);
    expect(
      res.body?.errorCode ?? res.body?.error ?? res.body?.message,
    ).toBeDefined();
  });

  it("should return 403 when USER accesses coach-only /api/coach-client/my-learners", async () => {
    const res = await request(BASE_URL)
      .get("/api/coach-client/my-learners")
      .set("Authorization", `Bearer ${strangerUser.token}`);
    expect(res.status).toBe(403);
    expect(res.body?.errorCode).toBe("FORBIDDEN");
  });

  it("should return 403 when coach without active relationship accesses client nutrition logs (Ghost Access)", async () => {
    const res = await request(BASE_URL)
      .get(`/api/coach/clients/${learner.id}/nutrition/logs?date=${TODAY}`)
      .set("Authorization", `Bearer ${ghostCoach.token}`);
    expect(res.status).toBe(403);
    expect(res.body?.errorCode).toBe("FORBIDDEN");
  });

  it("should return 200 when active coach accesses their client's nutrition logs", async () => {
    const res = await request(BASE_URL)
      .get(`/api/coach/clients/${learner.id}/nutrition/logs?date=${TODAY}`)
      .set("Authorization", `Bearer ${activeCoach.token}`);
    expect(res.status).toBe(200);
    expect(
      res.body?.summary ?? res.body?.goals ?? res.body?.logs,
    ).toBeDefined();
  });

  it("should return 200 when COACH lists their own learners", async () => {
    const res = await request(BASE_URL)
      .get("/api/coach-client/my-learners")
      .set("Authorization", `Bearer ${activeCoach.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((x: any) => String(x?.id) === learner.id)).toBe(true);
  });
});
