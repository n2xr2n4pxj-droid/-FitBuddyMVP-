import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { meals } from "../db/schema";
import { verifyJWT } from "../replitAuth";
import {
  getDayNutritionPayload,
  hktDayBoundsUtc,
  mealTypeToDb,
  serializeMealRow,
} from "../services/nutritionDay";

const router = Router();

function getCurrentUserId(req: any): string | null {
  return String(req.user?.id ?? req.user?.claims?.sub ?? "").trim() || null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateParam(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!DATE_RE.test(s)) return null;
  try {
    hktDayBoundsUtc(s);
    return s;
  } catch {
    return null;
  }
}

/** GET /logs/my?date=YYYY-MM-DD */
router.get("/logs/my", verifyJWT, async (req: any, res: any) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const dateYmd = parseDateParam(req.query?.date);
    if (!dateYmd) {
      return res.status(400).json({ error: "Invalid or missing date (YYYY-MM-DD)" });
    }

    const payload = await getDayNutritionPayload(userId, dateYmd);
    return res.status(200).json(payload);
  } catch (error: any) {
    console.error("[GET /nutrition/logs/my]", error);
    return res.status(500).json({ error: error?.message ?? "Failed to fetch nutrition logs" });
  }
});

/** POST /logs */
router.post("/logs", verifyJWT, async (req: any, res: any) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const body = req.body ?? {};
    const logDate = parseDateParam(body.logDate);
    if (!logDate) {
      return res.status(400).json({ error: "Invalid or missing logDate (YYYY-MM-DD)" });
    }

    const nameRaw = String(body.description ?? body.name ?? "").trim();
    if (!nameRaw) {
      return res.status(400).json({ error: "description (food name) is required" });
    }

    const mt = mealTypeToDb(String(body.mealType ?? "snack"));
    const calories = Number(body.calories ?? 0) || 0;
    const protein = Number(body.protein ?? 0) || 0;
    const carbs = Number(body.carbs ?? 0) || 0;
    const fat = Number(body.fat ?? 0) || 0;

    let consumedAt: Date;
    if (body.consumedAt) {
      consumedAt = new Date(body.consumedAt);
      if (Number.isNaN(consumedAt.getTime())) {
        return res.status(400).json({ error: "Invalid consumedAt" });
      }
    } else {
      consumedAt = new Date(`${logDate}T12:00:00+08:00`);
    }

    const notes = body.notes != null ? String(body.notes).trim() : "";
    const [row] = await db
      .insert(meals)
      .values({
        userId,
        name: nameRaw,
        mealType: mt,
        calories,
        protein,
        carbs,
        fat,
        description: notes || null,
        consumedAt,
      })
      .returning();

    if (!row) return res.status(500).json({ error: "Failed to create meal" });

    const serialized = serializeMealRow(row);
    return res.status(201).json(serialized);
  } catch (error: any) {
    console.error("[POST /nutrition/logs]", error);
    return res.status(500).json({ error: error?.message ?? "Failed to log meal" });
  }
});

/** DELETE /logs/:id */
router.delete("/logs/:id", verifyJWT, async (req: any, res: any) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const id = String(req.params?.id ?? "").trim();
    if (!id) return res.status(400).json({ error: "Missing id" });

    const [existing] = await db
      .select({ id: meals.id, userId: meals.userId })
      .from(meals)
      .where(eq(meals.id, id))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.userId !== userId) return res.status(403).json({ error: "Forbidden" });

    await db.delete(meals).where(and(eq(meals.id, id), eq(meals.userId, userId)));
    return res.status(204).send();
  } catch (error: any) {
    console.error("[DELETE /nutrition/logs/:id]", error);
    return res.status(500).json({ error: error?.message ?? "Failed to delete meal" });
  }
});

export default router;
