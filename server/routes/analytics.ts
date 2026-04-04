import { Router } from "express";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { getUserById } from "../db/queries";
import {
  bodyCompositionLogs,
  workoutSessions,
  sessionExercises,
  sessionSets,
} from "../db/schema";
import { verifyJWT } from "../replitAuth";
import { assertCanAccessTargetUser } from "../lib/coachAccess";

const router = Router();

function getCurrentUserId(req: any): string | null {
  return String(req.user?.id ?? req.user?.claims?.sub ?? "").trim() || null;
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function serializeBodyLog(row: typeof bodyCompositionLogs.$inferSelect) {
  return {
    id: row.id,
    userId: row.userId,
    measuredAt: row.measuredAt.toISOString(),
    weight: numOrNull(row.weight) ?? 0,
    bodyFatPct: numOrNull(row.bodyFatPct),
    muscleMass: numOrNull(row.muscleMass),
    visceralFat: row.visceralFat,
    bmi: numOrNull(row.bmi),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

/** POST /api/analytics/body-composition */
router.post("/body-composition", verifyJWT, async (req: any, res: any) => {
  try {
    const actorId = getCurrentUserId(req);
    if (!actorId) return res.status(401).json({ error: "Unauthorized" });

    const actor = await getUserById(actorId);
    if (!actor) return res.status(401).json({ error: "Unauthorized" });

    const body = req.body ?? {};
    const targetUserId = String(body.userId ?? actorId).trim();
    const ok = await assertCanAccessTargetUser(actorId, actor.role, targetUserId);
    if (!ok) return res.status(403).json({ error: "Forbidden" });

    const measuredAtRaw = body.measuredAt;
    if (!measuredAtRaw) return res.status(400).json({ error: "measuredAt is required" });
    const measuredAt = new Date(String(measuredAtRaw));
    if (Number.isNaN(measuredAt.getTime())) {
      return res.status(400).json({ error: "invalid measuredAt" });
    }

    const weight = body.weight;
    if (weight === undefined || weight === null || weight === "") {
      return res.status(400).json({ error: "weight is required" });
    }

    const [inserted] = await db
      .insert(bodyCompositionLogs)
      .values({
        userId: targetUserId,
        measuredAt,
        weight: String(weight),
        bodyFatPct: body.bodyFatPct != null && body.bodyFatPct !== "" ? String(body.bodyFatPct) : null,
        muscleMass: body.muscleMass != null && body.muscleMass !== "" ? String(body.muscleMass) : null,
        visceralFat:
          body.visceralFat != null && body.visceralFat !== "" ? parseInt(String(body.visceralFat), 10) : null,
        bmi: body.bmi != null && body.bmi !== "" ? String(body.bmi) : null,
        notes: typeof body.notes === "string" ? body.notes : null,
      })
      .returning();

    return res.status(201).json(serializeBodyLog(inserted));
  } catch (err) {
    console.error("[API] POST /analytics/body-composition Error:", err);
    return res.status(500).json({ error: "Failed to create body composition log" });
  }
});

/** GET /api/analytics/body-composition/:userId */
router.get("/body-composition/:userId", verifyJWT, async (req: any, res: any) => {
  try {
    const actorId = getCurrentUserId(req);
    if (!actorId) return res.status(401).json({ error: "Unauthorized" });

    const actor = await getUserById(actorId);
    if (!actor) return res.status(401).json({ error: "Unauthorized" });

    const targetUserId = String(req.params.userId ?? "").trim();
    if (!targetUserId) return res.status(400).json({ error: "userId is required" });

    const ok = await assertCanAccessTargetUser(actorId, actor.role, targetUserId);
    if (!ok) return res.status(403).json({ error: "Forbidden" });

    const fromQ = req.query.from ? new Date(String(req.query.from)) : null;
    const toQ = req.query.to ? new Date(String(req.query.to)) : null;

    let fromDate: Date;
    let toDate: Date;
    if (fromQ && !Number.isNaN(fromQ.getTime()) && toQ && !Number.isNaN(toQ.getTime())) {
      fromDate = fromQ;
      toDate = toQ;
    } else {
      toDate = new Date();
      fromDate = new Date(toDate);
      fromDate.setUTCDate(fromDate.getUTCDate() - 90);
    }

    const rows = await db
      .select()
      .from(bodyCompositionLogs)
      .where(
        and(
          eq(bodyCompositionLogs.userId, targetUserId),
          gte(bodyCompositionLogs.measuredAt, fromDate),
          lte(bodyCompositionLogs.measuredAt, toDate),
        ),
      )
      .orderBy(asc(bodyCompositionLogs.measuredAt));

    return res.json(rows.map(serializeBodyLog));
  } catch (err) {
    console.error("[API] GET /analytics/body-composition/:userId Error:", err);
    return res.status(500).json({ error: "Failed to fetch body composition logs" });
  }
});

/** DELETE /api/analytics/body-composition/:logId */
router.delete("/body-composition/:logId", verifyJWT, async (req: any, res: any) => {
  try {
    const actorId = getCurrentUserId(req);
    if (!actorId) return res.status(401).json({ error: "Unauthorized" });

    const actor = await getUserById(actorId);
    if (!actor) return res.status(401).json({ error: "Unauthorized" });

    const logId = String(req.params.logId ?? "").trim();
    if (!logId) return res.status(400).json({ error: "logId is required" });

    const [existing] = await db
      .select()
      .from(bodyCompositionLogs)
      .where(eq(bodyCompositionLogs.id, logId))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Not found" });

    const ok = await assertCanAccessTargetUser(actorId, actor.role, existing.userId);
    if (!ok) return res.status(403).json({ error: "Forbidden" });

    await db.delete(bodyCompositionLogs).where(eq(bodyCompositionLogs.id, logId));
    return res.status(204).send();
  } catch (err) {
    console.error("[API] DELETE /analytics/body-composition/:logId Error:", err);
    return res.status(500).json({ error: "Failed to delete body composition log" });
  }
});

/** GET /api/analytics/workout-volume/:userId */
router.get("/workout-volume/:userId", verifyJWT, async (req: any, res: any) => {
  try {
    const actorId = getCurrentUserId(req);
    if (!actorId) return res.status(401).json({ error: "Unauthorized" });

    const actor = await getUserById(actorId);
    if (!actor) return res.status(401).json({ error: "Unauthorized" });

    const targetUserId = String(req.params.userId ?? "").trim();
    if (!targetUserId) return res.status(400).json({ error: "userId is required" });

    const ok = await assertCanAccessTargetUser(actorId, actor.role, targetUserId);
    if (!ok) return res.status(403).json({ error: "Forbidden" });

    const rawWeeks = Number(req.query.weeks ?? 8);
    if (!Number.isFinite(rawWeeks) || rawWeeks < 1 || rawWeeks > 24) {
      return res.status(400).json({ error: "weeks must be between 1 and 24" });
    }
    const weeks = Math.trunc(rawWeeks);

    const result = await db.execute(sql`
      WITH bounds AS (
        SELECT date_trunc('week', (NOW() AT TIME ZONE 'Asia/Hong_Kong'))::timestamp AS cur_week_monday
      ),
      week_starts AS (
        SELECT (b.cur_week_monday - (g * interval '7 days'))::timestamp AS week_start_hkt
        FROM bounds b
        CROSS JOIN generate_series(${weeks - 1}, 0, -1) AS g
      ),
      session_weeks AS (
        SELECT
          date_trunc('week', (ws.completed_at AT TIME ZONE 'Asia/Hong_Kong'))::timestamp AS wk,
          ws.id AS sid
        FROM ${workoutSessions} ws
        WHERE ws.user_id = ${targetUserId}
          AND ws.completed_at IS NOT NULL
      ),
      set_counts AS (
        SELECT
          sw.wk,
          sw.sid,
          (
            SELECT COUNT(*)::int
            FROM ${sessionExercises} se
            INNER JOIN ${sessionSets} ss
              ON ss.session_exercise_id = se.id AND ss.completed = true
            WHERE se.session_id = sw.sid
          ) AS scnt
        FROM session_weeks sw
      ),
      agg AS (
        SELECT
          wk,
          COUNT(DISTINCT sid)::int AS session_count,
          COALESCE(SUM(scnt), 0)::int AS total_sets
        FROM set_counts
        GROUP BY wk
      )
      SELECT
        ws.week_start_hkt,
        to_char(ws.week_start_hkt, 'MM/DD') AS week_label,
        COALESCE(a.session_count, 0)::int AS session_count,
        COALESCE(a.total_sets, 0)::int AS total_sets
      FROM week_starts ws
      LEFT JOIN agg a ON a.wk = ws.week_start_hkt
      ORDER BY ws.week_start_hkt ASC
    `);

    const rows = result.rows as Record<string, unknown>[];
    const out = rows.map((r, i) => {
      const mmdd = String(r.week_label ?? "").replace(/\//g, "");
      return {
        weekLabel: mmdd ? `W${mmdd}` : `W${i + 1}`,
        sessionCount: Number(r.session_count ?? 0),
        totalSets: Number(r.total_sets ?? 0),
      };
    });

    return res.json(out);
  } catch (err) {
    console.error("[API] GET /analytics/workout-volume/:userId Error:", err);
    return res.status(500).json({ error: "Failed to fetch workout volume" });
  }
});

export default router;
