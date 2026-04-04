/**
 * Users API v1 — 公開端點（不需 JWT）
 * GET /check-username?username=xxx
 *
 * 比對 users.username（可為 null 的列略過）；大小寫不敏感：lower(username) = lower(輸入)。
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import { users } from "../db/schema";
import { and, isNotNull, sql } from "drizzle-orm";

const router = Router();

router.get("/check-username", async (req: Request, res: Response) => {
  try {
    const raw = req.query.username;
    const username = typeof raw === "string" ? raw.trim() : "";
    if (!username) {
      return res.status(400).json({ error: "username is required" });
    }

    const lower = username.toLowerCase();

    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(isNotNull(users.username), sql`lower(${users.username}) = ${lower}`)
      )
      .limit(1);

    if (rows.length === 0) {
      return res.json({ available: true });
    }

    return res.json({
      available: false,
      suggestions: [`${username}1`, `${username}_fit`, `fit_${username}`],
    });
  } catch (e: unknown) {
    console.error("[GET /api/v1/users/check-username]", e);
    const message = e instanceof Error ? e.message : "Failed to check username";
    return res.status(500).json({ error: message });
  }
});

export default router;
