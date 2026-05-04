import { Router } from "express";
import { and, asc, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { db, pool } from "../db";
import { isAuthenticated, verifyJWT } from "../replitAuth";
import { getUserById } from "../db/queries";
import {
  workoutRoutines,
  routineExercises,
  exerciseSets,
  exercises,
  users,
  workoutSessions,
  sessionExercises,
  sessionSets,
  sessionFeedbacks,
  coachClients,
} from "../db/schema";
import { loadPlanExercisesJson } from "../services/planDetail";
import { notifySessionFeedback } from "../services/notificationService";
import { sendError } from "../lib/response";
import { ErrorCodes } from "@shared/error-codes";

const router = Router();

async function getSessionWithTrainerAccess(
  sessionId: string,
  trainerId: string
): Promise<{
  session: { id: string; learnerId: string } | null;
  isTrainerOfLearner: boolean;
}> {
  const sessionRows = await db
    .select({
      id: workoutSessions.id,
      learnerId: workoutSessions.userId,
    })
    .from(workoutSessions)
    .where(eq(workoutSessions.id, sessionId))
    .limit(1);

  const session = sessionRows[0]
    ? { id: sessionRows[0].id, learnerId: sessionRows[0].learnerId }
    : null;

  if (!session) {
    return { session: null, isTrainerOfLearner: false };
  }

  const relationRows = await db
    .select({ id: coachClients.id })
    .from(coachClients)
    .where(
      and(
        eq(coachClients.coachId, String(trainerId)),
        eq(coachClients.clientId, session.learnerId),
        eq(coachClients.status, "active")
      )
    )
    .limit(1);

  return {
    session,
    isTrainerOfLearner: Boolean(relationRows[0]),
  };
}

/**
 * GET /api/workouts/routines
 * 查詢課表列表（學員看自己的、教練看自己開的）
 * Query: clientId（學員 ID，不傳則用當前用戶）、coachId（教練 ID）、upcoming（只未完成且排程日 >= 今日）、limit（預設 10）
 * 回傳: { routines: WorkoutRoutine[] }，每筆含 exercises[] 與 sets[]，與前端 @/features/workouts/types 對齊
 */
router.get("/workouts/routines", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user?.claims?.sub ?? req.user?.id;
    if (!userId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");
    }
    const clientIdParam = typeof req.query.clientId === "string" ? req.query.clientId.trim() : undefined;
    const coachIdParam = typeof req.query.coachId === "string" ? req.query.coachId.trim() : undefined;
    const upcoming = req.query.upcoming === "true" || req.query.upcoming === true;
    const limit = Math.min(Math.max(1, parseInt(String(req.query.limit || 10), 10) || 10), 100);

    let filterClientId: string | null = null;
    let filterCoachId: string | null = null;
    if (clientIdParam && coachIdParam) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "Use either clientId or coachId, not both");
    }
    if (clientIdParam) {
      if (clientIdParam !== userId) {
        const currentUser = await getUserById(userId);
        const role = String(currentUser?.role ?? "").toUpperCase();
        if (role !== "COACH" && role !== "ADMIN") {
          return sendError(res, 403, ErrorCodes.FORBIDDEN, "Only coach can query another client's routines");
        }
      }
      filterClientId = clientIdParam;
    } else if (coachIdParam) {
      if (coachIdParam !== userId) {
        return sendError(res, 403, ErrorCodes.FORBIDDEN, "Can only query your own routines as coach");
      }
      filterCoachId = coachIdParam;
    } else {
      filterClientId = userId;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const conditions = [];
    if (filterClientId) conditions.push(eq(workoutRoutines.clientId, filterClientId));
    if (filterCoachId) conditions.push(eq(workoutRoutines.coachId, filterCoachId));
    if (upcoming) {
      conditions.push(eq(workoutRoutines.isCompleted, false));
      conditions.push(gte(workoutRoutines.scheduledDate, today));
    }
    conditions.push(isNull(workoutRoutines.deletedAt));
    const whereClause = conditions.length ? and(...conditions) : undefined;

    const routineRows = await db
      .select()
      .from(workoutRoutines)
      .where(whereClause)
      .orderBy(asc(workoutRoutines.scheduledDate))
      .limit(limit);

    if (routineRows.length === 0) {
      return res.json({ routines: [] });
    }

    const routineIds = routineRows.map((r) => r.id);
    const reRows = await db
      .select({
        id: routineExercises.id,
        routineId: routineExercises.routineId,
        exerciseId: routineExercises.exerciseId,
        order: routineExercises.order,
        restTimerSeconds: routineExercises.restTimerSeconds,
        exerciseName: exercises.name,
      })
      .from(routineExercises)
      .innerJoin(exercises, eq(routineExercises.exerciseId, exercises.id))
      .where(inArray(routineExercises.routineId, routineIds));

    const reIds = reRows.map((r) => r.id);
    const setRows =
      reIds.length > 0
        ? await db
            .select()
            .from(exerciseSets)
            .where(inArray(exerciseSets.routineExerciseId, reIds))
        : [];

    const reByRoutine = new Map<string, typeof reRows>();
    for (const re of reRows) {
      const list = reByRoutine.get(re.routineId) ?? [];
      list.push(re);
      reByRoutine.set(re.routineId, list);
    }
    const setsByRe = new Map<string, typeof setRows>();
    for (const s of setRows) {
      const list = setsByRe.get(s.routineExerciseId) ?? [];
      list.push(s);
      setsByRe.set(s.routineExerciseId, list);
    }

    const routines = routineRows.map((r) => {
      const reList = (reByRoutine.get(r.id) ?? []).sort((a, b) => a.order - b.order);
      const exercisesOut = reList.map((re) => {
        const sets = (setsByRe.get(re.id) ?? []).sort((a, b) => a.setIndex - b.setIndex);
        const setType = (s: (typeof setRows)[0]): "warmup" | "normal" | "drop" => {
          const t = s.setType?.toLowerCase();
          if (t === "warmup" || t === "drop") return t;
          return "normal";
        };
        return {
          id: re.id,
          exerciseId: re.exerciseId,
          exerciseName: re.exerciseName ?? "",
          order: re.order,
          restTimerSeconds: re.restTimerSeconds ?? 90,
          sets: sets.map((s) => ({
            id: s.id,
            setIndex: s.setIndex,
            setType: setType(s),
            targetWeight: s.targetWeight != null ? Number(s.targetWeight) : null,
            targetReps: s.targetReps ?? null,
            targetRpe: s.targetRpe ?? null,
            actualWeight: s.actualWeight != null ? Number(s.actualWeight) : null,
            actualReps: s.actualReps ?? null,
            isCompleted: s.isCompleted ?? false,
          })),
        };
      });
      return {
        id: r.id,
        name: r.name,
        clientId: r.clientId,
        notes: r.notes ?? "",
        scheduledDate: r.scheduledDate ? r.scheduledDate.toISOString().slice(0, 10) : "",
        isCompleted: r.isCompleted ?? false,
        exercises: exercisesOut,
      };
    });

    return res.json({ routines });
  } catch (err: any) {
    console.error("❌ [API] GET /workouts/routines Error:", err);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to fetch routines");
  }
});

/**
 * POST /api/workouts/routines
 * 教練開課表（Hevy 風格）：一次性建立 workout_routines -> routine_exercises -> exercise_sets
 * 認證：JWT，角色須為 COACH / ADMIN
 */
