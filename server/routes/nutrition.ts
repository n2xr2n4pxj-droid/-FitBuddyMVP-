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
import { sendError } from "../lib/response";
import { ErrorCodes } from "@shared/error-codes";

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
    if (!userId) return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");

    const dateYmd = parseDateParam(req.query?.date);
    if (!dateYmd) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "Invalid or missing date (YYYY-MM-DD)");
    }

    const payload = await getDayNutritionPayload(userId, dateYmd);
    return res.status(200).json(payload);
  } catch (error: any) {
    console.error("[GET /nutrition/logs/my]", error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to fetch nutrition logs");
  }
});

/** POST /logs */
router.post("/logs", verifyJWT, async (req: any, res: any) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");

    const body = req.body ?? {};
    const logDate = parseDateParam(body.logDate);
    if (!logDate) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "Invalid or missing logDate (YYYY-MM-DD)");
    }

    const nameRaw = String(body.description ?? body.name ?? "").trim();
    if (!nameRaw) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "description (food name) is required");
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
        return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "Invalid consumedAt");
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

    if (!row) return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to create meal");

    const serialized = serializeMealRow(row);
    return res.status(201).json(serialized);
  } catch (error: any) {
    console.error("[POST /nutrition/logs]", error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to log meal");
  }
});

/** DELETE /logs/:id */
router.delete("/logs/:id", verifyJWT, async (req: any, res: any) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");

    const id = String(req.params?.id ?? "").trim();
    if (!id) return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "Missing id");

    const [existing] = await db
      .select({ id: meals.id, userId: meals.userId })
      .from(meals)
      .where(eq(meals.id, id))
      .limit(1);

    if (!existing) return sendError(res, 404, ErrorCodes.NOT_FOUND, "Not found");
    if (existing.userId !== userId) return sendError(res, 403, ErrorCodes.FORBIDDEN, "Forbidden");

    await db.delete(meals).where(and(eq(meals.id, id), eq(meals.userId, userId)));
    return res.status(204).send();
  } catch (error: any) {
    console.error("[DELETE /nutrition/logs/:id]", error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to delete meal");
  }
});

export default router;
