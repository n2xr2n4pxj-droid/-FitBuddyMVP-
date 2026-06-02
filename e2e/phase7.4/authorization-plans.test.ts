import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { inArray } from "drizzle-orm";
import { db } from "../../server/db";
import { users, workoutRoutines, planAssignments } from "../../server/db/schema";
import { createUser } from "../../server/db/queries";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-jwt-secret-key";

type Actor = { id: string; email: string; token: string };
const createdEmails: string[] = [];
const createdRoutineIds: string[] = [];

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

  beforeAll(async () => {
    [coach, learnerA, learnerB] = await Promise.all([
      seedActor("COACH"),
      seedActor("USER"),
      seedActor("USER"),
    ]);

    // coach 建立 routine 並關聯到 learnerA
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

    // 指派給 learnerA
    await db.insert(planAssignments).values({
      routineId,
      learnerId: learnerA.id,
      trainerId: coach.id,
    });
  });

  afterAll(async () => {
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
});