router.post("/workouts/routines", verifyJWT, async (req: any, res: any) => {
  try {
    const coachId = req.user?.id ?? req.user?.claims?.sub;
    if (!coachId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");
    }
    const currentUser = await getUserById(coachId);
    if (!currentUser) {
      return sendError(res, 401, ErrorCodes.AUTH_USER_NOT_FOUND, "User not found");
    }
    const role = String(currentUser.role ?? "").toUpperCase();
    if (role !== "COACH" && role !== "ADMIN") {
      return sendError(res, 403, ErrorCodes.FORBIDDEN, "Only coach can create workout routines");
    }

    const { clientId, name, scheduledDate, notes, exercises: exercisesPayload } = req.body;
    if (!clientId || typeof clientId !== "string" || !clientId.trim()) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "clientId is required");
    }
    if (!name || typeof name !== "string" || !name.trim()) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "name is required");
    }
    if (!exercisesPayload || !Array.isArray(exercisesPayload) || exercisesPayload.length === 0) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "exercises array is required and must not be empty");
    }

    const scheduled = scheduledDate ? new Date(scheduledDate) : null;

    const result = await db.transaction(async (tx) => {
      const [routine] = await tx
        .insert(workoutRoutines)
        .values({
          coachId: String(coachId),
          clientId: String(clientId).trim(),
          name: String(name).trim(),
          notes: notes != null ? String(notes) : null,
          scheduledDate: scheduled,
          isCompleted: false,
        })
        .returning({ id: workoutRoutines.id });

      if (!routine?.id) {
        throw new Error("Failed to create workout routine");
      }

      const routineId = routine.id;
      const createdRoutineExercises: { id: string; exerciseId: string; order: number }[] = [];
      const createdSets: { routineExerciseId: string; setIndex: number; setType: string | null; targetWeight: number | null; targetReps: number | null }[] = [];

      for (let i = 0; i < exercisesPayload.length; i++) {
        const ex = exercisesPayload[i];
        let exerciseIdStr =
          ex.exerciseId != null && String(ex.exerciseId).trim()
            ? String(ex.exerciseId).trim()
            : "";
        const order = typeof ex.order === "number" ? ex.order : i + 1;
        const sets = Array.isArray(ex.sets) ? ex.sets : [];

        if (!exerciseIdStr) {
          const ename = String(ex.exerciseName ?? "").trim();
          if (!ename) {
            throw new Error(`exercises[${i}]: exerciseId or exerciseName is required`);
          }
          const [ins] = await tx
            .insert(exercises)
            .values({
              name: ename,
              muscleGroup: "General",
              equipment: "Other",
              isCustom: true,
              createdBy: String(coachId),
            })
            .returning({ id: exercises.id });
          if (!ins?.id) throw new Error(`Failed to create custom exercise at index ${i}`);
          exerciseIdStr = ins.id;
        }

        const [re] = await tx
          .insert(routineExercises)
          .values({
            routineId,
            exerciseId: exerciseIdStr,
            order,
            supersetId: ex.supersetId != null ? String(ex.supersetId) : null,
            restTimerSeconds: typeof ex.restTimerSeconds === "number" ? ex.restTimerSeconds : 90,
          })
          .returning({ id: routineExercises.id });

        if (!re?.id) {
          throw new Error(`Failed to create routine exercise at index ${i}`);
        }
        createdRoutineExercises.push({ id: re.id, exerciseId: exerciseIdStr, order });

        for (let s = 0; s < sets.length; s++) {
          const set = sets[s];
          const setIndex = typeof set.setIndex === "number" ? set.setIndex : s + 1;
          const setType = set.setType != null ? String(set.setType) : "normal";
          const targetWeight = set.targetWeight != null ? Number(set.targetWeight) : null;
          const targetReps = set.targetReps != null ? Number(set.targetReps) : null;

          await tx.insert(exerciseSets).values({
            routineExerciseId: re.id,
            setIndex,
            setType,
            targetWeight,
            targetReps,
            targetRpe: set.targetRpe != null ? Number(set.targetRpe) : null,
            isCompleted: false,
          });
          createdSets.push({
            routineExerciseId: re.id,
            setIndex,
            setType,
            targetWeight,
            targetReps,
          });
        }
      }

      return {
        id: routineId,
        coachId: String(coachId),
        clientId: String(clientId).trim(),
        name: String(name).trim(),
        notes: notes != null ? String(notes) : null,
        scheduledDate: scheduled,
        isCompleted: false,
        routineExercises: createdRoutineExercises,
        setsCount: createdSets.length,
      };
    });

    return res.status(201).json(result);
  } catch (err: any) {
    console.error("❌ [API] POST /workouts/routines Error:", err);
    const message = err?.message ?? "Failed to create workout routine";
    return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, message);
  }
});

/**
 * PATCH /api/workouts/routines/:id
 * 教練更新課表（upsert exercises/sets、可刪除列）；回傳與 GET /api/plans/:id 相同形狀（教練視角 isOwn=true）
 */
