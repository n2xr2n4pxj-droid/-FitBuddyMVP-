import { sql } from "drizzle-orm";
import { 
  pgTable, 
  text, 
  varchar, 
  timestamp, 
  integer, 
  decimal,
  index,
  jsonb 
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Meals table - tracks food intake
export const meals = pgTable("meals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  foodName: text("food_name").notNull(),
  calories: decimal("calories", { precision: 10, scale: 2 }).notNull(),
  protein: decimal("protein", { precision: 10, scale: 2 }),
  carbs: decimal("carbs", { precision: 10, scale: 2 }),
  fat: decimal("fat", { precision: 10, scale: 2 }),
  mealType: varchar("meal_type", { length: 50 }).notNull(), // breakfast, lunch, dinner, snack
  date: timestamp("date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("meals_user_id_idx").on(table.userId),
  index("meals_date_idx").on(table.date),
]);

// Workouts table - tracks physical activity
export const workouts = pgTable("workouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  workoutType: varchar("workout_type", { length: 100 }).notNull(), // run, strength, yoga, etc.
  durationMinutes: integer("duration_minutes").notNull(),
  date: timestamp("date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("workouts_user_id_idx").on(table.userId),
  index("workouts_date_idx").on(table.date),
]);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  meals: many(meals),
  workouts: many(workouts),
}));

export const mealsRelations = relations(meals, ({ one }) => ({
  user: one(users, {
    fields: [meals.userId],
    references: [users.id],
  }),
}));

export const workoutsRelations = relations(workouts, ({ one }) => ({
  user: one(users, {
    fields: [workouts.userId],
    references: [users.id],
  }),
}));

// Zod schemas for validation
export const insertMealSchema = createInsertSchema(meals, {
  foodName: z.string().min(1, "Food name is required"),
  calories: z.union([z.string(), z.number()]).transform((val) => String(val)),
  protein: z.union([z.string(), z.number()]).optional().transform((val) => val !== undefined && val !== null && val !== "" ? String(val) : undefined),
  carbs: z.union([z.string(), z.number()]).optional().transform((val) => val !== undefined && val !== null && val !== "" ? String(val) : undefined),
  fat: z.union([z.string(), z.number()]).optional().transform((val) => val !== undefined && val !== null && val !== "" ? String(val) : undefined),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  date: z.union([z.date(), z.string()]).transform((val) => typeof val === 'string' ? new Date(val) : val),
}).omit({ id: true, userId: true, createdAt: true });

export const insertWorkoutSchema = createInsertSchema(workouts, {
  workoutType: z.string().min(1, "Workout type is required"),
  durationMinutes: z.number().int().min(1, "Duration must be at least 1 minute"),
  date: z.union([z.date(), z.string()]).transform((val) => typeof val === 'string' ? new Date(val) : val),
  notes: z.string().optional(),
}).omit({ id: true, userId: true, createdAt: true });

export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

// TypeScript types
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;
export type Meal = typeof meals.$inferSelect;
export type InsertMeal = z.infer<typeof insertMealSchema>;
export type Workout = typeof workouts.$inferSelect;
export type InsertWorkout = z.infer<typeof insertWorkoutSchema>;

// Summary types for dashboard
export type DailySummary = {
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalWorkoutMinutes: number;
  mealCount: number;
  workoutCount: number;
};

export type WeeklySummary = {
  days: DailySummary[];
};
