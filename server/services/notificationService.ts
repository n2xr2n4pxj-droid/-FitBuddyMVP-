import { eq } from "drizzle-orm";
import { db } from "../db";
import { notifications, userNotificationPreferences } from "../db/schema";
import { sendPushToUser, type NotificationPayload } from "./webPushService";

type NotificationPreferenceRow = typeof userNotificationPreferences.$inferSelect;

function isTypeEnabled(pref: NotificationPreferenceRow, type: NotificationPayload["type"]): boolean {
  if (type === "workout_reminder") return pref.workoutRemindersEnabled;
  if (type === "session_feedback") return pref.sessionFeedbackEnabled;
  if (type === "plan_assigned") return pref.planAssignedEnabled;
  return true;
}

function toMinuteOfDay(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isInteger(h) || !Number.isInteger(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function getHkMinuteOfDay(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function isInQuietHours(pref: NotificationPreferenceRow, now = new Date()): boolean {
  const start = toMinuteOfDay(pref.quietHoursStart);
  const end = toMinuteOfDay(pref.quietHoursEnd);
  if (start == null || end == null) return false;

  const current = getHkMinuteOfDay(now);
  if (start === end) return true;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

async function getOrCreatePreference(userId: string): Promise<NotificationPreferenceRow> {
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

export async function notifyUser(userId: string, payload: NotificationPayload): Promise<void> {
  if (!userId) return;

  try {
    const preference = await getOrCreatePreference(userId);
    if (!isTypeEnabled(preference, payload.type)) return;

    await db.insert(notifications).values({
      userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      linkUrl: payload.linkUrl ?? null,
      data: payload.data ?? {},
      isRead: false,
    });

    if (isInQuietHours(preference)) return;
    await sendPushToUser(userId, payload);
  } catch (error) {
    console.error("[notificationService] notifyUser failed:", error);
  }
}

type NotifyPlanAssignedInput = {
  learnerId: string;
  trainerName: string;
  routineId: string;
  routineName: string;
};

type NotifySessionFeedbackInput = {
  learnerId: string;
  trainerName: string;
  sessionId: string;
  content: string;
};

type NotifyUpcomingWorkoutInput = {
  learnerId: string;
  routineId: string;
  routineName: string;
  scheduledDateLabel?: string;
};

export async function notifyPlanAssigned(input: NotifyPlanAssignedInput): Promise<void> {
  await notifyUser(input.learnerId, {
    type: "plan_assigned",
    title: "你有新的訓練計畫",
    body: `${input.trainerName} 指派了「${input.routineName}」`,
    linkUrl: `/client/plans?routineId=${input.routineId}`,
    data: { routineId: input.routineId },
  });
}

export async function notifySessionFeedback(input: NotifySessionFeedbackInput): Promise<void> {
  await notifyUser(input.learnerId, {
    type: "session_feedback",
    title: "教練新增了訓練點評",
    body: `${input.trainerName}：${input.content}`,
    linkUrl: `/client/workout?sessionId=${input.sessionId}`,
    data: { sessionId: input.sessionId },
  });
}

export async function notifyUpcomingWorkout(input: NotifyUpcomingWorkoutInput): Promise<void> {
  const suffix = input.scheduledDateLabel ? `（${input.scheduledDateLabel}）` : "";
  await notifyUser(input.learnerId, {
    type: "workout_reminder",
    title: "即將開始訓練",
    body: `「${input.routineName}」快到時間了${suffix}`,
    linkUrl: `/client/workout?routineId=${input.routineId}`,
    data: { routineId: input.routineId },
  });
}

