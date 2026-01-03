import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  decimal,
  boolean,
  index,
  jsonb,
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
  // 注意：數據庫表中 id 是 integer (serial)，不是 varchar
  id: integer("id").primaryKey(),
  email: varchar("email").unique().notNull(),
  // Local auth password hash (only used for email/password login)
  passwordHash: varchar("password_hash").notNull(),
  // Role: 'client' or 'coach'
  role: text("role").default("client").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  avatar: varchar("avatar"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  // Email 驗證（實際數據庫表中存在）
  emailVerified: boolean("email_verified").default(false).notNull(),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationExpires: integer("email_verification_expires"), // BIGINT 存儲時間戳（毫秒）

  // TDEE and Body Metrics
  // 注意：以下字段在實際數據庫表中不存在，已註釋掉以避免插入錯誤
  // gender: varchar("gender", { length: 20 }),
  // age: integer("age"),
  // heightCm: decimal("height_cm", { precision: 10, scale: 2 }),
  // currentWeightKg: decimal("current_weight_kg", { precision: 10, scale: 2 }),
  // bodyFatPercentage: decimal("body_fat_percentage", { precision: 5, scale: 2 }),

  // TDEE Calculations
  // activityLevel: varchar("activity_level", { length: 20 }), // sedentary, light, moderate, very_active, extra_active
  // bmr: decimal("bmr", { precision: 10, scale: 2 }), // Basal Metabolic Rate
  // tdee: decimal("tdee", { precision: 10, scale: 2 }), // Total Daily Energy Expenditure

  // Nutrition Goals
  // goalType: varchar("goal_type", { length: 20 }), // bulk, cut, maintain, aggressive_cut, custom
  // goalCalories: integer("goal_calories"),
  // proteinG: integer("protein_g"),
  // carbsG: integer("carbs_g"),
  // fatG: integer("fat_g"),

  // lastTdeeUpdate: timestamp("last_tdee_update"),
});

// Meals table - tracks food intake
export const meals = pgTable(
  "meals",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),  // 改為 "name" 以匹配 server/db/schema.ts
    description: text("description"),
    mealType: varchar("meal_type", { length: 50 }).notNull(), // breakfast, lunch, dinner, snack
    calories: decimal("calories", { precision: 10, scale: 2 }).notNull(),
    protein: decimal("protein", { precision: 10, scale: 2 }),
    carbs: decimal("carbs", { precision: 10, scale: 2 }),
    fat: decimal("fat", { precision: 10, scale: 2 }),
    // Serving size fields
    servingSize: decimal("serving_size", { precision: 10, scale: 2 }), // Base serving size from database (g/ml)
    servingSizeUnit: varchar("serving_size_unit", { length: 10 }), // Unit: "g" or "ml"
    userServingAmount: decimal("user_serving_amount", { precision: 10, scale: 2 }), // User's actual serving amount (g/ml)
    portion: text("portion"), // 例如：1 碗、200g
    photo: text("photo"), // 圖片 URL
    consumedAt: timestamp("consumed_at", { withTimezone: true }).defaultNow().notNull(), // 改為 consumedAt 以匹配 server/db/schema.ts
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("meals_user_id_idx").on(table.userId),
    index("meals_consumed_at_idx").on(table.consumedAt),
  ],
);

// Workouts table - tracks physical activity
export const workouts = pgTable(
  "workouts",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workoutType: varchar("workout_type", { length: 100 }).notNull(), // run, strength, yoga, etc.
    durationMinutes: integer("duration_minutes").notNull(),
    date: timestamp("date").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("workouts_user_id_idx").on(table.userId),
    index("workouts_date_idx").on(table.date),
  ],
);

// TDEE History table - tracks changes over time
export const tdeeHistory = pgTable(
  "tdee_history",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: timestamp("date").notNull().defaultNow(),
    weightKg: decimal("weight_kg", { precision: 10, scale: 2 }).notNull(),
    bodyFatPercentage: decimal("body_fat_percentage", {
      precision: 5,
      scale: 2,
    }),
    activityLevel: varchar("activity_level", { length: 20 }).notNull(),
    bmr: decimal("bmr", { precision: 10, scale: 2 }).notNull(),
    tdee: decimal("tdee", { precision: 10, scale: 2 }).notNull(),
    goalCalories: integer("goal_calories").notNull(),
    proteinG: integer("protein_g").notNull(),
    carbsG: integer("carbs_g").notNull(),
    fatG: integer("fat_g").notNull(),
    notes: text("notes"),
  },
  (table) => [
    index("tdee_history_user_id_idx").on(table.userId),
    index("tdee_history_date_idx").on(table.date),
  ],
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  meals: many(meals),
  workouts: many(workouts),
  tdeeHistory: many(tdeeHistory),
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

