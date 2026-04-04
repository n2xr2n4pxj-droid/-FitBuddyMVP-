import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "../db";
import { meals, users } from "../db/schema";

export function hktDayBoundsUtc(dateYmd: string): { start: Date; end: Date } {
  const start = new Date(`${dateYmd}T00:00:00+08:00`);
  const end = new Date(`${dateYmd}T23:59:59.999+08:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("invalid date");
  }
  return { start, end };
}

export function mealTypeToDb(
  raw: string,
): "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK" {
  const u = String(raw ?? "").toUpperCase();
  if (u === "BREAKFAST" || u === "LUNCH" || u === "DINNER" || u === "SNACK") {
    return u;
  }
  const map: Record<string, "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK"> = {
    breakfast: "BREAKFAST",
    lunch: "LUNCH",
    dinner: "DINNER",
    snack: "SNACK",
  };
  return map[String(raw ?? "").toLowerCase()] ?? "SNACK";
}

export function mealTypeToApi(dbVal: string): string {
  return String(dbVal ?? "").toLowerCase();
}

function num(v: unknown, fallback = 0): number {
  if (v === null || v === undefined) return fallback;
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function formatHktDateKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });
}

export function serializeMealRow(row: typeof meals.$inferSelect) {
  return {
    id: row.id,
    logDate: formatHktDateKey(row.consumedAt),
    mealType: mealTypeToApi(row.mealType),
    description: row.name,
    name: row.name,
    calories: Math.round(num(row.calories)),
    protein: num(row.protein),
    carbs: num(row.carbs),
    fat: num(row.fat),
    notes: row.description ?? undefined,
    consumedAt: row.consumedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getDayNutritionPayload(userId: string, dateYmd: string) {
  const { start, end } = hktDayBoundsUtc(dateYmd);

  const rows = await db
    .select()
    .from(meals)
    .where(and(eq(meals.userId, userId), gte(meals.consumedAt, start), lte(meals.consumedAt, end)))
    .orderBy(asc(meals.consumedAt));

  const [goalRow] = await db
    .select({
      goalCalories: users.goalCalories,
      goalProtein: users.goalProtein,
      goalCarbs: users.goalCarbs,
      goalFat: users.goalFat,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const goals = {
    goalCalories: goalRow?.goalCalories != null ? Number(goalRow.goalCalories) : 0,
    goalProtein: num(goalRow?.goalProtein, 0),
    goalCarbs: num(goalRow?.goalCarbs, 0),
    goalFat: num(goalRow?.goalFat, 0),
  };

  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  for (const r of rows) {
    totalCalories += Math.round(num(r.calories));
    totalProtein += num(r.protein);
    totalCarbs += num(r.carbs);
    totalFat += num(r.fat);
  }

  return {
    logs: rows.map(serializeMealRow),
    summary: {
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFat,
    },
    goals,
  };
}
