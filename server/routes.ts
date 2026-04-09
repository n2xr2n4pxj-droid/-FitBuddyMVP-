import type { Express } from "express";
import { createServer, type Server } from "http";
import { rateLimit } from "express-rate-limit";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { meals } from "./db/schema";
import { insertMealSchema, insertWorkoutSchema, calculateTDEESchema, updateUserTDEESchema } from "../shared/schema";
import { format } from "date-fns";
import { calculateTDEE, calculateMacros } from "./tdee";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { config } from "./config/env";
import workoutRoutes from "./routes/workouts";
import coachRoutes from "./routes/coaches";
import coachClientRoutes from "./routes/coach-client";
import plansRoutes from "./routes/plans";
import authRoutes from "./routes/auth";
import invitationRoutes from "./routes/invitations";
import emailAdminRouter from "./routes/emailAdminRoutes";
import foodRoutes from "./routes/food";
import healthRoutes from "./routes/health";
import userRoutes from "./routes/users";
import usersV1PublicRoutes from "./routes/users-v1";
import aiRoutes from "./routes/ai";
import exercisesRoutes from "./routes/exercises";
import dashboardRoutes from "./routes/dashboard";
import notificationsRoutes from "./routes/notifications";
import analyticsRoutes from "./routes/analytics";
import nutritionRoutes from "./routes/nutrition";