router.patch("/workouts/routines/:id", verifyJWT, async (req: any, res: any) => {
  try {
    const routineId = String(req.params.id ?? "").trim();
    if (!routineId) return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "routine id is required");

    const coachId = String(req.user?.id ?? req.user?.claims?.sub ?? "").trim();
    if (!coachId) return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");

    const currentUser = await getUserById(coachId);
    if (!currentUser) return sendError(res, 401, ErrorCodes.AUTH_USER_NOT_FOUND, "User not found");
    const role = String(currentUser.role ?? "").toUpperCase();
    if (role !== "COACH" && role !== "ADMIN") {
      return sendError(res, 403, ErrorCodes.FORBIDDEN, "Only coach can update workout routines");
    }

    const [routine] = await db
      .select()
      .from(workoutRoutines)
      .where(eq(workoutRoutines.id, routineId))
      .limit(1);
    if (!routine) return sendError(res, 404, ErrorCodes.WORKOUT_NOT_FOUND, "Routine not found");
    if (routine.deletedAt != null) return sendError(res, 404, ErrorCodes.WORKOUT_NOT_FOUND, "Routine not found");
    if (routine.coachId !== coachId) return sendError(res, 403, ErrorCodes.FORBIDDEN, "Not authorized");

    const body = req.body ?? {};
    const {
      name: nameRaw,
      notes: notesRaw,
      scheduledDate: scheduledRaw,
      exercises: exercisesPayload,
      deletedExerciseIds: delExRaw,
      deletedSetIds: delSetRaw,
    } = body;

    if (nameRaw !== undefined) {
      if (typeof nameRaw !== "string" || !nameRaw.trim()) {
        return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "name cannot be empty");
      }
    }

    await db.transaction(async (tx) => {
      if (nameRaw !== undefined || notesRaw !== undefined || scheduledRaw !== undefined) {
        const patch: {
          name?: string;
          notes?: string | null;
          scheduledDate?: Date | null;
        } = {};
        if (nameRaw !== undefined) patch.name = String(nameRaw).trim();
        if (notesRaw !== undefined) patch.notes = notesRaw == null ? null : String(notesRaw);
        if (scheduledRaw !== undefined) {
          patch.scheduledDate = scheduledRaw ? new Date(String(scheduledRaw)) : null;
        }
        await tx.update(workoutRoutines).set(patch).where(eq(workoutRoutines.id, routineId));
      }

      const delSetIds: string[] = Array.isArray(delSetRaw)
        ? delSetRaw.map((x: any) => String(x ?? "").trim()).filter(Boolean)
        : [];
      if (delSetIds.length > 0) {
        const validSets = await tx
          .select({ id: exerciseSets.id })
          .from(exerciseSets)
          .innerJoin(routineExercises, eq(exerciseSets.routineExerciseId, routineExercises.id))
          .where(and(eq(routineExercises.routineId, routineId), inArray(exerciseSets.id, delSetIds)));
        const vids = validSets.map((s) => s.id);
        if (vids.length > 0) {
          await tx.delete(exerciseSets).where(inArray(exerciseSets.id, vids));
        }
      }

      const delExIds: string[] = Array.isArray(delExRaw)
        ? delExRaw.map((x: any) => String(x ?? "").trim()).filter(Boolean)
        : [];
      if (delExIds.length > 0) {
        await tx
          .delete(routineExercises)
          .where(and(eq(routineExercises.routineId, routineId), inArray(routineExercises.id, delExIds)));
      }

      if (Array.isArray(exercisesPayload)) {
        for (let i = 0; i < exercisesPayload.length; i++) {
          const ex = exercisesPayload[i];
          let exerciseIdStr =
            ex.exerciseId != null && String(ex.exerciseId).trim()
              ? String(ex.exerciseId).trim()
              : "";
          if (!exerciseIdStr) {
            const ename = String(ex.exerciseName ?? "").trim();
            if (!ename) {
              throw new Error(`exercises[${i}]: exerciseId or exerciseName is required`);
            }
            const [ins] = await tx
              .insert(exercises)
              .values({
                name: ename,
                muscleGroup: "General",
                equipment: "Other",
                isCustom: true,
                createdBy: coachId,
              })
              .returning({ id: exercises.id });
            if (!ins?.id) throw new Error(`Failed to create custom exercise at index ${i}`);
            exerciseIdStr = ins.id;
          }

          const order = typeof ex.order === "number" ? ex.order : i + 1;
          const restTimerSeconds =
            typeof ex.restTimerSeconds === "number" ? ex.restTimerSeconds : 90;

          const existingReId =
            ex.id != null && String(ex.id).trim() ? String(ex.id).trim() : "";

          let reId: string;
          if (existingReId) {
            const [existingRow] = await tx
              .select({ id: routineExercises.id })
              .from(routineExercises)
              .where(and(eq(routineExercises.id, existingReId), eq(routineExercises.routineId, routineId)))
              .limit(1);
            if (!existingRow) {
              throw new Error(`Unknown routine exercise id: ${existingReId}`);
            }
            await tx
              .update(routineExercises)
              .set({
                exerciseId: exerciseIdStr,
                order,
                restTimerSeconds,
              })
              .where(eq(routineExercises.id, existingReId));
            reId = existingReId;
          } else {
            const [re] = await tx
              .insert(routineExercises)
              .values({
                routineId,
                exerciseId: exerciseIdStr,
                order,
                restTimerSeconds,
                supersetId: null,
              })
              .returning({ id: routineExercises.id });
            if (!re?.id) throw new Error(`Failed to insert routine exercise at index ${i}`);
            reId = re.id;
          }

          const sets = Array.isArray(ex.sets) ? ex.sets : [];
          for (let s = 0; s < sets.length; s++) {
            const set = sets[s];
            const setIndex = typeof set.setIndex === "number" ? set.setIndex : s + 1;
            const setType = set.setType != null ? String(set.setType) : "normal";
            const targetWeight = set.targetWeight != null ? Number(set.targetWeight) : null;
            const targetReps = set.targetReps != null ? Number(set.targetReps) : null;
            const targetRpe = set.targetRpe != null ? Number(set.targetRpe) : null;

            const existingSetId =
              set.id != null && String(set.id).trim() ? String(set.id).trim() : "";

            if (existingSetId) {
              const [sRow] = await tx
                .select({ id: exerciseSets.id })
                .from(exerciseSets)
                .innerJoin(routineExercises, eq(exerciseSets.routineExerciseId, routineExercises.id))
                .where(
                  and(
                    eq(exerciseSets.id, existingSetId),
                    eq(routineExercises.routineId, routineId),
                  ),
                )
                .limit(1);
              if (!sRow) {
                throw new Error(`Unknown set id: ${existingSetId}`);
              }
              await tx
                .update(exerciseSets)
                .set({
                  setIndex,
                  setType,
                  targetWeight,
                  targetReps,
                  targetRpe,
                })
                .where(eq(exerciseSets.id, existingSetId));
            } else {
              await tx.insert(exerciseSets).values({
                routineExerciseId: reId,
                setIndex,
                setType,
                targetWeight,
                targetReps,
                targetRpe,
                isCompleted: false,
              });
            }
          }
        }
      }
    });

    const [updatedRoutine] = await db
      .select({
        id: workoutRoutines.id,
        name: workoutRoutines.name,
        notes: workoutRoutines.notes,
      })
      .from(workoutRoutines)
      .where(eq(workoutRoutines.id, routineId))
      .limit(1);

    const exercisesOut = await loadPlanExercisesJson(routineId);

    return res.json({
      id: updatedRoutine!.id,
      name: updatedRoutine!.name,
      exerciseCount: exercisesOut.length,
      isOwn: true,
      notes: updatedRoutine!.notes,
      exercises: exercisesOut,
    });
  } catch (err: any) {
    console.error("❌ [API] PATCH /workouts/routines/:id Error:", err);
    const message = err?.message ?? "Failed to update routine";
    return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, message);
  }
});

/**
 * DELETE /api/workouts/routines/:id
 * 軟刪除（deletedAt）；204 No Content
 */
router.delete("/workouts/routines/:id", verifyJWT, async (req: any, res: any) => {
  try {
    const routineId = String(req.params.id ?? "").trim();
    if (!routineId) return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "routine id is required");

    const coachId = String(req.user?.id ?? req.user?.claims?.sub ?? "").trim();
    if (!coachId) return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");

    const currentUser = await getUserById(coachId);
    if (!currentUser) return sendError(res, 401, ErrorCodes.AUTH_USER_NOT_FOUND, "User not found");
    const role = String(currentUser.role ?? "").toUpperCase();
    if (role !== "COACH" && role !== "ADMIN") {
      return sendError(res, 403, ErrorCodes.FORBIDDEN, "Only coach can delete workout routines");
    }

    const [row] = await db
      .select()
      .from(workoutRoutines)
      .where(eq(workoutRoutines.id, routineId))
      .limit(1);
    if (!row) return sendError(res, 404, ErrorCodes.WORKOUT_NOT_FOUND, "Routine not found");
    if (row.coachId !== coachId) return sendError(res, 403, ErrorCodes.FORBIDDEN, "Not authorized");
    if (row.deletedAt != null) {
      return res.status(204).end();
    }

    await db
      .update(workoutRoutines)
      .set({ deletedAt: new Date() })
      .where(eq(workoutRoutines.id, routineId));

    return res.status(204).end();
  } catch (err: any) {
    console.error("❌ [API] DELETE /workouts/routines/:id Error:", err);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to delete routine");
  }
});

