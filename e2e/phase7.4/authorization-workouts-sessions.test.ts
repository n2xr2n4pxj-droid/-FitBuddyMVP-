import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { inArray } from "drizzle-orm";
import { db } from "../../server/db";
import { users, workoutRoutines, workoutSessions } from "../../server/db/schema";
import { createUser } from "../../server/db/queries";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-jwt-secret-key";

type Actor = { id: string; email: string; token: string };
const createdEmails: string[] = [];
const createdRoutineIds: string[] = [];
const createdSessionIds: string[] = [];

const VALID_EXERCISES = [
  {
    exerciseId: "00000000-0000-0000-0000-000000000001",
    sets: [{ weight: 60, reps: 10 }],
  },
];

async function seedActor(role: "COACH" | "USER"): Promise<Actor> {
  const email = `phase74-ws-${role.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@fitbuddy.test`;
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

describe("Phase 7.4 - authorization boundary (POST /workouts/sessions)", () => {
  let coach: Actor;
  let learnerA: Actor;
  let learnerB: Actor;
  let routineOwnedByA: string;

  beforeAll(async () => {
    [coach, learnerA, learnerB] = await Promise.all([
      seedActor("COACH"),
      seedActor("USER"),
      seedActor("USER"),
    ]);

    // 使用真 coach 建 routine，語義更貼近業務
    const [r] = await db
      .insert(workoutRoutines)
      .values({
        name: "E2E WS Routine",
        coachId: coach.id,
        clientId: learnerA.id,
      })
      .returning({ id: workoutRoutines.id });
    routineOwnedByA = r.id;
    createdRoutineIds.push(routineOwnedByA);
  });

  afterAll(async () => {
    // 保守清理順序：sessions -> routines -> users
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
    if (createdEmails.length > 0) {
      await db.delete(users).where(inArray(users.email, createdEmails));
    }
  });

  it("should return 401 when no token is provided", async () => {
    const res = await request(BASE_URL)
      .post("/api/workouts/sessions")
      .send({ routineId: routineOwnedByA, exercises: VALID_EXERCISES });
    expect(res.status).toBe(401);
    expect(
      res.body?.errorCode ?? res.body?.error ?? res.body?.message,
    ).toBeDefined();
  });

  it("should return 403 when learner logs a session using another learner's routine (BOLA)", async () => {
    const res = await request(BASE_URL)
      .post("/api/workouts/sessions")
      .set("Authorization", `Bearer ${learnerB.token}`)
      .send({ routineId: routineOwnedByA, exercises: VALID_EXERCISES });
    expect(res.status).toBe(403);
    expect(res.body?.errorCode).toBe("FORBIDDEN");
  });

  it("should return 201 when learner logs a session with their own routine", async () => {
    const res = await request(BASE_URL)
      .post("/api/workouts/sessions")
      .set("Authorization", `Bearer ${learnerA.token}`)
      .send({ routineId: routineOwnedByA, exercises: VALID_EXERCISES });
    expect(res.status).toBe(201);
    expect(res.body?.sessionId).toBeDefined();
    if (res.body?.sessionId) createdSessionIds.push(res.body.sessionId);
  });
});