// ==========================================
// 速率限制：防止暴力破解 / 帳號枚舉
// 每 IP 在 15 分鐘內最多呼叫 20 次，開發環境自動跳過
// ==========================================
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "TOO_MANY_REQUESTS", message: "請求過於頻繁，請 15 分鐘後再試" },
  skip: () => config.app.env === "development",
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Health (no auth)
  app.use("/api", healthRoutes);
  // Users (JWT, admin or self)
  app.use("/api", userRoutes);

  // Users v1 — 公開：GET /api/v1/users/check-username
  app.use("/api/v1/users", usersV1PublicRoutes);

  // Register auth routes（登入/註冊/忘記密碼加速率限制）
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);
  app.use("/api/auth/forgot-password", authLimiter);
  app.use("/api", authRoutes);

  // Register workout routes
  app.use("/api", workoutRoutes);
  
  // AI routes: /api/ai/generate-routine, /api/ai/workout-summary
  app.use("/api", aiRoutes);
  
  // Register coach routes
  // Routes: /api/coaches/add-client, /api/coaches/invite, /api/coaches/clients, etc.
  app.use("/api", coachRoutes);
  // Coach/client relationship list (coach_clients table): /api/coach/clients, /api/client/coaches
  app.use("/api", coachClientRoutes);
  
  // Plans（Phase D）：/api/plans/*
  app.use("/api", plansRoutes);
  // Dashboard（Phase E）：/api/dashboard/*
  app.use("/api/dashboard", dashboardRoutes);
  // Notifications（Phase F）：/api/notifications/*
  app.use("/api", notificationsRoutes);
  // Analytics（Phase H）：/api/analytics/*
  app.use("/api/analytics", analyticsRoutes);
  // Nutrition（Phase G）：/api/nutrition/*
  app.use("/api/nutrition", nutritionRoutes);
  
  // Register invitation routes (v1 API - recommended)
  // Routes: /api/v1/invitations/send, /api/v1/invitations/status/:code, /api/v1/invitations/accept/:code, etc.
  app.use("/api/v1/invitations", invitationRoutes);
  
  // Register invitation routes (legacy - for backward compatibility)
  // Routes: /api/invitations/send, /api/invitations/status/:code, etc.
  app.use("/api/invitations", invitationRoutes);
  
  // Admin email routes
  app.use("/api/admin/email", emailAdminRouter);
  
  // Open Food Facts API routes
  // Routes: /api/food/search?query=...
  app.use("/api/food", foodRoutes);

  // Exercises (動作庫)：GET /api/exercises?search=...
  app.use("/api", exercisesRoutes);

  // Auth routes
  app.get("/api/auth/user", async (req: any, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
        return res.json(null);
      }

      // 從數據庫重新查詢用戶信息，確保獲取最新的 role 字段
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.json(null);
      }

      // 從數據庫查詢最新的用戶信息（包括 role）
      const { pool } = await import("./db");
      const result = await pool.query(
        `SELECT id, email, first_name, last_name, role, created_at FROM users WHERE id = $1 LIMIT 1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.json(null);
      }

      const dbUser = result.rows[0];
      console.log('[GET /api/auth/user] Raw DB user:', dbUser);
      
      // 轉換字段名從 snake_case 到 camelCase，並確保包含 role
      const user = {
        id: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.first_name,
        lastName: dbUser.last_name,
        role: dbUser.role, // 確保包含 role 字段
        createdAt: dbUser.created_at,
      };
      
      console.log('[GET /api/auth/user] Returning user with role:', user.role);
      console.log('[GET /api/auth/user] Full user object:', JSON.stringify(user, null, 2));
      
      // 禁用緩存，確保總是返回最新數據
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Meal endpoints
  app.get("/api/meals/:date?", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const dateParam = req.params.date || format(new Date(), "yyyy-MM-dd");
      const date = new Date(dateParam);
      
      console.log(`[GET /api/meals/${dateParam}] Fetching meals for user ${userId}, date: ${date.toISOString()}`);
      
      const meals = await storage.getMealsByUserAndDate(userId, date);
      console.log(`[GET /api/meals/${dateParam}] Found ${meals.length} meals`);
      
      res.json(meals);
    } catch (error) {
      console.error("Error fetching meals:", error);
      res.status(500).json({ message: "Failed to fetch meals" });
    }
  });

  app.post("/api/meals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "No userId in session" });
      }
      
      // ✅ 轉換字段名稱以匹配新 schema
      // 優先使用 req.body.name（新格式），否則使用 req.body.foodName（舊格式）
      const mealName = req.body.name || req.body.foodName;
      
      // 如果 name 是空字符串或只有空白，拒絕請求
      if (!mealName || !mealName.trim()) {
        return res.status(400).json({ 
          message: "Food name is required and cannot be empty" 
        });
      }
      
      // 處理 consumedAt：如果沒有提供，使用當前時間
      let consumedAt = req.body.date || req.body.consumedAt;
      if (!consumedAt) {
        consumedAt = new Date();
      } else if (typeof consumedAt === 'string') {
        consumedAt = new Date(consumedAt);
      }
      
      const mealData = {
        name: mealName.trim(),  // 去除前後空白
        calories: req.body.calories,
        protein: req.body.protein,
        carbs: req.body.carbs,
        fat: req.body.fat,
        mealType: req.body.mealType,
        consumedAt: consumedAt,  // 使用處理後的 consumedAt
        servingSize: req.body.servingSize,
        servingSizeUnit: req.body.servingSizeUnit,
        userServingAmount: req.body.userServingAmount,
        description: req.body.description,
        portion: req.body.portion,
        photo: req.body.photo,
      };
      
      console.log("[POST /api/meals] Request body:", req.body);
      console.log("[POST /api/meals] Processed consumedAt:", consumedAt, "Type:", typeof consumedAt);
      console.log("[POST /api/meals] Processed meal name:", mealData.name);
      console.log("[POST /api/meals] Validating meal data...", mealData);
      const validated = insertMealSchema.parse(mealData);
      console.log("[POST /api/meals] Validation passed:", validated);
      
      console.log("[POST /api/meals] Creating meal...");
      const meal = await storage.createMeal(userId, validated);
      console.log("[POST /api/meals] Meal created successfully:", meal);
      
      res.status(201).json(meal);
    } catch (error: any) {
      console.error("[POST /api/meals] Error creating meal:", {
        error: error.message,
        errors: error.errors || error.issues,
      });
      
      if (error.name === "ZodError") {
        res.status(400).json({ 
          message: "Invalid meal data", 
          errors: error.errors || error.issues 
        });
      } else {
        res.status(500).json({ 
          message: "Failed to create meal",
          error: error.message 
        });
      }
    }
  });

  // Workout endpoints - 已移至 server/routes/workouts.ts
  // 以下路由已被新的 workouts.ts 路由文件取代
  /*
  app.get("/api/workouts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { date } = req.query;
      
      let queryDate: Date;
      if (date) {
        queryDate = new Date(date as string);
      } else {
        // 默認獲取最近一天的訓練
        queryDate = new Date();
      }
      
      const workouts = await storage.getWorkoutsByUserAndDate(userId, queryDate);
      res.json(workouts);
    } catch (error) {
      console.error("Error fetching workouts:", error);
      res.status(500).json({ message: "Failed to fetch workouts" });
    }
  });

  // GET /api/workouts/:date - 獲取特定日期的訓練（保持向後兼容）
  app.get("/api/workouts/:date", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const dateParam = req.params.date;
      const date = new Date(dateParam);
      
      const workouts = await storage.getWorkoutsByUserAndDate(userId, date);
      res.json(workouts);
    } catch (error) {
      console.error("Error fetching workouts:", error);
      res.status(500).json({ message: "Failed to fetch workouts" });
    }
  });

  // GET /api/workouts/stats/personal-best - 個人最佳記錄
  app.get("/api/workouts/stats/personal-best", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { pool } = await import("./db");
      
      // 從 exercises JSON 中提取個人最佳記錄
      const result = await pool.query(
        `SELECT 
          exercises,
          workout_type,
          performed_at,
          name
         FROM workouts
         WHERE user_id = $1 
           AND exercises IS NOT NULL 
           AND exercises != 'null'
           AND exercises != '[]'
         ORDER BY performed_at DESC`,
        [userId]
      );

      // 解析 exercises JSON 並找出個人最佳
      const personalBests: any[] = [];
      const exerciseMap = new Map<string, any>();

      for (const row of result.rows) {
        try {
          const exercises = typeof row.exercises === 'string' 
            ? JSON.parse(row.exercises) 
            : row.exercises;
          
          if (Array.isArray(exercises)) {
            for (const exercise of exercises) {
              if (exercise.exerciseName && exercise.weight) {
                const key = `${exercise.exerciseName}_${exercise.weightUnit || 'kg'}`;
                const current = exerciseMap.get(key);
                
                if (!current || parseFloat(exercise.weight) > parseFloat(current.max_weight)) {
                  exerciseMap.set(key, {
                    exercise_name: exercise.exerciseName,
                    max_weight: parseFloat(exercise.weight),
                    weight_unit: exercise.weightUnit || 'kg',
                    max_sets: exercise.sets || null,
                    max_reps: exercise.reps || null,
                    last_performed: row.performed_at,
                    workout_type: row.workout_type,
                  });
                }
              }
            }
          }
        } catch (e) {
          console.error("Error parsing exercises JSON:", e);
        }
      }

      personalBests.push(...Array.from(exerciseMap.values()));
      personalBests.sort((a, b) => (b.max_weight || 0) - (a.max_weight || 0));

      res.json(personalBests);
    } catch (error) {
      console.error("Error fetching personal best:", error);
      res.status(500).json({ error: "Failed to fetch personal best" });
    }
  });

  app.post("/api/workouts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "No userId in session" });
      }

      const {
        workoutType,
        duration,
        durationMinutes,
        calories,
        sets,
        reps,
        weight,
        weightUnit,
        exerciseName,
        notes,
        performedAt,
        date,
      } = req.body;

      // 構建 exercises JSON（如果提供了詳細信息）
      let exercises = null;
      if (exerciseName || sets || reps || weight) {
        exercises = JSON.stringify([{
          exerciseName: exerciseName || null,
          sets: sets || null,
          reps: reps || null,
          weight: weight || null,
          weightUnit: weightUnit || 'kg',
        }]);
      }

      // 準備 workout 數據
      const workoutData = {
        workoutType: workoutType || 'OTHER',
        durationMinutes: duration || durationMinutes || 0,
        date: performedAt || date || new Date(),
        notes: notes || null,
        name: exerciseName || workoutType || 'Workout',
        exercises: exercises,
      };

      console.log("[POST /api/workouts] Request body:", req.body);
      console.log("[POST /api/workouts] Processed workout data:", workoutData);
      console.log("[POST /api/workouts] Validating workout data...");
      const validated = insertWorkoutSchema.parse(workoutData);
      console.log("[POST /api/workouts] Validation passed:", validated);
      
      console.log("[POST /api/workouts] Creating workout...");
      const workout = await storage.createWorkout(userId, validated);
      console.log("[POST /api/workouts] Workout created successfully:", workout);
      
      res.status(201).json(workout);
    } catch (error: any) {
      console.error("[POST /api/workouts] Error creating workout:", {
        error: error.message,
        errors: error.errors || error.issues,
        code: error.code,
        detail: error.detail,
      });
      
      if (error.name === "ZodError") {
        res.status(400).json({ 
          message: "Invalid workout data", 
          errors: error.errors || error.issues 
        });
      } else {
        res.status(500).json({ 
          message: "Failed to create workout",
          error: error.message
        });
      }
    }
  });

  // GET /api/workouts/:id - 獲取單個訓練詳情
  app.get("/api/workouts/detail/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const workoutId = req.params.id;
      
      const workout = await storage.getWorkoutById(workoutId);
      
      if (!workout) {
        return res.status(404).json({ message: "Workout not found" });
      }

      // 檢查權限
      const workoutUserId = String(workout.userId || workout.user_id || "");
      if (workoutUserId !== String(userId)) {
        return res.status(403).json({ message: "Unauthorized to view this workout" });
      }

      res.json(workout);
    } catch (error) {
      console.error("Error fetching workout:", error);
      res.status(500).json({ message: "Failed to fetch workout" });
    }
  });

  // PUT /api/workouts/:id - 更新訓練
  app.put("/api/workouts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const workoutId = req.params.id;
      const {
        workoutType,
        duration,
        durationMinutes,
        calories,
        sets,
        reps,
        weight,
        weightUnit,
        exerciseName,
        notes,
      } = req.body;

      // 檢查 workout 是否存在且屬於該用戶
      const existing = await storage.getWorkoutById(workoutId);
      if (!existing) {
        return res.status(404).json({ message: "Workout not found" });
      }

      const workoutUserId = String(existing.userId || existing.user_id || "");
      if (workoutUserId !== String(userId)) {
        return res.status(403).json({ message: "Unauthorized to update this workout" });
      }

      // 構建更新數據
      const { pool } = await import("./db");
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (workoutType !== undefined) {
        updates.push(`workout_type = $${paramCount++}`);
        values.push(workoutType);
      }
      if (duration !== undefined || durationMinutes !== undefined) {
        updates.push(`duration = $${paramCount++}`);
        values.push(duration || durationMinutes);
      }
      if (notes !== undefined) {
        updates.push(`notes = $${paramCount++}`);
        values.push(notes);
      }

      // 處理 exercises JSON
      if (exerciseName || sets !== undefined || reps !== undefined || weight !== undefined) {
        const exercises = JSON.stringify([{
          exerciseName: exerciseName || null,
          sets: sets || null,
          reps: reps || null,
          weight: weight || null,
          weightUnit: weightUnit || 'kg',
        }]);
        updates.push(`exercises = $${paramCount++}`);
        values.push(exercises);
      }

      updates.push(`updated_at = NOW()`);
      values.push(workoutId);

      const updateQuery = `UPDATE workouts SET ${updates.join(", ")} WHERE id = $${paramCount} RETURNING *`;
      
      const result = await pool.query(updateQuery, values);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Workout not found" });
      }

      res.json(result.rows[0]);
    } catch (error: any) {
      console.error("Error updating workout:", error);
      res.status(500).json({ error: "Failed to update workout" });
    }
  });

  // Summary endpoints
  // Daily Summary - 完整修復版
  app.get("/api/summary/daily/:date?", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const dateParam = req.params.date || format(new Date(), "yyyy-MM-dd");
      const date = new Date(dateParam);
      
      console.log("[DailySummary] userId:", userId, "date:", dateParam);

      if (!userId) {
        return res.status(401).json({ message: "No userId in session" });
      }

      let summary;
      try {
        summary = await storage.getDailySummary(userId, date);
        console.log("[DailySummary] Storage returned:", summary);
      } catch (e: any) {
        console.error("[storage.getDailySummary] Error:", e);
        return res.status(500).json({ 
          message: "Failed to fetch daily summary (storage)",
          error: e?.message || String(e)
        });
      }

      res.json(summary || {});
    } catch (error: any) {
      console.error("[DailySummary] Unexpected error:", error);
      res.status(500).json({ 
        message: "Failed to fetch daily summary",
        error: error?.message || String(error)
      });
    }
  });

  // ✅ Weekly Summary - 完整修復版
  app.get("/api/summary/weekly", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      
      console.log("[WeeklySummary] userId:", userId);
      
      if (!userId) {
        console.warn("[WeeklySummary] No userId found in session");
        return res.status(401).json({ message: "No userId in session" });
      }
      
      let summary;
      try {
        summary = await storage.getWeeklySummary(userId);
        console.log("[WeeklySummary] Storage returned:", summary);
      } catch (storageError: any) {
        console.error("[storage.getWeeklySummary] Error:", storageError);
        return res.status(500).json({ 
          message: "Failed to fetch weekly summary (storage layer)",
          error: storageError?.message || String(storageError)
        });
      }
      
      res.json(summary || {});
      
    } catch (error: any) {
      console.error("[WeeklySummary] Unexpected error:", error);
      res.status(500).json({ 
        message: "Failed to fetch weekly summary",
        error: error?.message || String(error)
      });
    }
  });

  // DELETE meal endpoint
  app.delete("/api/meals/:id", async (req: any, res) => {
    try {
      // 手動檢查認證 - 不走 middleware，直接檢查 req.user
      if (!req.user) {
        console.log("[DeleteMeal] Not authenticated");
        return res.status(401).json({ 
          success: false,
          message: "Authentication required" 
        });
      }

      const userId = req.user?.claims?.sub || req.user?.id;
      const mealId = req.params.id;
      
      console.log("[DeleteMeal] userId:", userId, "mealId:", mealId);
      
      if (!userId) {
        return res.status(401).json({ message: "No userId in session" });
      }
      
      // 驗證 meal 屬於該 user
      const meal = await storage.getMealById(mealId);
      if (!meal) {
        return res.status(404).json({ message: "Meal not found" });
      }
      
      // 檢查 userId 類型並比較
      // Drizzle ORM 返回的字段名是 userId (camelCase)
      const mealUserId = String(meal.userId || meal.user_id || meal.userid || "");
      const currentUserId = String(userId);
      
      console.log("[DeleteMeal] Comparing user IDs:", { 
        mealUserId, 
        currentUserId, 
        mealFields: Object.keys(meal),
        mealUserField: meal.userId || meal.user_id || meal.userid 
      });
      
      if (mealUserId !== currentUserId) {
        console.warn("[DeleteMeal] Unauthorized:", { mealUserId, currentUserId });
        return res.status(403).json({ message: "Unauthorized to delete this meal" });
      }
      
      // 刪除 meal
      await storage.deleteMeal(mealId);
      
      console.log("[DeleteMeal] Success");
      
      // ⬇️ 重點：確保返回 JSON，不要重定向
      return res.status(200).json({ 
        success: true,
        message: "Meal deleted successfully" 
      });
      
    } catch (error: any) {
      console.error("[DeleteMeal] Error:", error);
      return res.status(500).json({ 
        success: false,
        message: "Failed to delete meal",
        error: error?.message || String(error)
      });
    }
  });

  // Update meal endpoint
  app.patch("/api/meals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const mealId = req.params.id;

      if (!userId) {
        return res.status(401).json({ message: "No userId in session" });
      }

      if (!mealId) {
        return res.status(400).json({ error: "Invalid meal ID" });
      }

      // Extract update fields (support both camelCase and snake_case for compatibility)
      const {
        foodName,
        foodname,
        servingSize,
        servingsize,
        servingSizeUnit,
        userServingAmount,
        calories,
        protein,
        carbs,
        fat,
        mealType,
        mealtype,
      } = req.body;

      // Verify meal exists and belongs to user
      const [existingMeal] = await db
        .select()
        .from(meals)
        .where(
          and(
            eq(meals.id, mealId),
            eq(meals.userId, userId)
          )
        )
        .limit(1);

      if (!existingMeal) {
        return res.status(404).json({ error: "Meal not found or access denied" });
      }

      // Build update object with explicit field handling
      const updateFields: any = {
        createdAt: existingMeal.createdAt, // Preserve original creation time
      };

      // Handle foodName (support both naming conventions)
      if (foodName !== undefined) {
        updateFields.foodName = foodName;
      } else if (foodname !== undefined) {
        updateFields.foodName = foodname;
      }

      // Handle servingSize
      if (servingSize !== undefined && servingSize !== null && servingSize !== "") {
        updateFields.servingSize = String(servingSize);
      } else if (servingsize !== undefined && servingsize !== null && servingsize !== "") {
        updateFields.servingSize = String(servingsize);
      }

      // Handle servingSizeUnit
      if (servingSizeUnit !== undefined) {
        updateFields.servingSizeUnit = servingSizeUnit;
      }

      // Handle userServingAmount
      if (userServingAmount !== undefined && userServingAmount !== null && userServingAmount !== "") {
        updateFields.userServingAmount = String(userServingAmount);
      }

      // Handle calories
      if (calories !== undefined && calories !== null && calories !== "") {
        updateFields.calories = String(calories);
      }

      // Handle protein
      if (protein !== undefined && protein !== null && protein !== "") {
        updateFields.protein = String(protein);
      }

      // Handle carbs
      if (carbs !== undefined && carbs !== null && carbs !== "") {
        updateFields.carbs = String(carbs);
      }

      // Handle fat
      if (fat !== undefined && fat !== null && fat !== "") {
        updateFields.fat = String(fat);
      }

      // Handle mealType (support both naming conventions)
      if (mealType !== undefined) {
        updateFields.mealType = mealType;
      } else if (mealtype !== undefined) {
        updateFields.mealType = mealtype;
      }

      // Update meal
      const [updatedMeal] = await db
        .update(meals)
        .set(updateFields)
        .where(eq(meals.id, mealId))
        .returning();

      console.log(`[API] Meal ${mealId} updated successfully`);
      res.json(updatedMeal);
    } catch (error: any) {
      console.error("[API] Error updating meal:", error);
      res.status(500).json({ 
        error: "Failed to update meal",
        message: error?.message || String(error)
      });
    }
  });

  // DELETE workout endpoint - 已移至 server/routes/workouts.ts
  */
  /*
  app.delete("/api/workouts/:id", async (req: any, res) => {
    try {
      // 手動檢查認證 - 不走 middleware
      if (!req.user) {
        console.log("[DeleteWorkout] Not authenticated");
        return res.status(401).json({ 
          success: false,
          message: "Authentication required" 
        });
      }

      const userId = req.user?.claims?.sub || req.user?.id;
      const workoutId = req.params.id;
      
      console.log("[DeleteWorkout] userId:", userId, "workoutId:", workoutId);
      
      if (!userId) {
        return res.status(401).json({ message: "No userId in session" });
      }
      
      // 驗證 workout 屬於該 user
      const workout = await storage.getWorkoutById(workoutId);
      if (!workout) {
        return res.status(404).json({ message: "Workout not found" });
      }
      
      // 檢查 userId 類型並比較
      // Drizzle ORM 返回的字段名是 userId (camelCase)
      const workoutUserId = String(workout.userId || workout.user_id || workout.userid || "");
      const currentUserId = String(userId);
      
      console.log("[DeleteWorkout] Comparing user IDs:", { 
        workoutUserId, 
        currentUserId, 
        workoutFields: Object.keys(workout),
        workoutUserField: workout.userId || workout.user_id || workout.userid 
      });
      
      if (workoutUserId !== currentUserId) {
        console.warn("[DeleteWorkout] Unauthorized:", { workoutUserId, currentUserId });
        return res.status(403).json({ message: "Unauthorized to delete this workout" });
      }
      
      // 刪除 workout
      await storage.deleteWorkout(workoutId);
      
      console.log("[DeleteWorkout] Success");
      
      // ⬇️ 重點：確保返回 JSON，不要重定向
      return res.status(200).json({ 
        success: true,
        message: "Workout deleted successfully" 
      });
      
    } catch (error: any) {
      console.error("[DeleteWorkout] Error:", error);
      return res.status(500).json({ 
        success: false,
        message: "Failed to delete workout",
        error: error?.message || String(error)
      });
    }
  });
  */

  // TDEE endpoints
  
  // Map frontend activity level to backend format
  const mapActivityLevel = (level: string): "sedentary" | "lightly_active" | "moderately_active" | "very_active" | "extra_active" => {
    const mapping: Record<string, "sedentary" | "lightly_active" | "moderately_active" | "very_active" | "extra_active"> = {
      sedentary: "sedentary",
      light: "lightly_active",
      moderate: "moderately_active",
      heavy: "very_active",
      athlete: "extra_active",
    };
    return mapping[level] || "sedentary";
  };

  // Map frontend goal to calorie adjustment
  const mapGoalToCalorieAdjustment = (goal: string, tdee: number): number => {
    const adjustments: Record<string, number> = {
      extreme_loss: -1000,
      weight_loss: -500,
      mild_loss: -250,
      maintain: 0,
      mild_gain: 250,
      weight_gain: 500,
      extreme_gain: 1000,
    };
    return Math.round(tdee + (adjustments[goal] || 0));
  };

  // Map frontend goal to backend goalType
  const mapGoalToGoalType = (goal: string): "bulk" | "cut" | "maintain" | "aggressive_cut" => {
    if (goal.includes("loss") || goal === "extreme_loss") return "aggressive_cut";
    if (goal.includes("gain")) return "bulk";
    return "maintain";
  };

  // Calculate TDEE and save to database
  app.post("/api/tdee/calculate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "No userId in session" });
      }

      const { age, gender, height, weight, activityLevel, goal } = req.body;

      // Validate required fields
      if (!age || !gender || !height || !weight || !activityLevel || !goal) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Map frontend activity level to backend format
      const backendActivityLevel = mapActivityLevel(activityLevel);

      // Calculate TDEE
      const tdeeResult = calculateTDEE({
        age: parseInt(age),
        gender: gender as "male" | "female",
        height: parseFloat(height),
        weight: parseFloat(weight),
        activityLevel: backendActivityLevel,
      });

      // Calculate target calories based on goal
      const targetCalories = mapGoalToCalorieAdjustment(goal, tdeeResult.tdee);
      const goalType = mapGoalToGoalType(goal);

      // Calculate macros
      const isCutting = goal.includes("loss");
      const macros = calculateMacros(
        parseFloat(weight),
        targetCalories,
        isCutting ? "lose" : goal === "maintain" ? "maintain" : "gain"
      );

      // Calculate BMI
      const heightInMeters = parseFloat(height) / 100;
      const bmi = parseFloat(weight) / (heightInMeters * heightInMeters);

      // Calculate ratios
      const proteinRatio = (macros.proteinG * 4 / targetCalories) * 100;
      const carbsRatio = (macros.carbsG * 4 / targetCalories) * 100;
      const fatRatio = (macros.fatG * 9 / targetCalories) * 100;

      // Save to database
      const updateData = {
        age: parseInt(age),
        gender: gender as "male" | "female",
        heightCm: String(height),
        currentWeightKg: String(weight),
        activityLevel: backendActivityLevel,
        bmr: String(tdeeResult.bmr),
        tdee: String(tdeeResult.tdee),
        goalType,
        goalCalories: targetCalories,
        proteinG: macros.proteinG,
        carbsG: macros.carbsG,
        fatG: macros.fatG,
      };

      await storage.updateUserTDEE(userId, updateData);

      // Return profile format
      res.json({
        age: parseInt(age),
        gender,
        height: parseFloat(height),
        weight: parseFloat(weight),
        activityLevel,
        goal,
        bmr: tdeeResult.bmr,
        tdee: tdeeResult.tdee,
        bmi: Math.round(bmi * 10) / 10,
        targetCalories,
        targetProtein: macros.proteinG,
        targetCarbs: macros.carbsG,
        targetFat: macros.fatG,
        proteinRatio: Math.round(proteinRatio),
        carbsRatio: Math.round(carbsRatio),
        fatRatio: Math.round(fatRatio),
      });
    } catch (error: any) {
      console.error("Error calculating TDEE:", error);
      if (error.name === "ZodError") {
        res.status(400).json({ message: "Invalid input data", errors: error.errors });
      } else {
        res.status(400).json({ message: error.message || "Failed to calculate TDEE" });
      }
    }
  });

  // Get TDEE Profile
  app.get("/api/tdee/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "No userId in session" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // 擴展用戶類型以包含 TDEE 相關字段（這些字段在實際使用中存在但不在類型定義中）
      type UserWithTDEE = typeof user & {
        heightCm?: string | null;
        currentWeightKg?: string | null;
        bmr?: string | null;
        tdee?: string | null;
        goalCalories?: number | null;
        activityLevel?: string | null;
        goalType?: string | null;
        proteinG?: number | null;
        carbsG?: number | null;
        fatG?: number | null;
        age?: number | null;
        gender?: string | null;
      };
      const userWithTDEE = user as UserWithTDEE;

      // Map backend activity level to frontend format
      const mapBackendActivityLevel = (level: string | null): string | null => {
        if (!level) return null;
        const mapping: Record<string, string> = {
          sedentary: "sedentary",
          lightly_active: "light",
          moderately_active: "moderate",
          very_active: "heavy",
          extra_active: "athlete",
        };
        return mapping[level] || null;
      };

      // Map backend goalType to frontend goal
      const mapBackendGoalType = (goalType: string | null, goalCalories: number | null, tdee: number | null): string | null => {
        if (!goalType || !goalCalories || !tdee) return null;
        const diff = goalCalories - Number(tdee);
        if (diff <= -1000) return "extreme_loss";
        if (diff <= -500) return "weight_loss";
        if (diff <= -250) return "mild_loss";
        if (diff >= 1000) return "extreme_gain";
        if (diff >= 500) return "weight_gain";
        if (diff >= 250) return "mild_gain";
        return "maintain";
      };

      const height = userWithTDEE.heightCm ? parseFloat(userWithTDEE.heightCm) : null;
      const weight = userWithTDEE.currentWeightKg ? parseFloat(userWithTDEE.currentWeightKg) : null;
      const bmr = userWithTDEE.bmr ? parseFloat(userWithTDEE.bmr) : null;
      const tdee = userWithTDEE.tdee ? parseFloat(userWithTDEE.tdee) : null;
      const goalCalories = userWithTDEE.goalCalories || null;

      // Calculate BMI
      let bmi: number | null = null;
      if (height && weight) {
        const heightInMeters = height / 100;
        bmi = weight / (heightInMeters * heightInMeters);
      }

      // Calculate ratios
      let proteinRatio = 0;
      let carbsRatio = 0;
      let fatRatio = 0;
      if (goalCalories && userWithTDEE.proteinG && userWithTDEE.carbsG && userWithTDEE.fatG) {
        proteinRatio = (userWithTDEE.proteinG * 4 / goalCalories) * 100;
        carbsRatio = (userWithTDEE.carbsG * 4 / goalCalories) * 100;
        fatRatio = (userWithTDEE.fatG * 9 / goalCalories) * 100;
      }

      res.json({
        age: userWithTDEE.age || null,
        gender: (userWithTDEE.gender?.toLowerCase() as 'male' | 'female' | null) || null,
        height,
        weight,
        activityLevel: mapBackendActivityLevel(userWithTDEE.activityLevel || null),
        goal: mapBackendGoalType(userWithTDEE.goalType || null, goalCalories, tdee),
        bmr,
        tdee,
        bmi: bmi ? Math.round(bmi * 10) / 10 : null,
        targetCalories: goalCalories,
        targetProtein: userWithTDEE.proteinG || null,
        targetCarbs: userWithTDEE.carbsG || null,
        targetFat: userWithTDEE.fatG || null,
        proteinRatio: Math.round(proteinRatio),
        carbsRatio: Math.round(carbsRatio),
        fatRatio: Math.round(fatRatio),
      });
    } catch (error: any) {
      console.error("Error fetching TDEE profile:", error);
      res.status(500).json({ message: "Failed to fetch TDEE profile" });
    }
  });

  // Get Today's Progress
  app.get("/api/tdee/today-progress", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "No userId in session" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // 擴展用戶類型以包含 TDEE 相關字段
      type UserWithTDEE = typeof user & {
        goalCalories?: number | null;
        proteinG?: number | null;
        carbsG?: number | null;
        fatG?: number | null;
      };
      const userWithTDEE = user as UserWithTDEE;

      const today = format(new Date(), "yyyy-MM-dd");
      const summary = await storage.getDailySummary(userId, new Date(today));

      const targetCalories = userWithTDEE.goalCalories || 0;
      const targetProtein = userWithTDEE.proteinG || 0;
      const targetCarbs = userWithTDEE.carbsG || 0;
      const targetFat = userWithTDEE.fatG || 0;

      const consumed = {
        calories: summary?.totalCalories || 0,
        protein: summary?.totalProtein || 0,
        carbs: summary?.totalCarbs || 0,
        fat: summary?.totalFat || 0,
      };

      const remaining = {
        calories: Math.max(0, targetCalories - consumed.calories),
        protein: Math.max(0, targetProtein - consumed.protein),
        carbs: Math.max(0, targetCarbs - consumed.carbs),
        fat: Math.max(0, targetFat - consumed.fat),
      };

      const percentage = {
        calories: targetCalories > 0 ? Math.min(100, Math.round((consumed.calories / targetCalories) * 100)) : 0,
        protein: targetProtein > 0 ? Math.min(100, Math.round((consumed.protein / targetProtein) * 100)) : 0,
        carbs: targetCarbs > 0 ? Math.min(100, Math.round((consumed.carbs / targetCarbs) * 100)) : 0,
        fat: targetFat > 0 ? Math.min(100, Math.round((consumed.fat / targetFat) * 100)) : 0,
      };

      res.json({
        target: {
          calories: targetCalories,
          protein: targetProtein,
          carbs: targetCarbs,
          fat: targetFat,
        },
        consumed,
        remaining,
        percentage,
      });
    } catch (error: any) {
      console.error("Error fetching today's progress:", error);
      res.status(500).json({ message: "Failed to fetch today's progress" });
    }
  });

  app.put("/api/user/tdee", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const validated = updateUserTDEESchema.parse(req.body);
      
      const user = await storage.updateUserTDEE(userId, validated);
      res.json(user);
    } catch (error: any) {
      console.error("Error updating user TDEE:", error);
      if (error.name === "ZodError") {
        res.status(400).json({ message: "Invalid TDEE data", errors: error.errors });
      } else if (error.message === "User not found") {
        res.status(404).json({ message: "User not found" });
      } else {
        res.status(500).json({ message: "Failed to update user TDEE" });
      }
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