// POST /api/workouts/sessions - Learner 完成訓練打卡
router.post("/workouts/sessions", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user?.claims?.sub ?? req.user?.id;
    if (!userId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");
    }

    const {
      routineId,
      notes,
      rpe,
      exercises: payloadExercises,
    }: {
      routineId?: string;
      notes?: string;
      rpe?: number;
      exercises?: Array<{
        exerciseId: string;
        sets: Array<{ weight?: number; reps?: number; isWarmup?: boolean }>;
      }>;
    } = req.body ?? {};

    if (!Array.isArray(payloadExercises) || payloadExercises.length === 0) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "exercises is required and must not be empty");
    }

    if (routineId) {
      const routine = await db
        .select({ id: workoutRoutines.id, clientId: workoutRoutines.clientId })
        .from(workoutRoutines)
        .where(eq(workoutRoutines.id, routineId))
        .limit(1);
      if (!routine[0]) {
        return sendError(res, 404, ErrorCodes.WORKOUT_NOT_FOUND, "Routine not found");
      }
      if (routine[0].clientId !== String(userId)) {
        return sendError(res, 403, ErrorCodes.FORBIDDEN, "Not authorized for this routine");
      }
    }

    const uniqueExerciseIds = Array.from(
      new Set(
        payloadExercises
          .map((exercise) => String(exercise.exerciseId || "").trim())
          .filter(Boolean)
      )
    );

    const exerciseNameMap = new Map<string, string>();
    if (uniqueExerciseIds.length > 0) {
      const defs = await db
        .select({ id: exercises.id, name: exercises.name })
        .from(exercises)
        .where(inArray(exercises.id, uniqueExerciseIds));
      for (const def of defs) {
        exerciseNameMap.set(def.id, def.name);
      }
    }

    const completedAt = new Date();
    const insertResult = await db.transaction(async (tx) => {
      const [session] = await tx
        .insert(workoutSessions)
        .values({
          userId: String(userId),
          routineId: routineId ? String(routineId) : null,
          notes: notes ?? null,
          rpe: typeof rpe === "number" ? rpe : null,
          completedAt,
        })
        .returning({ id: workoutSessions.id });

      if (!session?.id) {
        throw new Error("Failed to create workout session");
      }

      let totalVolume = 0;

      for (let i = 0; i < payloadExercises.length; i++) {
        const exercise = payloadExercises[i];
        const exerciseId = String(exercise.exerciseId || "").trim();
        const exerciseName = exerciseNameMap.get(exerciseId) ?? `Exercise ${i + 1}`;

        const [sessionExercise] = await tx
          .insert(sessionExercises)
          .values({
            sessionId: session.id,
            exerciseName,
            orderIndex: i + 1,
          })
          .returning({ id: sessionExercises.id });

        if (!sessionExercise?.id) {
          throw new Error(`Failed to create session exercise at index ${i}`);
        }

        const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
        for (let j = 0; j < sets.length; j++) {
          const set = sets[j];
          const weight = typeof set.weight === "number" ? set.weight : null;
          const reps = typeof set.reps === "number" ? set.reps : null;
          const isCompleted = !set.isWarmup;

          await tx.insert(sessionSets).values({
            sessionExerciseId: sessionExercise.id,
            setNumber: j + 1,
            weight: weight == null ? null : String(weight),
            reps,
            completed: isCompleted,
          });

          if (isCompleted && weight != null && reps != null) {
            totalVolume += weight * reps;
          }
        }
      }

      return {
        sessionId: session.id,
        totalVolume,
      };
    });

    return res.status(201).json(insertResult);
  } catch (err: any) {
    console.error("❌ [API] POST /workouts/sessions Error:", err);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to log workout session");
  }
});

// GET /api/workouts/sessions/my - Learner 查詢自己的訓練 Session
router.get("/workouts/sessions/my", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user?.claims?.sub ?? req.user?.id;
    if (!userId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");
    }

    const from = typeof req.query.from === "string" ? new Date(req.query.from) : null;
    const to = typeof req.query.to === "string" ? new Date(req.query.to) : null;

    const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    let limit = 20;
    if (rawLimit !== undefined) {
      const parsedLimit = Number(rawLimit);
      if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
        return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "limit must be a positive integer");
      }
      limit = Math.min(parsedLimit, 50);
    }
    const conditions = [eq(workoutSessions.userId, String(userId))];
    if (from && !Number.isNaN(from.getTime())) {
      conditions.push(gte(workoutSessions.completedAt, from));
    }
    if (to && !Number.isNaN(to.getTime())) {
      conditions.push(lte(workoutSessions.completedAt, to));
    }

    const sessions = await db
      .select({
        id: workoutSessions.id,
        completedAt: workoutSessions.completedAt,
        startedAt: workoutSessions.startedAt,
        rpe: workoutSessions.rpe,
        routineName: workoutRoutines.name,
      })
      .from(workoutSessions)
      .leftJoin(workoutRoutines, eq(workoutSessions.routineId, workoutRoutines.id))
      .where(and(...conditions))
      .orderBy(desc(workoutSessions.completedAt), desc(workoutSessions.startedAt))
      .limit(limit);

    if (sessions.length === 0) {
      return res.json([]);
    }

    const sessionIds = sessions.map((session) => session.id);
    const seRows = await db
      .select({ id: sessionExercises.id, sessionId: sessionExercises.sessionId })
      .from(sessionExercises)
      .where(inArray(sessionExercises.sessionId, sessionIds));

    const sessionExerciseIds = seRows.map((row) => row.id);
    const ssRows =
      sessionExerciseIds.length > 0
        ? await db
            .select({
              sessionExerciseId: sessionSets.sessionExerciseId,
              weight: sessionSets.weight,
              reps: sessionSets.reps,
              completed: sessionSets.completed,
            })
            .from(sessionSets)
            .where(inArray(sessionSets.sessionExerciseId, sessionExerciseIds))
        : [];

    const sessionByExercise = new Map<string, string>();
    for (const row of seRows) {
      sessionByExercise.set(row.id, row.sessionId);
    }

    const volumeBySession = new Map<string, number>();
    const completedSetCountBySession = new Map<string, number>();
    for (const row of ssRows) {
      if (!row.completed) continue;
      const sessionId = sessionByExercise.get(row.sessionExerciseId);
      if (!sessionId) continue;
      const weight = row.weight == null ? 0 : Number(row.weight);
      const reps = row.reps ?? 0;
      const prev = volumeBySession.get(sessionId) ?? 0;
      volumeBySession.set(sessionId, prev + weight * reps);
      const prevSetCount = completedSetCountBySession.get(sessionId) ?? 0;
      completedSetCountBySession.set(sessionId, prevSetCount + 1);
    }

    const result = sessions.map((session) => ({
      sessionId: session.id,
      completedAt: (session.completedAt ?? session.startedAt)?.toISOString() ?? new Date().toISOString(),
      totalVolume: volumeBySession.get(session.id) ?? 0,
      completedSets: completedSetCountBySession.get(session.id) ?? 0,
      rpe: session.rpe ?? undefined,
      routineName: session.routineName ?? undefined,
    }));

    return res.json(result);
  } catch (err: any) {
    console.error("❌ [API] GET /workouts/sessions/my Error:", err);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to fetch workout sessions");
  }
});

