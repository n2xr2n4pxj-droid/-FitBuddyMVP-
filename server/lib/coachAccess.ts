import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { coachClients } from "../db/schema";

export function isCoachRole(role: string | null | undefined): boolean {
  const upper = String(role ?? "").toUpperCase();
  return upper === "COACH" || upper === "ADMIN";
}

/** 本人或 active 教練–學員關係之教練可存取 target。 */
export async function assertCanAccessTargetUser(
  actorId: string,
  actorRole: string | null | undefined,
  targetUserId: string,
): Promise<boolean> {
  if (actorId === targetUserId) return true;
  if (!isCoachRole(actorRole)) return false;
  const [row] = await db
    .select({ id: coachClients.id })
    .from(coachClients)
    .where(
      and(
        eq(coachClients.coachId, actorId),
        eq(coachClients.clientId, targetUserId),
        eq(coachClients.status, "active"),
      ),
    )
    .limit(1);
  return !!row;
}
