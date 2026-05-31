import { Router } from "express";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db";
import {
  coachClients,
  planAssignments,
  routineExercises,
  workoutRoutines,
  users,
} from "../db/schema";
import { verifyJWT } from "../replitAuth";
import { getUserById } from "../db/queries";
import { loadPlanExercisesJson } from "../services/planDetail";
import { notifyPlanAssigned } from "../services/notificationService";
import { sendError } from "../lib/response";
import { ErrorCodes } from "@shared/error-codes";

const router = Router();

function getCurrentUserId(req: any): string | null {
  return String(req.user?.id ?? req.user?.claims?.sub ?? "").trim() || null;
}

function isTrainerRole(role: string | null | undefined): boolean {
  const upper = String(role ?? "").toUpperCase();
  return upper === "COACH" || upper === "ADMIN";
}

async function assertActiveTrainerForLearner(trainerId: string, learnerId: string) {
  const rel = await db
    .select({ id: coachClients.id })
    .from(coachClients)
    .where(
      and(
        eq(coachClients.coachId, trainerId),
        eq(coachClients.clientId, learnerId),
        eq(coachClients.status, "active"),
      ),
    )
    .limit(1);

  return rel.length > 0;
}

async function getExerciseCountByRoutineIds(routineIds: string[]) {
  if (routineIds.length === 0) return new Map<string, number>();

  const rows = await db
    .select({ routineId: routineExercises.routineId, id: routineExercises.id })
    .from(routineExercises)
    .where(inArray(routineExercises.routineId, routineIds));

  const map = new Map<string, number>();
  for (const r of rows) {
    const prev = map.get(r.routineId) ?? 0;
    map.set(r.routineId, prev + 1);
  }
  return map;
}