// GET /api/workouts/sessions/learner/:learnerId - TRAINER 查指定 LEARNER 的訓練 Session
router.get("/workouts/sessions/learner/:learnerId", verifyJWT, async (req: any, res: any) => {
  try {
    const trainerId = req.user?.id ?? req.user?.claims?.sub;
    if (!trainerId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");
    }

    const trainer = await getUserById(trainerId);
    const role = String(trainer?.role ?? "").toUpperCase();
    if (role !== "COACH" && role !== "ADMIN") {
      return sendError(res, 403, ErrorCodes.FORBIDDEN, "Only trainer can access learner sessions");
    }

    const learnerId = String(req.params.learnerId || "").trim();
    if (!learnerId) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "learnerId is required");
    }

    const relation = await db
      .select({ id: coachClients.id })
      .from(coachClients)
      .where(
        and(
          eq(coachClients.coachId, String(trainerId)),
          eq(coachClients.clientId, learnerId),
          eq(coachClients.status, "active")
        )
      )
      .limit(1);
    if (!relation[0]) {
      return sendError(res, 403, ErrorCodes.FORBIDDEN, "Forbidden");
    }

    const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    let limit = 10;
    if (rawLimit !== undefined) {
      const parsedLimit = Number(rawLimit);
      if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
        return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "limit must be a positive integer");
      }
      limit = Math.min(parsedLimit, 50);
    }

    const sessions = await db
      .select({
        id: workoutSessions.id,
        completedAt: workoutSessions.completedAt,
        startedAt: workoutSessions.startedAt,
        rpe: workoutSessions.rpe,
        routineName: workoutRoutines.name,
      })
      .from(workoutSessions)
      .leftJoin(workoutRoutines, eq(workoutSessions.routineId, workoutRoutines.id))
      .where(eq(workoutSessions.userId, learnerId))
      .orderBy(desc(workoutSessions.completedAt), desc(workoutSessions.startedAt))
      .limit(limit);

    if (sessions.length === 0) {
      return res.json([]);
    }

    const sessionIds = sessions.map((session) => session.id);
    const seRows = await db
      .select({ id: sessionExercises.id, sessionId: sessionExercises.sessionId })
      .from(sessionExercises)
      .where(inArray(sessionExercises.sessionId, sessionIds));

    const sessionExerciseIds = seRows.map((row) => row.id);
    const ssRows =
      sessionExerciseIds.length > 0
        ? await db
            .select({
              sessionExerciseId: sessionSets.sessionExerciseId,
              weight: sessionSets.weight,
              reps: sessionSets.reps,
              completed: sessionSets.completed,
            })
            .from(sessionSets)
            .where(inArray(sessionSets.sessionExerciseId, sessionExerciseIds))
        : [];

    const sessionByExercise = new Map<string, string>();
    for (const row of seRows) {
      sessionByExercise.set(row.id, row.sessionId);
    }

    const volumeBySession = new Map<string, number>();
    const completedSetCountBySession = new Map<string, number>();
    for (const row of ssRows) {
      if (!row.completed) continue;
      const sessionId = sessionByExercise.get(row.sessionExerciseId);
      if (!sessionId) continue;
      const weight = row.weight == null ? 0 : Number(row.weight);
      const reps = row.reps ?? 0;
      const prev = volumeBySession.get(sessionId) ?? 0;
      volumeBySession.set(sessionId, prev + weight * reps);
      const prevSetCount = completedSetCountBySession.get(sessionId) ?? 0;
      completedSetCountBySession.set(sessionId, prevSetCount + 1);
    }

    const result = sessions.map((session) => ({
      sessionId: session.id,
      completedAt: (session.completedAt ?? session.startedAt)?.toISOString() ?? new Date().toISOString(),
      totalVolume: volumeBySession.get(session.id) ?? 0,
      completedSets: completedSetCountBySession.get(session.id) ?? 0,
      rpe: session.rpe ?? undefined,
      routineName: session.routineName ?? undefined,
    }));

    return res.json(result);
  } catch (err: any) {
    console.error("❌ [API] GET /workouts/sessions/learner/:learnerId Error:", err);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to fetch learner workout sessions");
  }
});

// GET /api/workouts/sessions/learner/:learnerId/:sessionId - TRAINER 查指定 LEARNER 單筆 Session 詳情
router.get("/workouts/sessions/learner/:learnerId/:sessionId", verifyJWT, async (req: any, res: any) => {
  try {
    const trainerId = req.user?.id ?? req.user?.claims?.sub;
    if (!trainerId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");
    }

    const trainer = await getUserById(trainerId);
    const role = String(trainer?.role ?? "").toUpperCase();
    if (role !== "COACH" && role !== "ADMIN") {
      return sendError(res, 403, ErrorCodes.FORBIDDEN, "Only trainer can access learner session detail");
    }

    const learnerId = String(req.params.learnerId || "").trim();
    const sessionId = String(req.params.sessionId || "").trim();
    if (!learnerId || !sessionId) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "learnerId and sessionId are required");
    }

    const relation = await db
      .select({ id: coachClients.id })
      .from(coachClients)
      .where(
        and(
          eq(coachClients.coachId, String(trainerId)),
          eq(coachClients.clientId, learnerId),
          eq(coachClients.status, "active")
        )
      )
      .limit(1);
    if (!relation[0]) {
      return sendError(res, 403, ErrorCodes.FORBIDDEN, "Forbidden");
    }

    const sessionRows = await db
      .select({
        id: workoutSessions.id,
        userId: workoutSessions.userId,
        startedAt: workoutSessions.startedAt,
        completedAt: workoutSessions.completedAt,
        notes: workoutSessions.notes,
        rpe: workoutSessions.rpe,
        routineName: workoutRoutines.name,
      })
      .from(workoutSessions)
      .leftJoin(workoutRoutines, eq(workoutSessions.routineId, workoutRoutines.id))
      .where(eq(workoutSessions.id, sessionId))
      .limit(1);

    const session = sessionRows[0];
    if (!session) {
      return sendError(res, 404, ErrorCodes.NOT_FOUND, "Session not found");
    }
    if (session.userId !== learnerId) {
      return sendError(res, 403, ErrorCodes.FORBIDDEN, "Forbidden");
    }

    const exerciseRows = await db
      .select({
        id: sessionExercises.id,
        exerciseName: sessionExercises.exerciseName,
        orderIndex: sessionExercises.orderIndex,
      })
      .from(sessionExercises)
      .where(eq(sessionExercises.sessionId, sessionId))
      .orderBy(asc(sessionExercises.orderIndex));

    const sessionExerciseIds = exerciseRows.map((row) => row.id);
    const setRows =
      sessionExerciseIds.length > 0
        ? await db
            .select({
              id: sessionSets.id,
              sessionExerciseId: sessionSets.sessionExerciseId,
              setNumber: sessionSets.setNumber,
              weight: sessionSets.weight,
              reps: sessionSets.reps,
              completed: sessionSets.completed,
            })
            .from(sessionSets)
            .where(inArray(sessionSets.sessionExerciseId, sessionExerciseIds))
            .orderBy(asc(sessionSets.setNumber))
        : [];

    let totalVolume = 0;
    for (const set of setRows) {
      if (!set.completed) continue;
      const weight = set.weight == null ? 0 : Number(set.weight);
      const reps = set.reps ?? 0;
      totalVolume += weight * reps;
    }

    const setsByExercise = new Map<string, typeof setRows>();
    for (const set of setRows) {
      const list = setsByExercise.get(set.sessionExerciseId) ?? [];
      list.push(set);
      setsByExercise.set(set.sessionExerciseId, list);
    }

    const exercisesOut = exerciseRows.map((exercise) => ({
      id: exercise.id,
      exerciseName: exercise.exerciseName,
      orderIndex: exercise.orderIndex,
      sets: (setsByExercise.get(exercise.id) ?? []).map((set) => ({
        id: set.id,
        setNumber: set.setNumber,
        weight: set.weight == null ? null : Number(set.weight),
        reps: set.reps,
        completed: set.completed,
      })),
    }));

    return res.json({
      sessionId: session.id,
      completedAt: (session.completedAt ?? session.startedAt)?.toISOString() ?? new Date().toISOString(),
      totalVolume,
      rpe: session.rpe ?? undefined,
      routineName: session.routineName ?? undefined,
      notes: session.notes ?? "",
      exercises: exercisesOut,
    });
  } catch (err: any) {
    console.error("❌ [API] GET /workouts/sessions/learner/:learnerId/:sessionId Error:", err);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to fetch learner workout session detail");
  }
});

