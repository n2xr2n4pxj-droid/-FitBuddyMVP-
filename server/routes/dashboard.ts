import { Router } from "express";
import { db } from "../db";
import { getUserById } from "../db/queries";
import { verifyJWT } from "../replitAuth";
import { getLearnerDashboardOverview } from "../services/dashboard";

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
    if (!learnerId) return res.status(401).json({ error: "Unauthorized" });

    const currentUser = await getUserById(learnerId);
    if (!currentUser) return res.status(401).json({ error: "Unauthorized" });
    if (isTrainerRole(currentUser.role)) {
      return res.status(403).json({ error: "Only learner can access dashboard overview" });
    }

    const overview = await getLearnerDashboardOverview(db, learnerId);
    return res.json(overview);
  } catch (err: any) {
    console.error("[API] GET /dashboard/learner/overview Error:", err);
    return res.status(500).json({ error: "Failed to fetch learner dashboard overview" });
  }
});

export default router;