export const tdeeHistoryRelations = relations(tdeeHistory, ({ one }) => ({
  user: one(users, {
    fields: [tdeeHistory.userId],
    references: [users.id],
  }),
}));

// Zod schemas for validation
export const insertMealSchema = createInsertSchema(meals, {
  name: z.string().min(1, "Food name is required"),  // 改為 "name"
  calories: z.union([z.string(), z.number()]).transform((val) => String(val)),
  protein: z.union([z.string(), z.number()]).optional()
    .transform((val) => val !== undefined && val !== null && val !== "" ? String(val) : undefined),
  carbs: z.union([z.string(), z.number()]).optional()
    .transform((val) => val !== undefined && val !== null && val !== "" ? String(val) : undefined),
  fat: z.union([z.string(), z.number()]).optional()
    .transform((val) => val !== undefined && val !== null && val !== "" ? String(val) : undefined),
  mealType: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]),
  consumedAt: z.union([z.date(), z.string()])  // 改為 consumedAt
    .transform((val) => (typeof val === "string" ? new Date(val) : val)),
  
  // ✅ 添加缺失的字段
  servingSize: z.union([z.string(), z.number()]).optional()
    .transform((val) => val !== undefined && val !== null && val !== "" ? String(val) : undefined),
  servingSizeUnit: z.enum(["g", "ml"]).optional(),
  userServingAmount: z.union([z.string(), z.number()]).optional()
    .transform((val) => val !== undefined && val !== null && val !== "" ? String(val) : undefined),
  
  description: z.string().optional(),
  portion: z.string().optional(),
  photo: z.string().optional(),
}).omit({ id: true, userId: true, createdAt: true, updatedAt: true });

export const insertWorkoutSchema = createInsertSchema(workouts, {
  workoutType: z.string().min(1, "Workout type is required"),
  durationMinutes: z
    .number()
    .int()
    .min(1, "Duration must be at least 1 minute"),
  date: z
    .union([z.date(), z.string()])
    .transform((val) => (typeof val === "string" ? new Date(val) : val)),
  notes: z.string().optional(),
}).omit({ id: true, userId: true, createdAt: true });

export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatar: true,
});

// TDEE calculation schema
export const calculateTDEESchema = z.object({
  weight: z.number().positive("Weight must be positive"),
  height: z.number().positive("Height must be positive"),
  age: z.number().int().positive("Age must be positive").max(120),
  gender: z.enum(["male", "female"]),
  activityLevel: z.enum(["sedentary", "lightly_active", "moderately_active", "very_active", "extra_active"]),
});

// Update user TDEE schema
export const updateUserTDEESchema = z.object({
  gender: z.enum(["male", "female"]).optional(),
  age: z.number().int().positive().max(120).optional(),
  heightCm: z.union([z.string(), z.number()]).optional().transform((val) => {
    if (val === undefined || val === null || val === "") return undefined;
    const num = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(num) || num <= 0) throw new Error("Height must be a positive number");
    return String(num);
  }),
  currentWeightKg: z.union([z.string(), z.number()]).optional().transform((val) => {
    if (val === undefined || val === null || val === "") return undefined;
    const num = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(num) || num <= 0) throw new Error("Weight must be a positive number");
    return String(num);
  }),
  activityLevel: z.enum(["sedentary", "lightly_active", "moderately_active", "very_active", "extra_active"]).optional(),
  bmr: z.union([z.string(), z.number()]).optional().transform((val) => {
    if (val === undefined || val === null || val === "") return undefined;
    const num = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(num) || num < 0) throw new Error("BMR must be a non-negative number");
    return String(num);
  }),
  tdee: z.union([z.string(), z.number()]).optional().transform((val) => {
    if (val === undefined || val === null || val === "") return undefined;
    const num = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(num) || num < 0) throw new Error("TDEE must be a non-negative number");
    return String(num);
  }),
  goalType: z.enum(["bulk", "cut", "maintain", "aggressive_cut", "custom"]).optional(),
  goalCalories: z.number().int().positive().optional(),
  proteinG: z.number().int().min(0).optional(),
  carbsG: z.number().int().min(0).optional(),
  fatG: z.number().int().min(0).optional(),
});

// TypeScript types
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type CalculateTDEE = z.infer<typeof calculateTDEESchema>;
export type UpdateUserTDEE = z.infer<typeof updateUserTDEESchema>;
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