// POST /api/workouts/sessions/:sessionId/feedback - TRAINER 新增或更新點評
router.post("/workouts/sessions/:sessionId/feedback", verifyJWT, async (req: any, res: any) => {
  try {
    const trainerId = req.user?.id ?? req.user?.claims?.sub;
    if (!trainerId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");
    }

    const trainer = await getUserById(trainerId);
    const role = String(trainer?.role ?? "").toUpperCase();
    if (role !== "COACH" && role !== "ADMIN") {
      return sendError(res, 403, ErrorCodes.FORBIDDEN, "Only trainer can submit feedback");
    }

    const sessionId = String(req.params.sessionId || "").trim();
    if (!sessionId) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "sessionId is required");
    }

    const contentRaw = typeof req.body?.content === "string" ? req.body.content : "";
    const content = contentRaw.trim();
    if (!content) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "content is required");
    }
    if (content.length > 500) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "content must be 500 characters or less");
    }

    const { session, isTrainerOfLearner } = await getSessionWithTrainerAccess(sessionId, String(trainerId));
    if (!session) {
      return sendError(res, 404, ErrorCodes.NOT_FOUND, "Session not found");
    }
    if (!isTrainerOfLearner) {
      return sendError(res, 403, ErrorCodes.FORBIDDEN, "Forbidden");
    }

    const [saved] = await db
      .insert(sessionFeedbacks)
      .values({
        sessionId: session.id,
        trainerId: String(trainerId),
        content,
      })
      .onConflictDoUpdate({
        target: [sessionFeedbacks.sessionId, sessionFeedbacks.trainerId],
        set: {
          content,
          updatedAt: new Date(),
        },
      })
      .returning({
        id: sessionFeedbacks.id,
        content: sessionFeedbacks.content,
        createdAt: sessionFeedbacks.createdAt,
        updatedAt: sessionFeedbacks.updatedAt,
      });

    const trainerName = [trainer?.firstName, trainer?.lastName].filter(Boolean).join(" ").trim() || trainer?.email || "教練";
    void notifySessionFeedback({
      learnerId: session.learnerId,
      trainerName,
      sessionId: session.id,
      content,
    });

    return res.status(200).json(saved);
  } catch (err: any) {
    console.error("❌ [API] POST /workouts/sessions/:sessionId/feedback Error:", err);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to submit session feedback");
  }
});

// GET /api/workouts/sessions/:sessionId/feedback - 讀取某筆訓練點評
router.get("/workouts/sessions/:sessionId/feedback", verifyJWT, async (req: any, res: any) => {
  try {
    const currentUserId = req.user?.id ?? req.user?.claims?.sub;
    if (!currentUserId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");
    }

    const sessionId = String(req.params.sessionId || "").trim();
    if (!sessionId) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "sessionId is required");
    }

    const { session, isTrainerOfLearner } = await getSessionWithTrainerAccess(sessionId, String(currentUserId));
    if (!session) {
      return sendError(res, 404, ErrorCodes.NOT_FOUND, "Session not found");
    }

    const isOwner = session.learnerId === String(currentUserId);
    if (!isOwner && !isTrainerOfLearner) {
      return sendError(res, 403, ErrorCodes.FORBIDDEN, "Forbidden");
    }

    const rows = await db
      .select({
        id: sessionFeedbacks.id,
        trainerId: sessionFeedbacks.trainerId,
        trainerFirstName: users.firstName,
        trainerLastName: users.lastName,
        trainerEmail: users.email,
        content: sessionFeedbacks.content,
        createdAt: sessionFeedbacks.createdAt,
        updatedAt: sessionFeedbacks.updatedAt,
      })
      .from(sessionFeedbacks)
      .innerJoin(users, eq(sessionFeedbacks.trainerId, users.id))
      .where(eq(sessionFeedbacks.sessionId, session.id))
      .orderBy(desc(sessionFeedbacks.updatedAt));

    const feedbacks = rows.map((row) => {
      const trainerName =
        [row.trainerFirstName, row.trainerLastName].filter(Boolean).join(" ").trim() || row.trainerEmail;
      return {
        id: row.id,
        trainerId: row.trainerId,
        trainerName,
        content: row.content,
        createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
        updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
      };
    });

    return res.status(200).json(feedbacks);
  } catch (err: any) {
    console.error("❌ [API] GET /workouts/sessions/:sessionId/feedback Error:", err);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to fetch session feedback");
  }
});

// GET /api/workouts/sessions/:sessionId - Learner 查詢單一 Session 詳情
router.get("/workouts/sessions/:sessionId", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user?.claims?.sub ?? req.user?.id;
    if (!userId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");
    }
    const sessionId = String(req.params.sessionId || "").trim();
    if (!sessionId) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "sessionId is required");
    }

    const sessionRows = await db
      .select({
        id: workoutSessions.id,
        userId: workoutSessions.userId,
        startedAt: workoutSessions.startedAt,
        completedAt: workoutSessions.completedAt,
        notes: workoutSessions.notes,
        rpe: workoutSessions.rpe,
        routineName: workoutRoutines.name,
      })
      .from(workoutSessions)
      .leftJoin(workoutRoutines, eq(workoutSessions.routineId, workoutRoutines.id))
      .where(eq(workoutSessions.id, sessionId))
      .limit(1);

    const session = sessionRows[0];
    if (!session) {
      return sendError(res, 404, ErrorCodes.NOT_FOUND, "Session not found");
    }
    if (session.userId !== String(userId)) {
      return sendError(res, 403, ErrorCodes.FORBIDDEN, "Not authorized for this session");
    }

    const exerciseRows = await db
      .select({
        id: sessionExercises.id,
        exerciseName: sessionExercises.exerciseName,
        orderIndex: sessionExercises.orderIndex,
      })
      .from(sessionExercises)
      .where(eq(sessionExercises.sessionId, sessionId))
      .orderBy(asc(sessionExercises.orderIndex));

    const sessionExerciseIds = exerciseRows.map((row) => row.id);
    const setRows =
      sessionExerciseIds.length > 0
        ? await db
            .select({
              id: sessionSets.id,
              sessionExerciseId: sessionSets.sessionExerciseId,
              setNumber: sessionSets.setNumber,
              weight: sessionSets.weight,
              reps: sessionSets.reps,
              completed: sessionSets.completed,
            })
            .from(sessionSets)
            .where(inArray(sessionSets.sessionExerciseId, sessionExerciseIds))
            .orderBy(asc(sessionSets.setNumber))
        : [];

    let totalVolume = 0;
    for (const set of setRows) {
      if (!set.completed) continue;
      const weight = set.weight == null ? 0 : Number(set.weight);
      const reps = set.reps ?? 0;
      totalVolume += weight * reps;
    }

    const setsByExercise = new Map<string, typeof setRows>();
    for (const set of setRows) {
      const list = setsByExercise.get(set.sessionExerciseId) ?? [];
      list.push(set);
      setsByExercise.set(set.sessionExerciseId, list);
    }

    const exercisesOut = exerciseRows.map((exercise) => ({
      id: exercise.id,
      exerciseName: exercise.exerciseName,
      orderIndex: exercise.orderIndex,
      sets: (setsByExercise.get(exercise.id) ?? []).map((set) => ({
        id: set.id,
        setNumber: set.setNumber,
        weight: set.weight == null ? null : Number(set.weight),
        reps: set.reps,
        completed: set.completed,
      })),
    }));

    return res.json({
      sessionId: session.id,
      completedAt: (session.completedAt ?? session.startedAt)?.toISOString() ?? new Date().toISOString(),
      totalVolume,
      rpe: session.rpe ?? undefined,
      routineName: session.routineName ?? undefined,
      notes: session.notes ?? "",
      exercises: exercisesOut,
    });
  } catch (err: any) {
    console.error("❌ [API] GET /workouts/sessions/:sessionId Error:", err);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to fetch workout session detail");
  }
});

