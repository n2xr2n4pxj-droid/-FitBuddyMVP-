import {
  users,
  meals,
  workouts,
  type User,
  type UpsertUser,
  type Meal,
  type InsertMeal,
  type Workout,
  type InsertWorkout,
  type DailySummary,
  type WeeklySummary,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Meal operations
  getMealsByUserAndDate(userId: string, date: Date): Promise<Meal[]>;
  createMeal(userId: string, meal: InsertMeal): Promise<Meal>;

  // Workout operations
  getWorkoutsByUserAndDate(userId: string, date: Date): Promise<Workout[]>;
  createWorkout(userId: string, workout: InsertWorkout): Promise<Workout>;

  // Summary operations
  getDailySummary(userId: string, date: Date): Promise<DailySummary>;
  getWeeklySummary(userId: string): Promise<WeeklySummary>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Meal operations
  async getMealsByUserAndDate(userId: string, date: Date): Promise<Meal[]> {
    const start = startOfDay(date);
    const end = endOfDay(date);

    return await db
      .select()
      .from(meals)
      .where(
        and(
          eq(meals.userId, userId),
          gte(meals.date, start),
          lte(meals.date, end)
        )
      )
      .orderBy(desc(meals.date));
  }

  async createMeal(userId: string, meal: InsertMeal): Promise<Meal> {
    const [newMeal] = await db
      .insert(meals)
      .values({
        ...meal,
        userId,
      })
      .returning();
    return newMeal;
  }

  // Workout operations
  async getWorkoutsByUserAndDate(userId: string, date: Date): Promise<Workout[]> {
    const start = startOfDay(date);
    const end = endOfDay(date);

    return await db
      .select()
      .from(workouts)
      .where(
        and(
          eq(workouts.userId, userId),
          gte(workouts.date, start),
          lte(workouts.date, end)
        )
      )
      .orderBy(desc(workouts.date));
  }

  async createWorkout(userId: string, workout: InsertWorkout): Promise<Workout> {
    const [newWorkout] = await db
      .insert(workouts)
      .values({
        ...workout,
        userId,
      })
      .returning();
    return newWorkout;
  }

  // Summary operations
  async getDailySummary(userId: string, date: Date): Promise<DailySummary> {
    const start = startOfDay(date);
    const end = endOfDay(date);

    const [mealSummary] = await db
      .select({
        totalCalories: sql<number>`COALESCE(SUM(CAST(${meals.calories} AS NUMERIC)), 0)`,
        totalProtein: sql<number>`COALESCE(SUM(CAST(${meals.protein} AS NUMERIC)), 0)`,
        totalCarbs: sql<number>`COALESCE(SUM(CAST(${meals.carbs} AS NUMERIC)), 0)`,
        totalFat: sql<number>`COALESCE(SUM(CAST(${meals.fat} AS NUMERIC)), 0)`,
        mealCount: sql<number>`COUNT(*)`,
      })
      .from(meals)
      .where(
        and(
          eq(meals.userId, userId),
          gte(meals.date, start),
          lte(meals.date, end)
        )
      );

    const [workoutSummary] = await db
      .select({
        totalWorkoutMinutes: sql<number>`COALESCE(SUM(${workouts.durationMinutes}), 0)`,
        workoutCount: sql<number>`COUNT(*)`,
      })
      .from(workouts)
      .where(
        and(
          eq(workouts.userId, userId),
          gte(workouts.date, start),
          lte(workouts.date, end)
        )
      );

    return {
      date: format(date, "yyyy-MM-dd"),
      totalCalories: Number(mealSummary?.totalCalories || 0),
      totalProtein: Number(mealSummary?.totalProtein || 0),
      totalCarbs: Number(mealSummary?.totalCarbs || 0),
      totalFat: Number(mealSummary?.totalFat || 0),
      totalWorkoutMinutes: Number(workoutSummary?.totalWorkoutMinutes || 0),
      mealCount: Number(mealSummary?.mealCount || 0),
      workoutCount: Number(workoutSummary?.workoutCount || 0),
    };
  }

  async getWeeklySummary(userId: string): Promise<WeeklySummary> {
    const days: DailySummary[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = subDays(today, i);
      const summary = await this.getDailySummary(userId, date);
      days.push(summary);
    }

    return { days };
  }
}

export const storage = new DatabaseStorage();