router.get("/plans/my", verifyJWT, async (req: any, res: any) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");

    const currentUser = await getUserById(userId);
    if (!currentUser) return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");
    if (isTrainerRole(currentUser.role)) {
      return sendError(res, 403, ErrorCodes.FORBIDDEN, "Only learners can access /api/plans/my");
    }

    const learnerId = userId;

    const assignedRows = await db
      .select({
        routineId: planAssignments.routineId,
        trainerId: planAssignments.trainerId,
        assignedAt: planAssignments.assignedAt,
        note: planAssignments.note,
      })
      .from(planAssignments)
      .where(eq(planAssignments.learnerId, learnerId))
      .orderBy(desc(planAssignments.assignedAt));

    let assignedRoutineIds = assignedRows.map((r) => r.routineId);
    if (assignedRoutineIds.length > 0) {
      const notDeleted = await db
        .select({ id: workoutRoutines.id })
        .from(workoutRoutines)
        .where(
          and(inArray(workoutRoutines.id, assignedRoutineIds), isNull(workoutRoutines.deletedAt)),
        );
      const allowed = new Set(notDeleted.map((x) => x.id));
      assignedRoutineIds = assignedRoutineIds.filter((id) => allowed.has(id));
    }
    const assignedRoutineIdSet = new Set(assignedRoutineIds);
    const assignedRowsActive = assignedRows.filter((r) => assignedRoutineIdSet.has(r.routineId));

    const selfBuiltRoutines = await db
      .select({
        id: workoutRoutines.id,
        name: workoutRoutines.name,
        notes: workoutRoutines.notes,
        scheduledDate: workoutRoutines.scheduledDate,
      })
      .from(workoutRoutines)
      .where(and(eq(workoutRoutines.clientId, learnerId), isNull(workoutRoutines.deletedAt)));

    const selfBuiltSummaries = selfBuiltRoutines
      .filter((r) => !assignedRoutineIdSet.has(r.id))
      .map((r) => ({
        id: r.id,
        name: r.name,
        notes: r.notes,
      }));

    const allRoutineIds = Array.from(
      new Set([...assignedRoutineIds, ...selfBuiltSummaries.map((r) => r.id)]),
    );
    const exerciseCountMap = await getExerciseCountByRoutineIds(allRoutineIds);

    // 指派的計畫需要顯示「由 {trainerName} 指派」，
    // 因此先把所有 trainerId 查出對應的顯示名稱。
    const trainerIds = Array.from(new Set(assignedRowsActive.map((r) => r.trainerId))).filter(Boolean);
    const trainerNameMap = new Map<string, string>();
    if (trainerIds.length > 0) {
      const trainerRows = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        })
        .from(users)
        .where(inArray(users.id, trainerIds));

      for (const t of trainerRows) {
        const displayName = `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim();
        trainerNameMap.set(t.id, displayName || t.email);
      }
    }

    const assignedSummaries = assignedRowsActive.map((row) => ({
      id: row.routineId,
      name: "",
      exerciseCount: exerciseCountMap.get(row.routineId) ?? 0,
      isOwn: false,
      assignedBy: row.trainerId,
      trainerName: trainerNameMap.get(row.trainerId) ?? "教練",
      assignedAt: row.assignedAt ? new Date(row.assignedAt).toISOString() : undefined,
      note: row.note,
    }));

    // 補上 routine.name（避免一次性取整個 detail）
    const assignedRoutines = await db
      .select({ id: workoutRoutines.id, name: workoutRoutines.name, clientId: workoutRoutines.clientId })
      .from(workoutRoutines)
      .where(inArray(workoutRoutines.id, assignedRoutineIds.length ? assignedRoutineIds : ["__none__"]))
      .limit(assignedRoutineIds.length);

    const routineNameMap = new Map<string, string>(
      assignedRoutines.map((r) => [r.id, r.name]),
    );

    const assignedSummariesFinal = assignedSummaries.map((s) => ({
      ...s,
      name: routineNameMap.get(s.id) ?? "未命名計畫",
      isOwn: false,
    }));

    // 自建 plans 直接推到後面即可（規格只要求指派部分排序）
    const selfBuiltFinal = selfBuiltSummaries.map((r) => ({
      id: r.id,
      name: r.name ?? "未命名計畫",
      exerciseCount: exerciseCountMap.get(r.id) ?? 0,
      isOwn: true,
    }));

    return res.json([...assignedSummariesFinal, ...selfBuiltFinal]);
  } catch (err: any) {
    console.error("[API] GET /plans/my Error:", err);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to fetch plans");
  }
});

// 注意：限制為 UUID 形狀，避免吃到 /plans/available 等靜態路由
router.get("/plans/:routineId([0-9a-fA-F-]{36})", verifyJWT, async (req: any, res: any) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");

    const routineId = String(req.params.routineId ?? "").trim();
    if (!routineId) return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "routineId is required");

    const currentUser = await getUserById(userId);
    if (!currentUser) return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");

    const routine = await db
      .select({
        id: workoutRoutines.id,
        name: workoutRoutines.name,
        notes: workoutRoutines.notes,
        clientId: workoutRoutines.clientId,
        coachId: workoutRoutines.coachId,
        deletedAt: workoutRoutines.deletedAt,
      })
      .from(workoutRoutines)
      .where(eq(workoutRoutines.id, routineId))
      .limit(1);

    if (!routine[0]) return sendError(res, 404, ErrorCodes.PLAN_NOT_FOUND, "Plan not found");
    const r = routine[0];
    if (r.deletedAt != null) return sendError(res, 404, ErrorCodes.PLAN_NOT_FOUND, "Plan not found");

    let isOwn = false;
    let assignedBy: string | undefined;
    let assignedAt: string | undefined;
    let note: string | null | undefined;
    let trainerName: string | undefined;

    if (isTrainerRole(currentUser.role)) {
      // TRAINER：允許查看自己建立的 routine（coachId 相符）
      // 也允許查看曾被該 trainer 指派的 routine（對應 planAssignments.trainerId）
      const assignmentExists = await db
        .select({ id: planAssignments.id })
        .from(planAssignments)
        .where(and(eq(planAssignments.routineId, routineId), eq(planAssignments.trainerId, userId)))
        .limit(1);

      const canView = r.coachId === userId || assignmentExists.length > 0;
      if (!canView) return sendError(res, 403, ErrorCodes.FORBIDDEN, "Not authorized");
      isOwn = r.coachId === userId;
    } else {
      // LEARNER：允許查看擁有（clientId 相符）或被指派（planAssignments.learnerId 相符）
      if (r.clientId === userId) {
        isOwn = true;
      } else {
        const assignment = await db
          .select({
            trainerId: planAssignments.trainerId,
            assignedAt: planAssignments.assignedAt,
            note: planAssignments.note,
          })
          .from(planAssignments)
          .where(and(eq(planAssignments.routineId, routineId), eq(planAssignments.learnerId, userId)))
          .limit(1);

        if (!assignment[0]) return sendError(res, 403, ErrorCodes.FORBIDDEN, "Not authorized");
        assignedBy = assignment[0].trainerId;
        assignedAt = assignment[0].assignedAt ? new Date(assignment[0].assignedAt).toISOString() : undefined;
        note = assignment[0].note;
        isOwn = false;

        const trainerUser = await db
          .select({
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
          })
          .from(users)
          .where(eq(users.id, assignedBy))
          .limit(1);

        if (trainerUser[0]) {
          const displayName = `${trainerUser[0].firstName ?? ""} ${trainerUser[0].lastName ?? ""}`.trim();
          trainerName = displayName || trainerUser[0].email;
        }
      }
    }

    const exercisesOut = await loadPlanExercisesJson(routineId);

    return res.json({
      id: r.id,
      name: r.name,
      exerciseCount: exercisesOut.length,
      isOwn,
      assignedBy,
      trainerName,
      assignedAt,
      note,
      notes: r.notes,
      exercises: exercisesOut,
    });
  } catch (err: any) {
    console.error("[API] GET /plans/:routineId Error:", err);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to fetch plan detail");
  }
});

router.get("/plans/available", verifyJWT, async (req: any, res: any) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");

    const currentUser = await getUserById(userId);
    if (!currentUser) return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");
    if (!isTrainerRole(currentUser.role)) return sendError(res, 403, ErrorCodes.FORBIDDEN, "Only trainer can access");

    const routines = await db
      .select({
        id: workoutRoutines.id,
        name: workoutRoutines.name,
      })
      .from(workoutRoutines)
      .where(and(eq(workoutRoutines.coachId, userId), isNull(workoutRoutines.deletedAt)));

    const routineIds = routines.map((r) => r.id);
    const exerciseCountMap = await getExerciseCountByRoutineIds(routineIds);

    const assignCountMap = new Map<string, number>();
    if (routineIds.length > 0) {
      const assignRows = await db
        .select({
          routineId: planAssignments.routineId,
          learnerId: planAssignments.learnerId,
        })
        .from(planAssignments)
        .where(inArray(planAssignments.routineId, routineIds));
      const byRoutine = new Map<string, Set<string>>();
      for (const row of assignRows) {
        let set = byRoutine.get(row.routineId);
        if (!set) {
          set = new Set();
          byRoutine.set(row.routineId, set);
        }
        set.add(row.learnerId);
      }
      for (const [rid, learners] of Array.from(byRoutine.entries())) {
        assignCountMap.set(rid, learners.size);
      }
    }

    return res.json(
      routines.map((r) => ({
        id: r.id,
        name: r.name,
        exerciseCount: exerciseCountMap.get(r.id) ?? 0,
        isOwn: true,
        assignedLearnerCount: assignCountMap.get(r.id) ?? 0,
      })),
    );
  } catch (err: any) {
    console.error("[API] GET /plans/available Error:", err);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to fetch available plans");
  }
});

// TRAINER：查詢此 learner 已被自己指派的 routineIds
router.get(
  "/plans/assignments/:learnerId",
  verifyJWT,
  async (req: any, res: any) => {
    try {
      const trainerId = getCurrentUserId(req);
      if (!trainerId) return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");

      const learnerId = String(req.params.learnerId ?? "").trim();
      if (!learnerId) return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "learnerId is required");

      const currentUser = await getUserById(trainerId);
      if (!currentUser) return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");
      if (!isTrainerRole(currentUser.role)) return sendError(res, 403, ErrorCodes.FORBIDDEN, "Only trainer can access");

      const isActiveTrainer = await assertActiveTrainerForLearner(trainerId, learnerId);
      if (!isActiveTrainer) return sendError(res, 403, ErrorCodes.FORBIDDEN, "Not authorized");

      const rows = await db
        .select({
          routineId: planAssignments.routineId,
        })
        .from(planAssignments)
        .where(
          and(
            eq(planAssignments.learnerId, learnerId),
            eq(planAssignments.trainerId, trainerId),
          ),
        );

      const rawIds = Array.from(new Set(rows.map((r) => r.routineId)));
      if (rawIds.length === 0) {
        return res.json({ routineIds: [] });
      }
      const activeRoutines = await db
        .select({ id: workoutRoutines.id })
        .from(workoutRoutines)
        .where(and(inArray(workoutRoutines.id, rawIds), isNull(workoutRoutines.deletedAt)));
      const allowed = new Set(activeRoutines.map((x) => x.id));
      return res.json({ routineIds: rawIds.filter((id) => allowed.has(id)) });
    } catch (err: any) {
      console.error("[API] GET /plans/assignments/:learnerId Error:", err);
      return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to fetch assignments");
    }
  },
);

router.post("/plans/assign", verifyJWT, async (req: any, res: any) => {
  try {
    const trainerId = getCurrentUserId(req);
    if (!trainerId) return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");

    const { routineId, learnerId, note } = req.body ?? {};
    const routineIdStr = typeof routineId === "string" ? routineId.trim() : "";
    const learnerIdStr = typeof learnerId === "string" ? learnerId.trim() : "";

    if (!routineIdStr) return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "routineId is required");
    if (!learnerIdStr) return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "learnerId is required");

    const currentUser = await getUserById(trainerId);
    if (!currentUser) return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");
    if (!isTrainerRole(currentUser.role)) return sendError(res, 403, ErrorCodes.FORBIDDEN, "Only trainer can assign");

    if (note != null && note !== "") {
      if (typeof note !== "string") return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "note must be a string");
      if (note.trim().length > 500) return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "note is too long (max 500)");
    }

    const isActiveTrainer = await assertActiveTrainerForLearner(trainerId, learnerIdStr);
    if (!isActiveTrainer) return sendError(res, 403, ErrorCodes.FORBIDDEN, "Not authorized");

    const routineRows = await db
      .select({
        id: workoutRoutines.id,
        coachId: workoutRoutines.coachId,
        deletedAt: workoutRoutines.deletedAt,
      })
      .from(workoutRoutines)
      .where(eq(workoutRoutines.id, routineIdStr))
      .limit(1);
    if (!routineRows[0]) return sendError(res, 404, ErrorCodes.NOT_FOUND, "Routine not found");
    if (routineRows[0].deletedAt != null) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "Routine has been deleted");
    }
    if (String(routineRows[0].coachId) !== trainerId) return sendError(res, 403, ErrorCodes.FORBIDDEN, "Not authorized");

    const assignmentAt = new Date();
    const noteValue = typeof note === "string" ? note.trim() : null;
    const trainerName = `${currentUser.firstName ?? ""} ${currentUser.lastName ?? ""}`.trim() || currentUser.email || "你的教練";

    await db
      .insert(planAssignments)
      .values({
        routineId: routineIdStr,
        learnerId: learnerIdStr,
        trainerId,
        assignedAt: assignmentAt,
        note: noteValue,
      })
      .onConflictDoUpdate({
        target: [planAssignments.routineId, planAssignments.learnerId],
        set: {
          trainerId,
          assignedAt: assignmentAt,
          note: noteValue,
        },
      });

    const routineInfoRows = await db
      .select({ name: workoutRoutines.name })
      .from(workoutRoutines)
      .where(eq(workoutRoutines.id, routineIdStr))
      .limit(1);
    const routineName = routineInfoRows[0]?.name ?? "新的訓練計畫";

    void notifyPlanAssigned({
      learnerId: learnerIdStr,
      trainerName,
      routineId: routineIdStr,
      routineName,
    });

    return res.json({ success: true });
  } catch (err: any) {
    console.error("[API] POST /plans/assign Error:", err);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to assign plan");
  }
});

router.delete("/plans/assign/:learnerId/:routineId", verifyJWT, async (req: any, res: any) => {
  try {
    const trainerId = getCurrentUserId(req);
    if (!trainerId) return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");

    const learnerId = String(req.params.learnerId ?? "").trim();
    const routineId = String(req.params.routineId ?? "").trim();

    if (!learnerId) return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "learnerId is required");
    if (!routineId) return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "routineId is required");

    const currentUser = await getUserById(trainerId);
    if (!currentUser) return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");
    if (!isTrainerRole(currentUser.role)) return sendError(res, 403, ErrorCodes.FORBIDDEN, "Only trainer can unassign");

    const isActiveTrainer = await assertActiveTrainerForLearner(trainerId, learnerId);
    if (!isActiveTrainer) return sendError(res, 403, ErrorCodes.FORBIDDEN, "Not authorized");

    const routineRows = await db
      .select({ id: workoutRoutines.id, coachId: workoutRoutines.coachId })
      .from(workoutRoutines)
      .where(eq(workoutRoutines.id, routineId))
      .limit(1);

    if (!routineRows[0]) return sendError(res, 404, ErrorCodes.NOT_FOUND, "Routine not found");
    if (String(routineRows[0].coachId) !== trainerId) return sendError(res, 403, ErrorCodes.FORBIDDEN, "Not authorized");

    await db
      .delete(planAssignments)
      .where(
        and(
          eq(planAssignments.learnerId, learnerId),
          eq(planAssignments.routineId, routineId),
          eq(planAssignments.trainerId, trainerId),
        ),
      );

    return res.json({ success: true });
  } catch (err: any) {
    console.error("[API] DELETE /plans/assign/:learnerId/:routineId Error:", err);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to unassign plan");
  }
});

export default router;