// POST /api/workouts - 創建訓練記錄
router.post("/workouts", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    
    if (!userId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Not authenticated");
    }

    const {
      workoutType,
      exerciseName,
      duration,
      durationMinutes,
      calories,
      caloriesBurned,
      sets,
      reps,
      weight,
      weightUnit,
      exercises, // ✅ 接收完整訓練組陣列
      notes,
      performedAt,
      date,
    } = req.body;

    // 添加調試日誌
    console.log('📝 Creating workout:', {
      workoutType,
      exerciseName,
      duration,
      performedAt: performedAt || date,
    });
    console.log("[POST /api/workouts] Request body:", JSON.stringify(req.body, null, 2));
    console.log("[POST /api/workouts] Received exercises:", exercises);

    // 驗證必需欄位
    const isStrength = workoutType === 'STRENGTH';
    const isCardio = workoutType === 'CARDIO';

    if (!workoutType || (!isStrength && !isCardio)) {
      console.log("[POST /api/workouts] Validation failed: workoutType missing or invalid");
      return res.status(400).json({
        error: 'Missing required field: workoutType (must be STRENGTH or CARDIO)'
      });
    }

    if (!exerciseName) {
      console.log("[POST /api/workouts] Validation failed: exerciseName missing");
      return res.status(400).json({
        error: 'Missing required field: exerciseName'
      });
    }

    if (!performedAt && !date) {
      console.log("[POST /api/workouts] Validation failed: performedAt missing");
      return res.status(400).json({
        error: 'Missing required field: performedAt'
      });
    }

    // 對於力量訓練，驗證 exercises 數組
    if (isStrength) {
      if (!exercises || !Array.isArray(exercises) || exercises.length === 0) {
        console.log("[POST /api/workouts] Validation failed: No exercises provided for STRENGTH workout");
        return res.status(400).json({
          error: 'No exercises provided. For STRENGTH workouts, exercises array is required.'
        });
      }
    }

    // 對於 Cardio，duration 必須 > 0
    const finalDuration = duration || durationMinutes || 0;
    if (isCardio && (!duration && !durationMinutes || finalDuration <= 0)) {
      console.log("[POST /api/workouts] Validation failed: Cardio duration invalid");
      return res.status(400).json({
        error: 'Cardio workouts require duration > 0'
      });
    }

    // 構建 exercises 資料（jsonb 欄位，直接傳入 JS 物件）
    let exercisesData: unknown = null;
    
    // 如果前端直接提供了 exercises 數組，使用它（優先級最高）
    if (exercises && Array.isArray(exercises)) {
      exercisesData = exercises;
      console.log("[POST /api/workouts] Using provided exercises array with", exercises.length, "sets");
    }
    // 否則，如果提供了單個 sets/reps/weight，創建單元素數組（向後兼容）
    else if (exerciseName || sets || reps || weight) {
      exercisesData = [{
        exerciseName: exerciseName || null,
        sets: sets || null,
        reps: reps || null,
        weight: weight || null,
        weightUnit: weightUnit || 'kg',
      }];
      console.log("[POST /api/workouts] Creating single exercise from individual fields");
    }

    const finalPerformedAt = performedAt || date || new Date();
    const finalCalories = calories || caloriesBurned || null;
    const workoutName = exerciseName || workoutType || 'Workout';

    const result = await pool.query(
      `INSERT INTO workouts (
        user_id, name, workout_type, duration, calories_burned, exercises, notes, performed_at, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
      ) RETURNING *`,
      [
        userId,
        workoutName,
        workoutType,
        finalDuration,
        finalCalories,
        exercisesData,
        notes || null,
        finalPerformedAt,
      ]
    );

    console.log('✅ Workout saved successfully:', result.rows[0].id);
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error("Error creating workout:", error);
    sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to create workout");
  }
});

// GET /api/workouts - 查詢訓練記錄
router.get("/workouts", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    
    if (!userId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Not authenticated");
    }

    const { date } = req.query;

    let query = `SELECT * FROM workouts WHERE user_id = $1`;
    const params: any[] = [userId];

    if (date && typeof date === 'string') {
      // date 格式：2025-12-05（香港本地日期）
      // 需要轉換為 UTC 時間範圍查詢
      // 香港是 UTC+8，所以需要減 8 小時來轉換為 UTC
      
      // 解析日期字符串（例如：2025-12-05）
      const [year, month, day] = date.split('-').map(Number);
      
      // 創建 UTC 日期的開始時間（2025-12-05 00:00:00 UTC）
      const utcStartOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      
      // 創建 UTC 日期的結束時間（2025-12-05 23:59:59.999 UTC）
      const utcEndOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
      
      // 轉換為對應的 UTC 時間（減去 8 小時，因為香港是 UTC+8）
      // 2025-12-05 00:00:00 HKT = 2025-12-04 16:00:00 UTC
      // 2025-12-05 23:59:59 HKT = 2025-12-05 15:59:59 UTC
      const startOfDayUTC = new Date(utcStartOfDay.getTime() - 8 * 60 * 60 * 1000);
      const endOfDayUTC = new Date(utcEndOfDay.getTime() - 8 * 60 * 60 * 1000);
      
      console.log(`[GET /api/workouts] Query for date: ${date} (HKT)`);
      console.log(`[GET /api/workouts] UTC range: ${startOfDayUTC.toISOString()} to ${endOfDayUTC.toISOString()}`);
      
      query += ` AND performed_at >= $2 AND performed_at <= $3`;
      params.push(startOfDayUTC.toISOString());
      params.push(endOfDayUTC.toISOString());
    } else {
      // 沒有指定日期，返回最近一天的數據
      query += ` AND performed_at >= NOW() - INTERVAL '1 day'`;
    }

    query += ` ORDER BY performed_at DESC`;

    const result = await pool.query(query, params);
    
    // 轉換數據格式以匹配前端期望
    const workouts = result.rows.map((row: any) => {
      // 解析 exercises JSON 以提取 exercise_name
      let exerciseName = null;
      if (row.exercises) {
        try {
          const exercises = typeof row.exercises === 'string' 
            ? JSON.parse(row.exercises) 
            : row.exercises;
          if (Array.isArray(exercises) && exercises.length > 0) {
            exerciseName = exercises[0]?.exerciseName || null;
          }
        } catch (e) {
          console.error('Error parsing exercises in GET /api/workouts:', e);
        }
      }

      return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        workoutType: row.workout_type,
        workout_type: row.workout_type, // 保留原始字段以兼容
        duration: row.duration,
        durationMinutes: row.duration, // 添加別名
        calories: row.calories_burned,
        caloriesBurned: row.calories_burned, // 添加別名
        exercises: row.exercises,
        exercise_name: exerciseName, // 從 exercises JSON 中提取
        notes: row.notes,
        date: row.performed_at,
        performed_at: row.performed_at, // 保留原始字段
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
    
    console.log(`[GET /api/workouts] Returning ${workouts.length} workouts for date: ${date || 'today'}`);
    res.json(workouts);
  } catch (error: any) {
    console.error("Error fetching workouts:", error);
    sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to fetch workouts");
  }
});

