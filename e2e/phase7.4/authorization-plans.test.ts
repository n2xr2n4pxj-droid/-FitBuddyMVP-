import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { inArray } from "drizzle-orm";
import { db } from "../../server/db";
import {
  users,
  workoutRoutines,
  planAssignments,
  coachClients,
} from "../../server/db/schema";
import { createUser } from "../../server/db/queries";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-jwt-secret-key";

type Actor = { id: string; email: string; token: string };
const createdEmails: string[] = [];
const createdRoutineIds: string[] = [];
const createdRelationshipIds: string[] = [];

async function seedActor(role: "COACH" | "USER"): Promise<Actor> {
  const email = `phase74-plans-${role.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@fitbuddy.test`;
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

describe("Phase 7.4 - authorization boundary (plans)", () => {
  let coach: Actor;
  let learnerA: Actor;
  let learnerB: Actor;
  let routineId: string;

  let coachA: Actor;
  let coachB: Actor;
  let learnerC: Actor;
  let userX: Actor;
  let routineOwnedByA: string;
  let routineOwnedByB: string;

  beforeAll(async () => {
    [coach, learnerA, learnerB, coachA, coachB, learnerC, userX] =
      await Promise.all([
      seedActor("COACH"),
      seedActor("USER"),
      seedActor("USER"),
      seedActor("COACH"),
      seedActor("COACH"),
      seedActor("USER"),
      seedActor("USER"),
    ]);

    // GET /plans/:routineId 用
    const [routine] = await db
      .insert(workoutRoutines)
      .values({
        name: "E2E Test Routine",
        coachId: coach.id,
        clientId: learnerA.id,
      })
      .returning({ id: workoutRoutines.id });
    routineId = routine.id;
    createdRoutineIds.push(routineId);

    await db.insert(planAssignments).values({
      routineId,
      learnerId: learnerA.id,
      trainerId: coach.id,
    });

    // POST /plans/assign 用：clientId 補上 learnerC.id
    const [rA] = await db
      .insert(workoutRoutines)
      .values({
        name: "E2E Routine CoachA",
        coachId: coachA.id,
        clientId: learnerC.id,
      })
      .returning({ id: workoutRoutines.id });
    routineOwnedByA = rA.id;
    createdRoutineIds.push(routineOwnedByA);

    const [rB] = await db
      .insert(workoutRoutines)
      .values({
        name: "E2E Routine CoachB",
        coachId: coachB.id,
        clientId: learnerC.id,
      })
      .returning({ id: workoutRoutines.id });
    routineOwnedByB = rB.id;
    createdRoutineIds.push(routineOwnedByB);

    // coachA ↔ learnerC active（合法指派所需）
    const [relA] = await db
      .insert(coachClients)
      .values({ coachId: coachA.id, clientId: learnerC.id, status: "active" })
      .returning({ id: coachClients.id });
    createdRelationshipIds.push(relA.id);

    // coachB ↔ learnerC active（測水平越權：active 但非 routine owner 仍應被擋）
    const [relB] = await db
      .insert(coachClients)
      .values({ coachId: coachB.id, clientId: learnerC.id, status: "active" })
      .returning({ id: coachClients.id });
    createdRelationshipIds.push(relB.id);
  });

  afterAll(async () => {
    if (createdRelationshipIds.length > 0) {
      await db
        .delete(coachClients)
        .where(inArray(coachClients.id, createdRelationshipIds));
    }
    if (createdRoutineIds.length > 0) {
      await db
        .delete(planAssignments)
        .where(inArray(planAssignments.routineId, createdRoutineIds));
      await db
        .delete(workoutRoutines)
        .where(inArray(workoutRoutines.id, createdRoutineIds));
    }
    if (createdEmails.length > 0) {
      await db.delete(users).where(inArray(users.email, createdEmails));
    }
  });

  // ── GET /plans/:routineId ─────────────────────────────────────

  it("should return 401 when no token is provided", async () => {
    const res = await request(BASE_URL).get(`/api/plans/${routineId}`);
    expect(res.status).toBe(401);
    expect(
      res.body?.errorCode ?? res.body?.error ?? res.body?.message,
    ).toBeDefined();
  });

  it("should return 403 when unrelated learner accesses another learner's plan (BOLA)", async () => {
    const res = await request(BASE_URL)
      .get(`/api/plans/${routineId}`)
      .set("Authorization", `Bearer ${learnerB.token}`);
    expect(res.status).toBe(403);
    expect(res.body?.errorCode).toBe("FORBIDDEN");
  });

  it("should return 403 when USER accesses trainer-only /api/plans/available", async () => {
    const res = await request(BASE_URL)
      .get("/api/plans/available")
      .set("Authorization", `Bearer ${learnerA.token}`);
    expect(res.status).toBe(403);
    expect(res.body?.errorCode).toBe("FORBIDDEN");
  });

  it("should return 403 when COACH tries to access learner-only /api/plans/my", async () => {
    const res = await request(BASE_URL)
      .get("/api/plans/my")
      .set("Authorization", `Bearer ${coach.token}`);
    expect(res.status).toBe(403);
    expect(res.body?.errorCode).toBe("FORBIDDEN");
  });

  it("should return 200 when assigned learner accesses their own plan", async () => {
    const res = await request(BASE_URL)
      .get(`/api/plans/${routineId}`)
      .set("Authorization", `Bearer ${learnerA.token}`);
    expect(res.status).toBe(200);
    expect(String(res.body?.id)).toBe(routineId);
  });

  // ── POST /plans/assign ────────────────────────────────────────

  it("should return 403 when USER tries trainer-only POST /plans/assign (vertical privilege escalation)", async () => {
    const res = await request(BASE_URL)
      .post("/api/plans/assign")
      .set("Authorization", `Bearer ${userX.token}`)
      .send({ routineId: routineOwnedByA, learnerId: learnerC.id, note: "test" });
    expect(res.status).toBe(403);
    expect(res.body?.errorCode).toBe("FORBIDDEN");
  });

  it("should return 403 when COACH assigns a routine they do not own (horizontal privilege escalation)", async () => {
    const res = await request(BASE_URL)
      .post("/api/plans/assign")
      .set("Authorization", `Bearer ${coachA.token}`)
      .send({ routineId: routineOwnedByB, learnerId: learnerC.id, note: "test" });
    expect(res.status).toBe(403);
    expect(res.body?.errorCode).toBe("FORBIDDEN");
  });

  it("should return 200 when active trainer assigns their own routine to their learner", async () => {
    const res = await request(BASE_URL)
      .post("/api/plans/assign")
      .set("Authorization", `Bearer ${coachA.token}`)
      .send({
        routineId: routineOwnedByA,
        learnerId: learnerC.id,
        note: "e2e ok",
      });
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });
});
