import { and, desc, eq, isNull } from "drizzle-orm";
import { db as appDb } from "../db";
import {
  planAssignments,
  routineExercises,
  sessionExercises,
  sessionFeedbacks,
  sessionSets,
  users,
  workoutRoutines,
  workoutSessions,
} from "../db/schema";

type DbLike = typeof appDb;

export interface LearnerDashboardOverview {
  learnerId: string;
  today: string;
  latestSession?: {
    id: string;
    date: string;
    routineName: string | null;
    totalExercises: number;
    totalSets: number;
    totalVolumeKg: number;
    isFromAssignedPlan: boolean;
  };
  latestCoachFeedback?: {
    sessionId: string;
    coachName: string;
    content: string;
    createdAt: string;
    isFromLatestSession: boolean;
  };
  activePlanPreview?: {
    routineId: string;
    name: string;
    exerciseCount: number;
    assignedBy?: string;
  };
}

function getTodayHktYmd(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

async function fetchLatestSession(db: DbLike, learnerId: string) {
  const latestRows = await db
    .select({
      id: workoutSessions.id,
      completedAt: workoutSessions.completedAt,
      startedAt: workoutSessions.startedAt,
      routineId: workoutSessions.routineId,
      routineName: workoutRoutines.name,
    })
    .from(workoutSessions)
    .leftJoin(workoutRoutines, eq(workoutSessions.routineId, workoutRoutines.id))
    .where(eq(workoutSessions.userId, learnerId))
    .orderBy(desc(workoutSessions.completedAt), desc(workoutSessions.startedAt))
    .limit(1);

  const latest = latestRows[0];
  if (!latest) return undefined;

  const exercisesRows = await db
    .select({ id: sessionExercises.id })
    .from(sessionExercises)
    .where(eq(sessionExercises.sessionId, latest.id));
  const totalExercises = exercisesRows.length;

  let totalSets = 0;
  let totalVolumeKg = 0;
  if (exercisesRows.length > 0) {
    const setRows = await db
      .select({
        completed: sessionSets.completed,
        weight: sessionSets.weight,
      })
      .from(sessionSets)
      .innerJoin(sessionExercises, eq(sessionSets.sessionExerciseId, sessionExercises.id))
      .where(eq(sessionExercises.sessionId, latest.id));
    totalSets = setRows.length;
    for (const row of setRows) {
      const weightNum = row.weight == null ? 0 : Number(row.weight);
      if (row.completed && weightNum > 0) {
        totalVolumeKg += weightNum;
      }
    }
  }

  let isFromAssignedPlan = false;
  if (latest.routineId) {
    const assigned = await db
      .select({ id: planAssignments.id })
      .from(planAssignments)
      .where(
        and(
          eq(planAssignments.learnerId, learnerId),
          eq(planAssignments.routineId, latest.routineId),
        ),
      )
      .limit(1);
    isFromAssignedPlan = assigned.length > 0;
  }

  return {
    id: latest.id,
    date: (latest.completedAt ?? latest.startedAt)?.toISOString() ?? new Date().toISOString(),
    routineName: latest.routineName ?? "自由訓練",
    totalExercises,
    totalSets,
    totalVolumeKg: Number(totalVolumeKg.toFixed(2)),
    isFromAssignedPlan,
  };
}

async function fetchLatestCoachFeedback(
  db: DbLike,
  learnerId: string,
) {
  const rows = await db
    .select({
      sessionId: sessionFeedbacks.sessionId,
      content: sessionFeedbacks.content,
      createdAt: sessionFeedbacks.createdAt,
      trainerFirstName: users.firstName,
      trainerLastName: users.lastName,
      trainerEmail: users.email,
    })
    .from(sessionFeedbacks)
    .innerJoin(workoutSessions, eq(workoutSessions.id, sessionFeedbacks.sessionId))
    .innerJoin(users, eq(users.id, sessionFeedbacks.trainerId))
    .where(eq(workoutSessions.userId, learnerId))
    .orderBy(desc(sessionFeedbacks.createdAt))
    .limit(1);

  const row = rows[0];
  if (!row) return undefined;
  const displayName = `${row.trainerFirstName ?? ""} ${row.trainerLastName ?? ""}`.trim();
  return {
    sessionId: row.sessionId,
    coachName: displayName || row.trainerEmail,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  };
}

async function fetchActivePlanPreview(db: DbLike, learnerId: string) {
  const rows = await db
    .select({
      routineId: planAssignments.routineId,
      name: workoutRoutines.name,
      trainerFirstName: users.firstName,
      trainerLastName: users.lastName,
      trainerEmail: users.email,
    })
    .from(planAssignments)
    .innerJoin(
      workoutRoutines,
      and(
        eq(workoutRoutines.id, planAssignments.routineId),
        isNull(workoutRoutines.deletedAt),
      ),
    )
    .innerJoin(users, eq(users.id, planAssignments.trainerId))
    .where(eq(planAssignments.learnerId, learnerId))
    .orderBy(desc(planAssignments.assignedAt))
    .limit(1);

  const row = rows[0];
  if (!row) return undefined;

  const exCountRows = await db
    .select({ id: routineExercises.id })
    .from(routineExercises)
    .where(eq(routineExercises.routineId, row.routineId));

  const trainerName = `${row.trainerFirstName ?? ""} ${row.trainerLastName ?? ""}`.trim() || row.trainerEmail;

  return {
    routineId: row.routineId,
    name: row.name,
    exerciseCount: exCountRows.length,
    assignedBy: trainerName,
  };
}

export async function getLearnerDashboardOverview(
  db: DbLike,
  learnerId: string,
): Promise<LearnerDashboardOverview> {
  const latestSessionResultPromise = (async () => {
    try {
      return await fetchLatestSession(db, learnerId);
    } catch (error) {
      console.error("[dashboard] fetchLatestSession failed:", error);
      return undefined;
    }
  })();

  const latestFeedbackResultPromise = (async () => {
    try {
      return await fetchLatestCoachFeedback(db, learnerId);
    } catch (error) {
      console.error("[dashboard] fetchLatestCoachFeedback failed:", error);
      return undefined;
    }
  })();

  const activePlanResultPromise = (async () => {
    try {
      return await fetchActivePlanPreview(db, learnerId);
    } catch (error) {
      console.error("[dashboard] fetchActivePlanPreview failed:", error);
      return undefined;
    }
  })();

  const [latestSessionResult, latestFeedbackResult, activePlanResult] = await Promise.all([
    latestSessionResultPromise,
    latestFeedbackResultPromise,
    activePlanResultPromise,
  ]);

  return {
    learnerId,
    today: getTodayHktYmd(),
    latestSession: latestSessionResult,
    latestCoachFeedback: latestFeedbackResult
      ? {
          ...latestFeedbackResult,
          isFromLatestSession:
            latestSessionResult != null &&
            latestFeedbackResult.sessionId === latestSessionResult.id,
        }
      : undefined,
    activePlanPreview: activePlanResult,
  };
}
