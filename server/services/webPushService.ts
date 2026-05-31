import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { pushSubscriptions } from "../db/schema";

type NotificationType = "workout_reminder" | "session_feedback" | "plan_assigned";

export type NotificationPayload = {
  type: NotificationType;
  title: string;
  body: string;
  linkUrl?: string;
  data?: {
    sessionId?: string;
    routineId?: string;
    [key: string]: unknown;
  };
};

let vapidInitialized = false;

function ensureVapidConfigured() {
  if (vapidInitialized) return true;

  const publicKey = process.env.PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.PUSH_VAPID_PRIVATE_KEY?.trim();

  if (!publicKey || !privateKey) {
    console.error(
      "[webPushService] Missing PUSH_VAPID_PUBLIC_KEY / PUSH_VAPID_PRIVATE_KEY. Push notification skipped.",
    );
    return false;
  }

  webpush.setVapidDetails("mailto:support@fitbuddy.com", publicKey, privateKey);
  vapidInitialized = true;
  return true;
}

function extractStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const maybeStatus = (error as { statusCode?: unknown }).statusCode;
  if (typeof maybeStatus === "number") return maybeStatus;
  return undefined;
}

export async function sendPushToUser(userId: string, payload: NotificationPayload): Promise<void> {
  if (!userId) return;
  if (!ensureVapidConfigured()) return;

  const subscriptions = await db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      auth: pushSubscriptions.auth,
      p256dh: pushSubscriptions.p256dh,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subscriptions.length === 0) return;

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    linkUrl: payload.linkUrl ?? null,
    type: payload.type,
    data: payload.data ?? {},
  });

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              auth: sub.auth,
              p256dh: sub.p256dh,
            },
          },
          message,
        );
      } catch (error) {
        const statusCode = extractStatusCode(error);
        if (statusCode === 404 || statusCode === 410) {
          try {
            await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
          } catch (cleanupError) {
            console.error("[webPushService] Failed to cleanup invalid subscription:", cleanupError);
          }
          return;
        }

        console.error("[webPushService] Failed to send push notification:", error);
      }
    }),
  );
}

