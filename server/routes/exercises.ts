import { Router, Request, Response } from "express";
import { db } from "../db";
import { exercises } from "../db/schema";
import { isAuthenticated } from "../replitAuth";
import { asc, or, sql } from "drizzle-orm";
import { sendError } from "../lib/response";
import { ErrorCodes } from "@shared/error-codes";

const router = Router();

/**
 * GET /api/exercises?search=...&limit=...
 * 支援模糊搜尋 exercises.name（並順便搜尋 muscleGroup / equipment）。
 * 回傳：Exercise[]（前端/測試可直接取 id/name）
 */
router.get("/exercises", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const searchRaw = req.query.search;
    const limitRaw = req.query.limit;

    const limit =
      Math.min(
        Math.max(1, parseInt(String(limitRaw || "20"), 10) || 20),
        50,
      ) || 20;

    const search =
      typeof searchRaw === "string" ? searchRaw.trim() : "";

    const whereClause =
      search.length > 0
        ? or(
            sql`LOWER(${exercises.name}) LIKE ${`%${search.toLowerCase()}%`}`,
            sql`LOWER(${exercises.muscleGroup}) LIKE ${`%${search.toLowerCase()}%`}`,
            sql`LOWER(${exercises.equipment}) LIKE ${`%${search.toLowerCase()}%`}`,
          )
        : undefined;

    const rows = await db
      .select({
        id: exercises.id,
        name: exercises.name,
        muscleGroup: exercises.muscleGroup,
        equipment: exercises.equipment,
        isCustom: exercises.isCustom,
      })
      .from(exercises)
      .where(whereClause as any)
      .orderBy(asc(exercises.name))
      .limit(limit);

    return res.status(200).json(rows);
  } catch (error: any) {
    console.error("❌ [API] GET /api/exercises Error:", error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to fetch exercises");
  }
});

export default router;

