import { Router } from "express";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { db } from "../db";
import { notifications, pushSubscriptions, userNotificationPreferences } from "../db/schema";
import { verifyJWT } from "../replitAuth";
import { sendPushToUser } from "../services/webPushService";
import { sendError } from "../lib/response";
import { ErrorCodes } from "@shared/error-codes";

const router = Router();

function getCurrentUserId(req: any): string | null {
  return String(req.user?.id ?? req.user?.claims?.sub ?? "").trim() || null;
}

function normalizeQuietTime(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(trimmed)) return fallback;
  return trimmed;
}

async function getOrCreatePreferences(userId: string) {
  const existing = await db
    .select()
    .from(userNotificationPreferences)
    .where(eq(userNotificationPreferences.userId, userId))
    .limit(1);
  if (existing[0]) return existing[0];

  const [created] = await db
    .insert(userNotificationPreferences)
    .values({ userId })
    .returning();
  return created;
}

router.get("/notifications/preferences", verifyJWT, async (req: any, res: any) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");

    const pref = await getOrCreatePreferences(userId);
    return res.json(pref);
  } catch (error) {
    console.error("[API] GET /notifications/preferences Error:", error);
    return sendError(
      res,
      500,
      ErrorCodes.INTERNAL_SERVER_ERROR,
      "Failed to fetch notification preferences",
    );
  }
});

router.put("/notifications/preferences", verifyJWT, async (req: any, res: any) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");

    const current = await getOrCreatePreferences(userId);
    const body = req.body ?? {};

    const patch = {
      workoutRemindersEnabled:
        typeof body.workoutRemindersEnabled === "boolean"
          ? body.workoutRemindersEnabled
          : current.workoutRemindersEnabled,
      sessionFeedbackEnabled:
        typeof body.sessionFeedbackEnabled === "boolean"
          ? body.sessionFeedbackEnabled
          : current.sessionFeedbackEnabled,
      planAssignedEnabled:
        typeof body.planAssignedEnabled === "boolean"
          ? body.planAssignedEnabled
          : current.planAssignedEnabled,
      marketingEnabled:
        typeof body.marketingEnabled === "boolean"
          ? body.marketingEnabled
          : current.marketingEnabled,
      quietHoursStart: normalizeQuietTime(body.quietHoursStart, current.quietHoursStart),
      quietHoursEnd: normalizeQuietTime(body.quietHoursEnd, current.quietHoursEnd),
    };

    const [updated] = await db
      .update(userNotificationPreferences)
      .set(patch)
      .where(eq(userNotificationPreferences.userId, userId))
      .returning();

    return res.json(updated);
  } catch (error) {
    console.error("[API] PUT /notifications/preferences Error:", error);
    return sendError(
      res,
      500,
      ErrorCodes.INTERNAL_SERVER_ERROR,
      "Failed to update notification preferences",
    );
  }
});

async function upsertPushSubscription(req: any, res: any) {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");

    const endpoint = String(req.body?.endpoint ?? "").trim();
    const auth = String(req.body?.auth ?? "").trim();
    const p256dh = String(req.body?.p256dh ?? "").trim();
    const userAgentRaw = req.body?.userAgent;
    const userAgent =
      typeof userAgentRaw === "string" && userAgentRaw.trim()
        ? userAgentRaw.trim().slice(0, 512)
        : (req.headers["user-agent"] ?? "").toString().slice(0, 512);

    if (!endpoint || !auth || !p256dh) {
      return sendError(
        res,
        400,
        ErrorCodes.VALIDATION_ERROR,
        "endpoint, auth, p256dh are required",
      );
    }

    const now = new Date();
    const [saved] = await db
      .insert(pushSubscriptions)
      .values({
        userId,
        endpoint,
        auth,
        p256dh,
        createdAt: now,
        lastActiveAt: now,
        userAgent,
      })
      .onConflictDoUpdate({
        target: [pushSubscriptions.endpoint],
        set: {
          userId,
          auth,
          p256dh,
          lastActiveAt: now,
          userAgent,
        },
      })
      .returning({
        id: pushSubscriptions.id,
        endpoint: pushSubscriptions.endpoint,
      });

    return res.status(201).json({ success: true, subscription: saved });
  } catch (error) {
    console.error("[API] POST /notifications/subscriptions Error:", error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to save push subscription");
  }
}

router.post("/notifications/push-subscriptions", verifyJWT, upsertPushSubscription);
// backward compatible
router.post("/notifications/subscriptions", verifyJWT, upsertPushSubscription);

async function deletePushSubscription(req: any, res: any) {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");

    const endpoint = String(req.body?.endpoint ?? "").trim();
    if (!endpoint) return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "endpoint is required");

    await db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));

    return res.json({ success: true });
  } catch (error) {
    console.error("[API] DELETE /notifications/subscriptions Error:", error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to delete push subscription");
  }
}

router.delete("/notifications/push-subscriptions", verifyJWT, deletePushSubscription);
// backward compatible
router.delete("/notifications/subscriptions", verifyJWT, deletePushSubscription);

router.get("/notifications/my", verifyJWT, async (req: any, res: any) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");

    const rawLimit = Number(req.query?.limit ?? 20);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 50) : 20;
    const cursor = String(req.query?.cursor ?? "").trim();
    const cursorDate = cursor ? new Date(cursor) : null;
    const hasCursor = !!cursorDate && !Number.isNaN(cursorDate.getTime());

    const whereClause = hasCursor
      ? and(eq(notifications.userId, userId), lt(notifications.sentAt, cursorDate!))
      : eq(notifications.userId, userId);

    const rows = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        linkUrl: notifications.linkUrl,
        data: notifications.data,
        isRead: notifications.isRead,
        sentAt: notifications.sentAt,
        readAt: notifications.readAt,
      })
      .from(notifications)
      .where(whereClause)
      .orderBy(desc(notifications.sentAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1]?.sentAt?.toISOString() ?? null : null;

    return res.json({
      notifications: page.map((item) => ({
        ...item,
        sentAt: item.sentAt.toISOString(),
        readAt: item.readAt ? item.readAt.toISOString() : null,
      })),
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error("[API] GET /notifications/my Error:", error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to fetch notifications");
  }
});

router.get("/notifications/unread-count", verifyJWT, async (req: any, res: any) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");

    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    const count = Number(rows[0]?.count ?? 0);
    return res.json({ count });
  } catch (error) {
    console.error("[API] GET /notifications/unread-count Error:", error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to fetch unread count");
  }
});

router.post("/notifications/:id/read", verifyJWT, async (req: any, res: any) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");
    const notificationId = String(req.params?.id ?? "").trim();
    if (!notificationId) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "notification id is required");
    }

    const [updated] = await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
      .returning({ id: notifications.id, isRead: notifications.isRead, readAt: notifications.readAt });

    if (!updated) return sendError(res, 404, ErrorCodes.NOT_FOUND, "Notification not found");
    return res.json({
      id: updated.id,
      isRead: updated.isRead,
      readAt: updated.readAt ? updated.readAt.toISOString() : null,
    });
  } catch (error) {
    console.error("[API] POST /notifications/:id/read Error:", error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to mark notification as read");
  }
});

router.post("/notifications/test-push", verifyJWT, async (req: any, res: any) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return sendError(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");

    await sendPushToUser(userId, {
      type: "workout_reminder",
      title: "FitBuddy 測試推播",
      body: "若你看到此通知，代表 Web Push 設定成功。",
      linkUrl: "/client/profile?section=notifications",
      data: { source: "test-push" },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("[API] POST /notifications/test-push Error:", error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to send test push");
  }
});

export default router;