// GET /api/workouts/:id - 獲取單個訓練詳情
router.get("/workouts/:id", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const workoutId = req.params.id;

    if (!userId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Not authenticated");
    }

    const result = await pool.query(
      `SELECT * FROM workouts WHERE id = $1 AND user_id = $2`,
      [workoutId, userId]
    );

    if (result.rows.length === 0) {
      return sendError(res, 404, ErrorCodes.NOT_FOUND, "Workout not found");
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error fetching workout:", error);
    sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to fetch workout");
  }
});

// PUT /api/workouts/:id - 更新訓練
router.put("/workouts/:id", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const workoutId = req.params.id;

    if (!userId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Not authenticated");
    }

    const {
      workoutType,
      duration,
      durationMinutes,
      calories,
      caloriesBurned,
      sets,
      reps,
      weight,
      weightUnit,
      exerciseName,
      notes,
      performedAt,
      date,
    } = req.body;

    // 添加調試日誌
    console.log("[PUT /api/workouts/:id] Request body:", JSON.stringify(req.body, null, 2));

    // 檢查 workout 是否存在且屬於該用戶
    const existingResult = await pool.query(
      "SELECT user_id FROM workouts WHERE id = $1",
      [workoutId]
    );

    if (
      existingResult.rows.length === 0 ||
      existingResult.rows[0].user_id !== userId
    ) {
      return res.status(403).json({
        error: "You do not have permission to update this workout",
      });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (workoutType !== undefined) {
      updates.push(`workout_type = $${paramCount++}`);
      values.push(workoutType);
    }
    if (duration !== undefined || durationMinutes !== undefined) {
      updates.push(`duration = $${paramCount++}`);
      values.push(duration || durationMinutes);
    }
    if (calories !== undefined || caloriesBurned !== undefined) {
      updates.push(`calories_burned = $${paramCount++}`);
      values.push(calories || caloriesBurned);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramCount++}`);
      values.push(notes);
    }
    if (performedAt !== undefined || date !== undefined) {
      updates.push(`performed_at = $${paramCount++}`);
      values.push(performedAt || date);
    }

    // 處理 exercises（jsonb 欄位，直接傳入 JS 物件）
    if (req.body.exercises && Array.isArray(req.body.exercises)) {
      console.log("[PUT /api/workouts/:id] Using provided exercises array with", req.body.exercises.length, "sets");
      updates.push(`exercises = $${paramCount++}`);
      values.push(req.body.exercises);
    }
    // 否則，如果提供了單個字段，更新第一個 exercise（向後兼容）
    else if (exerciseName !== undefined || sets !== undefined || reps !== undefined || weight !== undefined) {
      // 獲取現有的 exercises（jsonb 欄位，pg 自動 parse 為 JS 物件）
      const existingWorkout = await pool.query(
        "SELECT exercises FROM workouts WHERE id = $1",
        [workoutId]
      );
      
      let exercises: unknown[] = [];
      const raw = existingWorkout.rows[0]?.exercises;
      if (raw) {
        // jsonb 欄位讀出已是物件；保留對舊 text 欄位的相容處理
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed) && parsed.length > 0) {
          exercises = parsed;
        }
      }
      if (exercises.length > 0) {
        exercises = [{
          ...(exercises[0] as object),
          exerciseName: exerciseName !== undefined ? exerciseName : (exercises[0] as any).exerciseName,
          sets: sets !== undefined ? sets : (exercises[0] as any).sets,
          reps: reps !== undefined ? reps : (exercises[0] as any).reps,
          weight: weight !== undefined ? weight : (exercises[0] as any).weight,
          weightUnit: weightUnit !== undefined ? weightUnit : ((exercises[0] as any).weightUnit || 'kg'),
        }];
      } else {
        exercises = [{
          exerciseName: exerciseName || null,
          sets: sets || null,
          reps: reps || null,
          weight: weight || null,
          weightUnit: weightUnit || 'kg',
        }];
      }
      
      updates.push(`exercises = $${paramCount++}`);
      values.push(exercises);
    }

    updates.push(`updated_at = NOW()`);

    if (updates.length === 1) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "No fields to update");
    }

    const updateQuery = `UPDATE workouts SET ${updates.join(
      ", "
    )} WHERE id = $${paramCount} RETURNING *`;
    values.push(workoutId);

    const result = await pool.query(updateQuery, values);
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error updating workout:", error);
    sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to update workout");
  }
});

// DELETE /api/workouts/:id - 刪除訓練
router.delete("/workouts/:id", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const workoutId = req.params.id;

    if (!userId) {
      return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Not authenticated");
    }

    const existingResult = await pool.query(
      "SELECT user_id FROM workouts WHERE id = $1",
      [workoutId]
    );

    if (
      existingResult.rows.length === 0 ||
      existingResult.rows[0].user_id !== userId
    ) {
      return res.status(403).json({
        error: "You do not have permission to delete this workout",
      });
    }

    await pool.query("DELETE FROM workouts WHERE id = $1", [workoutId]);
    res.json({ message: "Workout deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting workout:", error);
    sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to delete workout");
  }
});

// GET /api/workouts/stats/personal-best - 個人最佳記錄
router.get(
  "/workouts/stats/personal-best",
  isAuthenticated,
  async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;

      if (!userId) {
        return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Not authenticated");
      }

      // 從 exercises JSON 中提取個人最佳記錄
      const result = await pool.query(
        `SELECT 
          exercises,
          workout_type,
          performed_at,
          name
         FROM workouts
         WHERE user_id = $1 
           AND exercises IS NOT NULL 
           AND exercises != 'null'
           AND exercises != '[]'
         ORDER BY performed_at DESC`,
        [userId]
      );

      // 解析 exercises JSON 並找出個人最佳
      const personalBests: any[] = [];
      const exerciseMap = new Map<string, any>();

      for (const row of result.rows) {
        try {
          const exercises = typeof row.exercises === 'string' 
            ? JSON.parse(row.exercises) 
            : row.exercises;
          
          if (Array.isArray(exercises)) {
            for (const exercise of exercises) {
              if (exercise.exerciseName && exercise.weight) {
                const key = `${exercise.exerciseName}_${exercise.weightUnit || 'kg'}`;
                const current = exerciseMap.get(key);
                
                if (!current || parseFloat(exercise.weight) > parseFloat(current.max_weight)) {
                  exerciseMap.set(key, {
                    exercise_name: exercise.exerciseName,
                    max_weight: parseFloat(exercise.weight),
                    weight_unit: exercise.weightUnit || 'kg',
                    max_sets: exercise.sets || null,
                    max_reps: exercise.reps || null,
                    last_performed: row.performed_at,
                    workout_type: row.workout_type,
                  });
                }
              }
            }
          }
        } catch (e) {
          console.error("Error parsing exercises JSON:", e);
        }
      }

      personalBests.push(...Array.from(exerciseMap.values()));
      personalBests.sort((a, b) => (b.max_weight || 0) - (a.max_weight || 0));

      res.json(personalBests);
    } catch (error: any) {
      console.error("Error fetching personal best:", error);
      sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to fetch personal best");
    }
  }
);

export default router;

