import {
  users,
  meals,
  workouts,
  type User,
  type UpsertUser,
  type UpdateUserTDEE,
  type Meal,
  type InsertMeal,
  type Workout,
  type InsertWorkout,
  type DailySummary,
  type WeeklySummary,
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserTDEE(userId: string, tdeeData: UpdateUserTDEE): Promise<User>;

  // Meal operations
  getMealsByUserAndDate(userId: string, date: Date): Promise<Meal[]>;
  createMeal(userId: string, meal: InsertMeal): Promise<Meal>;
  getMealById(mealId: string): Promise<any>;
  deleteMeal(mealId: string): Promise<void>;

  // Workout operations
  getWorkoutsByUserAndDate(userId: string, date: Date): Promise<Workout[]>;
  createWorkout(userId: string, workout: InsertWorkout): Promise<Workout>;
  getWorkoutById(workoutId: string): Promise<any>;
  deleteWorkout(workoutId: string): Promise<void>;

  // Summary operations
  getDailySummary(userId: string, date: Date): Promise<DailySummary>;
  getWeeklySummary(userId: string): Promise<WeeklySummary>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    // 使用原始 SQL 查詢，避免 schema 不匹配問題
    const result = await pool.query(
      `SELECT id, email, password_hash, first_name, last_name, created_at, updated_at,
              gender, age, height, weight, body_fat, activity_level,
              bmr, tdee, goal, goal_calories, goal_protein, goal_carbs, goal_fat
       FROM users 
       WHERE id = $1 
       LIMIT 1`,
      [id]
    );

    if (!result.rows || result.rows.length === 0) {
      return undefined;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      firstName: row.first_name,
      lastName: row.last_name,
      profileImageUrl: null, // 數據庫中沒有此欄位，設為 null
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      gender: row.gender,
      age: row.age,
      heightCm: row.height ? String(row.height) : null,
      currentWeightKg: row.weight ? String(row.weight) : null,
      bodyFatPercentage: row.body_fat ? String(row.body_fat) : null,
      activityLevel: row.activity_level,
      bmr: row.bmr ? String(row.bmr) : null,
      tdee: row.tdee ? String(row.tdee) : null,
      goalType: row.goal,
      goalCalories: row.goal_calories,
      proteinG: row.goal_protein,
      carbsG: row.goal_carbs,
      fatG: row.goal_fat,
      lastTdeeUpdate: null, // 數據庫中沒有此欄位，設為 null
    } as User;
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

  async updateUserTDEE(userId: string, tdeeData: UpdateUserTDEE): Promise<User> {
    // 使用原始 SQL 查詢，避免 schema 不匹配問題
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    // 映射欄位名稱：從 shared/schema 格式轉換為實際數據庫格式
    if (tdeeData.gender !== undefined) {
      updateFields.push(`gender = $${paramIndex++}`);
      updateValues.push(tdeeData.gender.toUpperCase());
    }
    if (tdeeData.age !== undefined) {
      updateFields.push(`age = $${paramIndex++}`);
      updateValues.push(tdeeData.age);
    }
    if (tdeeData.heightCm !== undefined) {
      updateFields.push(`height = $${paramIndex++}`); // heightCm -> height
      updateValues.push(parseFloat(String(tdeeData.heightCm)));
    }
    if (tdeeData.currentWeightKg !== undefined) {
      updateFields.push(`weight = $${paramIndex++}`); // currentWeightKg -> weight
      updateValues.push(parseFloat(String(tdeeData.currentWeightKg)));
    }
    // bodyFatPercentage 不在 UpdateUserTDEE 類型中，跳過
    if (tdeeData.activityLevel !== undefined) {
      updateFields.push(`activity_level = $${paramIndex++}`);
      updateValues.push(tdeeData.activityLevel.toUpperCase());
    }
    if (tdeeData.bmr !== undefined) {
      updateFields.push(`bmr = $${paramIndex++}`);
      updateValues.push(parseFloat(String(tdeeData.bmr)));
    }
    if (tdeeData.tdee !== undefined) {
      updateFields.push(`tdee = $${paramIndex++}`);
      updateValues.push(parseFloat(String(tdeeData.tdee)));
    }
    if (tdeeData.goalType !== undefined) {
      updateFields.push(`goal = $${paramIndex++}`); // goalType -> goal
      // 映射前端的 goalType 值到數據庫 enum 值
      let mappedGoalType: string;
      const goalTypeLower = tdeeData.goalType.toLowerCase();
      if (goalTypeLower === 'maintain') {
        mappedGoalType = 'MAINTAIN';
      } else if (goalTypeLower === 'cut' || goalTypeLower === 'aggressive_cut' || goalTypeLower === 'lose' || goalTypeLower === 'lose_weight') {
        mappedGoalType = 'LOSE_WEIGHT';
      } else if (goalTypeLower === 'bulk' || goalTypeLower === 'gain' || goalTypeLower === 'gain_muscle') {
        mappedGoalType = 'GAIN_MUSCLE';
      } else {
        mappedGoalType = 'MAINTAIN';
      }
      updateValues.push(mappedGoalType);
    }
    if (tdeeData.goalCalories !== undefined) {
      updateFields.push(`goal_calories = $${paramIndex++}`);
      updateValues.push(parseFloat(String(tdeeData.goalCalories)));
    }
    if (tdeeData.proteinG !== undefined) {
      updateFields.push(`goal_protein = $${paramIndex++}`); // proteinG -> goal_protein
      updateValues.push(parseFloat(String(tdeeData.proteinG)));
    }
    if (tdeeData.carbsG !== undefined) {
      updateFields.push(`goal_carbs = $${paramIndex++}`); // carbsG -> goal_carbs
      updateValues.push(parseFloat(String(tdeeData.carbsG)));
    }
    if (tdeeData.fatG !== undefined) {
      updateFields.push(`goal_fat = $${paramIndex++}`); // fatG -> goal_fat
      updateValues.push(parseFloat(String(tdeeData.fatG)));
    }

    // 添加時間戳（數據庫中沒有 last_tdee_update 欄位，只更新 updated_at）
    updateFields.push(`updated_at = NOW()`);

    if (updateFields.length === 1) {
      // 只有 updated_at，沒有其他欄位需要更新
      throw new Error("No fields to update");
    }

    updateValues.push(userId);

    const updateSql = `UPDATE users 
                       SET ${updateFields.join(', ')} 
                       WHERE id = $${paramIndex}`;

    await pool.query(updateSql, updateValues);

    // 返回更新後的用戶
    const updatedUser = await this.getUser(userId);
    if (!updatedUser) {
      throw new Error("User not found");
    }
    
    return updatedUser;
  }

  // Meal operations
  async getMealsByUserAndDate(userId: string, date: Date): Promise<Meal[]> {
    const start = startOfDay(date);
    const end = endOfDay(date);

    // 使用原始 SQL 查詢，確保正確映射 name 欄位
    const result = await pool.query(
      `SELECT id, user_id, name, description, meal_type, calories, protein, carbs, fat, 
              serving_size, serving_size_unit, user_serving_amount, portion, photo, 
              consumed_at, created_at, updated_at 
       FROM meals 
       WHERE user_id = $1 AND consumed_at >= $2 AND consumed_at <= $3 
       ORDER BY consumed_at DESC`,
      [userId, start, end]
    );

    // 轉換為 Meal 格式（匹配 shared/schema.ts 的類型）
    const meals = result.rows.map(row => {
      console.log('[getMealsByUserAndDate] Raw row:', {
        id: row.id,
        name: row.name,
        nameType: typeof row.name,
        nameLength: row.name?.length,
      });
      return {
        id: row.id,
        userId: row.user_id,
        name: row.name, // 直接使用數據庫中的 name，不添加默認值
        description: row.description,
        mealType: row.meal_type,
        calories: row.calories,
        protein: row.protein,
        carbs: row.carbs,
        fat: row.fat,
        servingSize: row.serving_size,
        servingSizeUnit: row.serving_size_unit,
        userServingAmount: row.user_serving_amount,
        portion: row.portion,
        photo: row.photo,
        consumedAt: row.consumed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
    
    console.log(`[getMealsByUserAndDate] Returning ${meals.length} meals`);
    return meals;
  }

  async createMeal(userId: string, meal: InsertMeal): Promise<Meal> {
    // 原始 SQL 插入，用於捕捉最底層的資料庫錯誤
    console.log('[createMeal - RAW SQL] 準備插入資料:', { userId, meal });

    // 定義要插入的欄位 (snake_case)
    const columns = [
      'user_id', 'name', 'meal_type', 'calories', 'protein', 'carbs', 'fat', 'consumed_at',
      'description', 'serving_size', 'serving_size_unit', 'user_serving_amount', 'portion', 'photo'
    ];

    // 準備對應的值，並做安全的型別轉換
    const values = [
        userId,
      meal.name,
      meal.mealType?.toUpperCase() || 'BREAKFAST',
      parseFloat(String(meal.calories)) || 0,
      parseFloat(String(meal.protein)) || 0,
      parseFloat(String(meal.carbs)) || 0,
      parseFloat(String(meal.fat)) || 0,
      meal.consumedAt || new Date(),
      meal.description || null,
      meal.servingSize ? parseFloat(String(meal.servingSize)) : null,
      meal.servingSizeUnit || null,
      meal.userServingAmount ? parseFloat(String(meal.userServingAmount)) : null,
      meal.portion || null,
      meal.photo || null
    ];

    // 產生 SQL 佔位符 ($1, $2, ...)
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

    const sqlQuery = `
      INSERT INTO meals (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *;
    `;

    try {
      const result = await pool.query(sqlQuery, values);
      const newMealFromDB = result.rows[0];
      
      if (!newMealFromDB) {
        throw new Error('資料庫插入後未返回任何資料。');
      }

      console.log('[createMeal - RAW SQL] 成功插入:', newMealFromDB);
      console.log('[createMeal - RAW SQL] 插入的 name 欄位:', newMealFromDB.name);
      console.log('[createMeal - RAW SQL] 原始 meal.name:', meal.name);
      
      // 將從資料庫返回的 snake_case 欄位映射回 TypeScript 的 camelCase
      const returnedMeal = {
        id: newMealFromDB.id,
        userId: newMealFromDB.user_id,
        name: newMealFromDB.name || meal.name, // 確保 name 欄位存在
        description: newMealFromDB.description,
        mealType: newMealFromDB.meal_type,
        calories: newMealFromDB.calories,
        protein: newMealFromDB.protein,
        carbs: newMealFromDB.carbs,
        fat: newMealFromDB.fat,
        servingSize: newMealFromDB.serving_size,
        servingSizeUnit: newMealFromDB.serving_size_unit,
        userServingAmount: newMealFromDB.user_serving_amount,
        portion: newMealFromDB.portion,
        photo: newMealFromDB.photo,
        consumedAt: newMealFromDB.consumed_at,
        createdAt: newMealFromDB.created_at,
        updatedAt: newMealFromDB.updated_at,
      };
      
      console.log('[createMeal - RAW SQL] 返回的 meal 對象:', returnedMeal);
      console.log('[createMeal - RAW SQL] 返回的 meal.name:', returnedMeal.name);
      
      return returnedMeal;

    } catch (error: any) {
      // 這是最重要的部分：印出詳細的資料庫錯誤訊息
      console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
      console.error('!!! [createMeal - RAW SQL] 資料庫插入失敗 !!!');
      console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
      console.error({
        message: error.message,
        code: error.code,       // 錯誤碼，例如 '23503' (外鍵約束)
        detail: error.detail,   // 錯誤細節，例如 "Key (user_id)=(...) is not present in table "users"."
        query: sqlQuery,
        values: values,
        stack: error.stack,
      });
      console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
      throw error; 
    }
  }
  

  // Get meal by ID
  async getMealById(mealId: string): Promise<any> {
    const [meal] = await db
      .select()
      .from(meals)
      .where(eq(meals.id, mealId))
      .limit(1);
    return meal || null;
  }

  // Delete meal
  async deleteMeal(mealId: string): Promise<void> {
    await pool.query(
      "DELETE FROM meals WHERE id = $1",
      [mealId]
    );
  }

  // Workout operations
  async getWorkoutsByUserAndDate(userId: string, date: Date): Promise<Workout[]> {
    const start = startOfDay(date);
    const end = endOfDay(date);

    // 使用原始 SQL 查詢，匹配實際數據庫 schema (performedAt, duration)
    const result = await pool.query(
      `SELECT id, user_id, name, workout_type, duration, calories_burned, intensity, exercises, notes, photos, performed_at, created_at, updated_at 
       FROM workouts 
       WHERE user_id = $1 AND performed_at >= $2 AND performed_at <= $3 
       ORDER BY performed_at DESC`,
      [userId, start, end]
    );

    // 轉換為 Workout 格式（匹配 shared/schema.ts 的類型）
    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      workoutType: row.workout_type?.toLowerCase() || row.workout_type,
      durationMinutes: row.duration, // 映射 duration -> durationMinutes
      date: row.performed_at, // 映射 performedAt -> date
      notes: row.notes,
      exercises: row.exercises, // 保留 exercises JSON
      createdAt: row.created_at,
    }));
  }

  async createWorkout(userId: string, workoutData: InsertWorkout): Promise<Workout> {
    console.log("[createWorkout] Starting with:", { userId, workoutData });
    
    try {
      // 使用原始 SQL，匹配實際數據庫 schema (duration, performed_at, name)
      // 根據 migration 文件，workouts 表需要 name 欄位（NOT NULL）
      const workoutType = workoutData.workoutType || 'OTHER';
      const workoutName = workoutData.name || workoutType || 'Workout'; // name 欄位是必需的
      const duration = workoutData.durationMinutes || 0;
      const performedAt = workoutData.date || new Date();
      const notes = workoutData.notes || null;
      const exercises = (workoutData as any).exercises || null; // 支持 exercises JSON

      const sqlQuery = `
        INSERT INTO workouts (user_id, name, workout_type, duration, performed_at, notes, exercises)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, user_id, name, workout_type, duration, performed_at, notes, exercises, created_at
      `;
      
      const values = [
        userId,
        workoutName, // name 欄位是必需的
        workoutType,
        duration,
        performedAt,
        notes,
        exercises, // exercises JSON 欄位
      ];

      console.log("[createWorkout] Executing SQL:", sqlQuery);
      console.log("[createWorkout] Values:", values);

      const result = await pool.query(sqlQuery, values);
      
      if (!result.rows || result.rows.length === 0) {
        throw new Error("Failed to create workout: no rows returned from database");
      }
      
      const row = result.rows[0];
      console.log("[createWorkout] Raw database row:", row);

      // 轉換為 Workout 格式（匹配 shared/schema.ts 的類型）
      const workout: any = {
        id: row.id,
        userId: row.user_id,
        workoutType: row.workout_type?.toLowerCase() || row.workout_type,
        durationMinutes: row.duration, // 映射 duration -> durationMinutes
        date: row.performed_at, // 映射 performed_at -> date
        notes: row.notes,
        exercises: row.exercises, // 保留 exercises JSON
        createdAt: row.created_at || new Date(), // 如果數據庫沒有返回 created_at，使用當前時間
      };

      console.log("[createWorkout] Successfully created workout:", workout);
      return workout;
    } catch (error: any) {
      // 詳細的錯誤日誌
      console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      console.error("!!! [createWorkout - RAW SQL] 資料庫插入失敗 !!!");
      console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      console.error({
        message: error.message,
        code: error.code,       // PostgreSQL 錯誤碼
        detail: error.detail,   // 錯誤細節
        hint: error.hint,       // PostgreSQL 提示
        position: error.position, // 錯誤位置
        query: sqlQuery,
        values: values,
        stack: error.stack,
      });
      console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      throw error;
    }
  }

  // Get workout by ID
  async getWorkoutById(workoutId: string): Promise<any> {
    const [workout] = await db
      .select()
      .from(workouts)
      .where(eq(workouts.id, workoutId))
      .limit(1);
    return workout || null;
  }

  // Delete workout
  async deleteWorkout(workoutId: string): Promise<void> {
    await pool.query(
      "DELETE FROM workouts WHERE id = $1",
      [workoutId]
    );
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
          gte(meals.consumedAt, start),
          lte(meals.consumedAt, end)
        )
      );

    // 使用原始 SQL 查詢，因為實際數據庫使用 duration 而不是 duration_minutes
    const workoutResult = await pool.query(
      `SELECT 
         COALESCE(SUM(duration), 0) as total_duration,
         COUNT(*) as workout_count
        FROM workouts 
        WHERE user_id = $1 AND performed_at >= $2 AND performed_at <= $3`,
      [userId, start, end]
    );

    const workoutSummary = workoutResult.rows[0] || {};

    return {
      date: format(date, "yyyy-MM-dd"),
      totalCalories: Number(mealSummary?.totalCalories || 0),
      totalProtein: Number(mealSummary?.totalProtein || 0),
      totalCarbs: Number(mealSummary?.totalCarbs || 0),
      totalFat: Number(mealSummary?.totalFat || 0),
      totalWorkoutMinutes: Number(workoutSummary?.total_duration || 0),
      mealCount: Number(mealSummary?.mealCount || 0),
      workoutCount: Number(workoutSummary?.workout_count || 0),
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
