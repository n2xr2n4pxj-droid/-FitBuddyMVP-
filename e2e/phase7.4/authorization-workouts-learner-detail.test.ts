import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../server/db";
import {
  users,
  coachClients,
  workoutRoutines,
  workoutSessions,
} from "../../server/db/schema";
import { createUser } from "../../server/db/queries";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-jwt-secret-key";

type Actor = { id: string; email: string; token: string };
const createdEmails: string[] = [];
const createdRelationshipIds: string[] = [];
const createdRoutineIds: string[] = [];
const createdSessionIds: string[] = [];

const VALID_EXERCISES = [
  { exerciseId: "00000000-0000-0000-0000-000000000001", sets: [{ weight: 80, reps: 5 }] },
];

async function seedActor(role: "COACH" | "USER"): Promise<Actor> {
  const email = `phase74-wld-${role.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@fitbuddy.test`;
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

describe("Phase 7.4 - authorization boundary (GET /workouts/sessions/learner/:learnerId/:sessionId)", () => {
  let activeCoach: Actor;
  let ghostCoach: Actor;
  let learnerA: Actor;
  let learnerB: Actor;
  let strangerUser: Actor;
  let learnerASessionId: string;
  let learnerBSessionId: string;

  beforeAll(async () => {
    [activeCoach, ghostCoach, learnerA, learnerB, strangerUser] = await Promise.all(
      [
        seedActor("COACH"),
        seedActor("COACH"),
        seedActor("USER"),
        seedActor("USER"),
        seedActor("USER"),
      ],
    );

    const [relActive] = await db
      .insert(coachClients)
      .values({
        coachId: activeCoach.id,
        clientId: learnerA.id,
        status: "active",
      })
      .returning({ id: coachClients.id });
    createdRelationshipIds.push(relActive.id);

    const [relGhost] = await db
      .insert(coachClients)
      .values({
        coachId: ghostCoach.id,
        clientId: learnerA.id,
        status: "active",
      })
      .returning({ id: coachClients.id });
    await db
      .update(coachClients)
      .set({ status: "paused" })
      .where(eq(coachClients.id, relGhost.id));
    createdRelationshipIds.push(relGhost.id);

    const [routineA] = await db
      .insert(workoutRoutines)
      .values({
        name: "E2E WLD Routine A",
        coachId: activeCoach.id,
        clientId: learnerA.id,
      })
      .returning({ id: workoutRoutines.id });
    createdRoutineIds.push(routineA.id);

    const [routineB] = await db
      .insert(workoutRoutines)
      .values({
        name: "E2E WLD Routine B",
        coachId: activeCoach.id,
        clientId: learnerB.id,
      })
      .returning({ id: workoutRoutines.id });
    createdRoutineIds.push(routineB.id);

    const resA = await request(BASE_URL)
      .post("/api/workouts/sessions")
      .set("Authorization", `Bearer ${learnerA.token}`)
      .send({ routineId: routineA.id, exercises: VALID_EXERCISES });
    if (resA.status !== 201) {
      throw new Error(`Failed to create learnerA session: ${resA.status}`);
    }
    expect(resA.body?.sessionId).toBeDefined();
    learnerASessionId = resA.body.sessionId;
    createdSessionIds.push(learnerASessionId);

    const resB = await request(BASE_URL)
      .post("/api/workouts/sessions")
      .set("Authorization", `Bearer ${learnerB.token}`)
      .send({ routineId: routineB.id, exercises: VALID_EXERCISES });
    if (resB.status !== 201) {
      throw new Error(`Failed to create learnerB session: ${resB.status}`);
    }
    expect(resB.body?.sessionId).toBeDefined();
    learnerBSessionId = resB.body.sessionId;
    createdSessionIds.push(learnerBSessionId);
  });

  afterAll(async () => {
    if (createdSessionIds.length > 0) {
      await db
        .delete(workoutSessions)
        .where(inArray(workoutSessions.id, createdSessionIds));
    }
    if (createdRoutineIds.length > 0) {
      await db
        .delete(workoutRoutines)
        .where(inArray(workoutRoutines.id, createdRoutineIds));
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

  it("should return 401 when no token is provided", async () => {
    const res = await request(BASE_URL).get(
      `/api/workouts/sessions/learner/${learnerA.id}/${learnerASessionId}`,
    );
    expect(res.status).toBe(401);
    expect(
      res.body?.errorCode ?? res.body?.error ?? res.body?.message,
    ).toBeDefined();
  });

  it("should return 403 when USER accesses trainer-only learner session detail endpoint", async () => {
    const res = await request(BASE_URL)
      .get(`/api/workouts/sessions/learner/${learnerA.id}/${learnerASessionId}`)
      .set("Authorization", `Bearer ${strangerUser.token}`);
    expect(res.status).toBe(403);
    expect(res.body?.errorCode).toBe("FORBIDDEN");
  });

  it("should return 403 when coach with paused relationship accesses learner session detail", async () => {
    const res = await request(BASE_URL)
      .get(`/api/workouts/sessions/learner/${learnerA.id}/${learnerASessionId}`)
      .set("Authorization", `Bearer ${ghostCoach.token}`);
    expect(res.status).toBe(403);
    expect(res.body?.errorCode).toBe("FORBIDDEN");
  });

  it("should return 403 for double-id attack when sessionId belongs to another learner", async () => {
    const res = await request(BASE_URL)
      .get(`/api/workouts/sessions/learner/${learnerA.id}/${learnerBSessionId}`)
      .set("Authorization", `Bearer ${activeCoach.token}`);
    expect(res.status).toBe(403);
    expect(res.body?.errorCode).toBe("FORBIDDEN");
  });

  it("should return 200 when active coach accesses detail of learner-owned session", async () => {
    const res = await request(BASE_URL)
      .get(`/api/workouts/sessions/learner/${learnerA.id}/${learnerASessionId}`)
      .set("Authorization", `Bearer ${activeCoach.token}`);
    expect(res.status).toBe(200);
    expect(res.body?.sessionId).toBe(learnerASessionId);
    expect(Array.isArray(res.body?.exercises)).toBe(true);
  });
});
