import { Router } from "express";
import { db } from "../db";
import { getUserById } from "../db/queries";
import { verifyJWT } from "../replitAuth";
import { getLearnerDashboardOverview } from "../services/dashboard";
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

router.get("/learner/overview", verifyJWT, async (req: any, res: any) => {
  try {
    const learnerId = getCurrentUserId(req);
    if (!learnerId) return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");

    const currentUser = await getUserById(learnerId);
    if (!currentUser) return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");
    if (isTrainerRole(currentUser.role)) {
      return sendError(
        res,
        403,
        ErrorCodes.FORBIDDEN,
        "Only learner can access dashboard overview",
      );
    }

    const overview = await getLearnerDashboardOverview(db, learnerId);
    return res.json(overview);
  } catch (err: any) {
    console.error("[API] GET /dashboard/learner/overview Error:", err);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to fetch learner dashboard overview");
  }
});

export default router;
