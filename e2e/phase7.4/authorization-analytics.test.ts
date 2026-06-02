import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../server/db";
import { users, coachClients, bodyCompositionLogs } from "../../server/db/schema";
import { createUser } from "../../server/db/queries";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-jwt-secret-key";

type Actor = { id: string; email: string; token: string };
const createdEmails: string[] = [];
const createdRelationshipIds: string[] = [];
const createdLogIds: string[] = [];

async function seedActor(role: "COACH" | "USER"): Promise<Actor> {
  const email = `phase74-analytics-${role.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@fitbuddy.test`;
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

describe("Phase 7.4 - authorization boundary (analytics)", () => {
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

    // activeCoach ↔ learner: active
    const [relA] = await db
      .insert(coachClients)
      .values({ coachId: activeCoach.id, clientId: learner.id, status: "active" })
      .returning({ id: coachClients.id });
    createdRelationshipIds.push(relA.id);

    // ghostCoach ↔ learner: 曾 active -> paused
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
    if (createdLogIds.length > 0) {
      await db
        .delete(bodyCompositionLogs)
        .where(inArray(bodyCompositionLogs.id, createdLogIds));
    }
    if (createdRelationshipIds.length > 0) {
      await db
        .delete(coachClients)
        .where(inArray(coachClients.id, createdRelationshipIds));
    }
    if (createdEmails.length > 0) {
      await db.delete(users).where(inArray(users.email, createdEmails));
    }
  });

  // ── POST /analytics/body-composition ─────────────────────────

  it("POST body-composition: 401 when no token", async () => {
    const res = await request(BASE_URL)
      .post("/api/analytics/body-composition")
      .send({ userId: learner.id, measuredAt: TODAY, weight: 70 });
    expect(res.status).toBe(401);
  });

  it("POST body-composition: 403 when unrelated user writes another user's data (BOLA)", async () => {
    const res = await request(BASE_URL)
      .post("/api/analytics/body-composition")
      .set("Authorization", `Bearer ${strangerUser.token}`)
      .send({ userId: learner.id, measuredAt: TODAY, weight: 70 });
    expect(res.status).toBe(403);
    expect(res.body?.errorCode).toBe("FORBIDDEN");
  });

  it("POST body-composition: 403 when coach with paused relationship writes learner data (Ghost Access)", async () => {
    const res = await request(BASE_URL)
      .post("/api/analytics/body-composition")
      .set("Authorization", `Bearer ${ghostCoach.token}`)
      .send({ userId: learner.id, measuredAt: TODAY, weight: 70 });
    expect(res.status).toBe(403);
    expect(res.body?.errorCode).toBe("FORBIDDEN");
  });

  it("POST body-composition: 201 when learner writes their own data", async () => {
    const res = await request(BASE_URL)
      .post("/api/analytics/body-composition")
      .set("Authorization", `Bearer ${learner.token}`)
      .send({ userId: learner.id, measuredAt: TODAY, weight: 70 });
    expect(res.status).toBe(201);
    expect(res.body?.id).toBeDefined();
    if (res.body?.id) createdLogIds.push(res.body.id);
  });

  // ── GET /analytics/body-composition/:userId ───────────────────

  it("GET body-composition: 401 when no token", async () => {
    const res = await request(BASE_URL).get(
      `/api/analytics/body-composition/${learner.id}`,
    );
    expect(res.status).toBe(401);
  });

  it("GET body-composition: 403 when unrelated user reads another user's data (BOLA)", async () => {
    const res = await request(BASE_URL)
      .get(`/api/analytics/body-composition/${learner.id}`)
      .set("Authorization", `Bearer ${strangerUser.token}`);
    expect(res.status).toBe(403);
    expect(res.body?.errorCode).toBe("FORBIDDEN");
  });

  it("GET body-composition: 403 when coach with paused relationship reads learner data (Ghost Access)", async () => {
    const res = await request(BASE_URL)
      .get(`/api/analytics/body-composition/${learner.id}`)
      .set("Authorization", `Bearer ${ghostCoach.token}`);
    expect(res.status).toBe(403);
    expect(res.body?.errorCode).toBe("FORBIDDEN");
  });

  it("GET body-composition: 200 when active coach reads learner data", async () => {
    const res = await request(BASE_URL)
      .get(`/api/analytics/body-composition/${learner.id}`)
      .set("Authorization", `Bearer ${activeCoach.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET body-composition: 200 when learner reads their own data", async () => {
    const res = await request(BASE_URL)
      .get(`/api/analytics/body-composition/${learner.id}`)
      .set("Authorization", `Bearer ${learner.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // ── GET /analytics/workout-volume/:userId ─────────────────────

  it("GET workout-volume: 401 when no token", async () => {
    const res = await request(BASE_URL).get(
      `/api/analytics/workout-volume/${learner.id}`,
    );
    expect(res.status).toBe(401);
  });

  it("GET workout-volume: 403 when unrelated user reads another user's volume (BOLA)", async () => {
    const res = await request(BASE_URL)
      .get(`/api/analytics/workout-volume/${learner.id}`)
      .set("Authorization", `Bearer ${strangerUser.token}`);
    expect(res.status).toBe(403);
    expect(res.body?.errorCode).toBe("FORBIDDEN");
  });

  it("GET workout-volume: 200 when active coach reads learner workout volume", async () => {
    const res = await request(BASE_URL)
      .get(`/api/analytics/workout-volume/${learner.id}`)
      .set("Authorization", `Bearer ${activeCoach.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });

  // ── DELETE /analytics/body-composition/:logId ─────────────────

  it("DELETE body-composition: 401 when no token", async () => {
    const createRes = await request(BASE_URL)
      .post("/api/analytics/body-composition")
      .set("Authorization", `Bearer ${learner.token}`)
      .send({ userId: learner.id, measuredAt: TODAY, weight: 66 });
    expect(createRes.status).toBe(201);
    const logId = createRes.body?.id;
    expect(logId).toBeDefined();
    if (logId) createdLogIds.push(logId);

    const deleteRes = await request(BASE_URL).delete(
      `/api/analytics/body-composition/${logId}`,
    );
    expect(deleteRes.status).toBe(401);
  });

  it("DELETE body-composition: 403 when unrelated user deletes another user's log (BOLA)", async () => {
    const createRes = await request(BASE_URL)
      .post("/api/analytics/body-composition")
      .set("Authorization", `Bearer ${learner.token}`)
      .send({ userId: learner.id, measuredAt: TODAY, weight: 65 });
    expect(createRes.status).toBe(201);
    const logId = createRes.body?.id;
    expect(logId).toBeDefined();
    if (logId) createdLogIds.push(logId);

    const deleteRes = await request(BASE_URL)
      .delete(`/api/analytics/body-composition/${logId}`)
      .set("Authorization", `Bearer ${strangerUser.token}`);
    expect(deleteRes.status).toBe(403);
    expect(deleteRes.body?.errorCode).toBe("FORBIDDEN");
  });

  it("DELETE body-composition: 204 when learner deletes their own log", async () => {
    const createRes = await request(BASE_URL)
      .post("/api/analytics/body-composition")
      .set("Authorization", `Bearer ${learner.token}`)
      .send({ userId: learner.id, measuredAt: TODAY, weight: 68 });
    expect(createRes.status).toBe(201);
    const logId = createRes.body?.id;
    expect(logId).toBeDefined();

    const deleteRes = await request(BASE_URL)
      .delete(`/api/analytics/body-composition/${logId}`)
      .set("Authorization", `Bearer ${learner.token}`);
    expect(deleteRes.status).toBe(204);
  });
});
