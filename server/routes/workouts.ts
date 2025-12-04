import { Router } from "express";
import { pool } from "../db";
import { isAuthenticated } from "../replitAuth";

const router = Router();

// POST /api/workouts - 創建訓練記錄
router.post("/workouts", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const {
      workoutType,
      exerciseName,
      duration,
      durationMinutes,
      calories,
      caloriesBurned,
      sets,
      reps,
      weight,
      weightUnit,
      exercises, // ✅ 接收完整訓練組陣列
      notes,
      performedAt,
      date,
    } = req.body;

    // 添加調試日誌
    console.log('📝 Creating workout:', {
      workoutType,
      exerciseName,
      duration,
      performedAt: performedAt || date,
    });
    console.log("[POST /api/workouts] Request body:", JSON.stringify(req.body, null, 2));
    console.log("[POST /api/workouts] Received exercises:", exercises);

    // 驗證必需欄位
    const isStrength = workoutType === 'STRENGTH';
    const isCardio = workoutType === 'CARDIO';

    if (!workoutType || (!isStrength && !isCardio)) {
      console.log("[POST /api/workouts] Validation failed: workoutType missing or invalid");
      return res.status(400).json({
        error: 'Missing required field: workoutType (must be STRENGTH or CARDIO)'
      });
    }

    if (!exerciseName) {
      console.log("[POST /api/workouts] Validation failed: exerciseName missing");
      return res.status(400).json({
        error: 'Missing required field: exerciseName'
      });
    }

    if (!performedAt && !date) {
      console.log("[POST /api/workouts] Validation failed: performedAt missing");
      return res.status(400).json({
        error: 'Missing required field: performedAt'
      });
    }

    // 對於力量訓練，驗證 exercises 數組
    if (isStrength) {
      if (!exercises || !Array.isArray(exercises) || exercises.length === 0) {
        console.log("[POST /api/workouts] Validation failed: No exercises provided for STRENGTH workout");
        return res.status(400).json({
          error: 'No exercises provided. For STRENGTH workouts, exercises array is required.'
        });
      }
    }

    // 對於 Cardio，duration 必須 > 0
    const finalDuration = duration || durationMinutes || 0;
    if (isCardio && (!duration && !durationMinutes || finalDuration <= 0)) {
      console.log("[POST /api/workouts] Validation failed: Cardio duration invalid");
      return res.status(400).json({
        error: 'Cardio workouts require duration > 0'
      });
    }

    // 構建 exercises JSON
    let exercisesJson = null;
    
    // 如果前端直接提供了 exercises 數組，使用它（優先級最高）
    if (exercises && Array.isArray(exercises)) {
      exercisesJson = JSON.stringify(exercises);
      console.log("[POST /api/workouts] Using provided exercises array with", exercises.length, "sets");
      console.log("[POST /api/workouts] Exercises data:", JSON.stringify(exercises, null, 2));
    }
    // 否則，如果提供了單個 sets/reps/weight，創建單元素數組（向後兼容）
    else if (exerciseName || sets || reps || weight) {
      exercisesJson = JSON.stringify([{
        exerciseName: exerciseName || null,
        sets: sets || null,
        reps: reps || null,
        weight: weight || null,
        weightUnit: weightUnit || 'kg',
      }]);
      console.log("[POST /api/workouts] Creating single exercise from individual fields");
    }

    const finalPerformedAt = performedAt || date || new Date();
    const finalCalories = calories || caloriesBurned || null;
    const workoutName = exerciseName || workoutType || 'Workout';

    const result = await pool.query(
      `INSERT INTO workouts (
        user_id, name, workout_type, duration, calories_burned, exercises, notes, performed_at, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
      ) RETURNING *`,
      [
        userId,
        workoutName,
        workoutType,
        finalDuration,
        finalCalories,
        exercisesJson,
        notes || null,
        finalPerformedAt,
      ]
    );

    console.log('✅ Workout saved successfully:', result.rows[0].id);
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error("Error creating workout:", error);
    res.status(500).json({ error: "Failed to create workout", details: error.message });
  }
});

// GET /api/workouts - 查詢訓練記錄
router.get("/workouts", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { date } = req.query;

    let query = `SELECT * FROM workouts WHERE user_id = $1`;
    const params: any[] = [userId];

    if (date && typeof date === 'string') {
      // date 格式：2025-12-05（香港本地日期）
      // 需要轉換為 UTC 時間範圍查詢
      // 香港是 UTC+8，所以需要減 8 小時來轉換為 UTC
      
      // 解析日期字符串（例如：2025-12-05）
      const [year, month, day] = date.split('-').map(Number);
      
      // 創建 UTC 日期的開始時間（2025-12-05 00:00:00 UTC）
      const utcStartOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      
      // 創建 UTC 日期的結束時間（2025-12-05 23:59:59.999 UTC）
      const utcEndOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
      
      // 轉換為對應的 UTC 時間（減去 8 小時，因為香港是 UTC+8）
      // 2025-12-05 00:00:00 HKT = 2025-12-04 16:00:00 UTC
      // 2025-12-05 23:59:59 HKT = 2025-12-05 15:59:59 UTC
      const startOfDayUTC = new Date(utcStartOfDay.getTime() - 8 * 60 * 60 * 1000);
      const endOfDayUTC = new Date(utcEndOfDay.getTime() - 8 * 60 * 60 * 1000);
      
      console.log(`[GET /api/workouts] Query for date: ${date} (HKT)`);
      console.log(`[GET /api/workouts] UTC range: ${startOfDayUTC.toISOString()} to ${endOfDayUTC.toISOString()}`);
      
      query += ` AND performed_at >= $2 AND performed_at <= $3`;
      params.push(startOfDayUTC.toISOString());
      params.push(endOfDayUTC.toISOString());
    } else {
      // 沒有指定日期，返回最近一天的數據
      query += ` AND performed_at >= NOW() - INTERVAL '1 day'`;
    }

    query += ` ORDER BY performed_at DESC`;

    const result = await pool.query(query, params);
    
    // 轉換數據格式以匹配前端期望
    const workouts = result.rows.map((row: any) => {
      // 解析 exercises JSON 以提取 exercise_name
      let exerciseName = null;
      if (row.exercises) {
        try {
          const exercises = typeof row.exercises === 'string' 
            ? JSON.parse(row.exercises) 
            : row.exercises;
          if (Array.isArray(exercises) && exercises.length > 0) {
            exerciseName = exercises[0]?.exerciseName || null;
          }
        } catch (e) {
          console.error('Error parsing exercises in GET /api/workouts:', e);
        }
      }

      return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        workoutType: row.workout_type,
        workout_type: row.workout_type, // 保留原始字段以兼容
        duration: row.duration,
        durationMinutes: row.duration, // 添加別名
        calories: row.calories_burned,
        caloriesBurned: row.calories_burned, // 添加別名
        exercises: row.exercises,
        exercise_name: exerciseName, // 從 exercises JSON 中提取
        notes: row.notes,
        date: row.performed_at,
        performed_at: row.performed_at, // 保留原始字段
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
    
    console.log(`[GET /api/workouts] Returning ${workouts.length} workouts for date: ${date || 'today'}`);
    res.json(workouts);
  } catch (error: any) {
    console.error("Error fetching workouts:", error);
    res.status(500).json({ error: "Failed to fetch workouts", details: error.message });
  }
});

// GET /api/workouts/:id - 獲取單個訓練詳情
router.get("/workouts/:id", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const workoutId = req.params.id;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const result = await pool.query(
      `SELECT * FROM workouts WHERE id = $1 AND user_id = $2`,
      [workoutId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Workout not found" });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error fetching workout:", error);
    res.status(500).json({ error: "Failed to fetch workout", details: error.message });
  }
});

// PUT /api/workouts/:id - 更新訓練
router.put("/workouts/:id", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const workoutId = req.params.id;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const {
      workoutType,
      duration,
      durationMinutes,
      calories,
      caloriesBurned,
      sets,
      reps,
      weight,
      weightUnit,
      exerciseName,
      notes,
      performedAt,
      date,
    } = req.body;

    // 添加調試日誌
    console.log("[PUT /api/workouts/:id] Request body:", JSON.stringify(req.body, null, 2));

    // 檢查 workout 是否存在且屬於該用戶
    const existingResult = await pool.query(
      "SELECT user_id FROM workouts WHERE id = $1",
      [workoutId]
    );

    if (
      existingResult.rows.length === 0 ||
      existingResult.rows[0].user_id !== userId
    ) {
      return res.status(403).json({
        error: "You do not have permission to update this workout",
      });
    }

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
    if (calories !== undefined || caloriesBurned !== undefined) {
      updates.push(`calories_burned = $${paramCount++}`);
      values.push(calories || caloriesBurned);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramCount++}`);
      values.push(notes);
    }
    if (performedAt !== undefined || date !== undefined) {
      updates.push(`performed_at = $${paramCount++}`);
      values.push(performedAt || date);
    }

    // 處理 exercises JSON
    // 優先處理前端直接提供的 exercises 數組
    if (req.body.exercises && Array.isArray(req.body.exercises)) {
      const exercises = JSON.stringify(req.body.exercises);
      console.log("[PUT /api/workouts/:id] Using provided exercises array with", req.body.exercises.length, "sets");
      updates.push(`exercises = $${paramCount++}`);
      values.push(exercises);
    }
    // 否則，如果提供了單個字段，更新第一個 exercise（向後兼容）
    else if (exerciseName !== undefined || sets !== undefined || reps !== undefined || weight !== undefined) {
      // 獲取現有的 exercises 或創建新的
      const existingWorkout = await pool.query(
        "SELECT exercises FROM workouts WHERE id = $1",
        [workoutId]
      );
      
      let exercises = null;
      if (existingWorkout.rows[0]?.exercises) {
        try {
          const existingExercises = typeof existingWorkout.rows[0].exercises === 'string'
            ? JSON.parse(existingWorkout.rows[0].exercises)
            : existingWorkout.rows[0].exercises;
          
          if (Array.isArray(existingExercises) && existingExercises.length > 0) {
            // 更新第一個 exercise
            exercises = JSON.stringify([{
              ...existingExercises[0],
              exerciseName: exerciseName !== undefined ? exerciseName : existingExercises[0].exerciseName,
              sets: sets !== undefined ? sets : existingExercises[0].sets,
              reps: reps !== undefined ? reps : existingExercises[0].reps,
              weight: weight !== undefined ? weight : existingExercises[0].weight,
              weightUnit: weightUnit !== undefined ? weightUnit : (existingExercises[0].weightUnit || 'kg'),
            }]);
          } else {
            exercises = JSON.stringify([{
              exerciseName: exerciseName || null,
              sets: sets || null,
              reps: reps || null,
              weight: weight || null,
              weightUnit: weightUnit || 'kg',
            }]);
          }
        } catch (e) {
          exercises = JSON.stringify([{
            exerciseName: exerciseName || null,
            sets: sets || null,
            reps: reps || null,
            weight: weight || null,
            weightUnit: weightUnit || 'kg',
          }]);
        }
      } else {
        exercises = JSON.stringify([{
          exerciseName: exerciseName || null,
          sets: sets || null,
          reps: reps || null,
          weight: weight || null,
          weightUnit: weightUnit || 'kg',
        }]);
      }
      
      updates.push(`exercises = $${paramCount++}`);
      values.push(exercises);
    }

    updates.push(`updated_at = NOW()`);

    if (updates.length === 1) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const updateQuery = `UPDATE workouts SET ${updates.join(
      ", "
    )} WHERE id = $${paramCount} RETURNING *`;
    values.push(workoutId);

    const result = await pool.query(updateQuery, values);
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error updating workout:", error);
    res.status(500).json({ error: "Failed to update workout", details: error.message });
  }
});

// DELETE /api/workouts/:id - 刪除訓練
router.delete("/workouts/:id", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const workoutId = req.params.id;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const existingResult = await pool.query(
      "SELECT user_id FROM workouts WHERE id = $1",
      [workoutId]
    );

    if (
      existingResult.rows.length === 0 ||
      existingResult.rows[0].user_id !== userId
    ) {
      return res.status(403).json({
        error: "You do not have permission to delete this workout",
      });
    }

    await pool.query("DELETE FROM workouts WHERE id = $1", [workoutId]);
    res.json({ message: "Workout deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting workout:", error);
    res.status(500).json({ error: "Failed to delete workout", details: error.message });
  }
});

// GET /api/workouts/stats/personal-best - 個人最佳記錄
router.get(
  "/workouts/stats/personal-best",
  isAuthenticated,
  async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

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
    } catch (error: any) {
      console.error("Error fetching personal best:", error);
      res.status(500).json({ error: "Failed to fetch personal best", details: error.message });
    }
  }
);

export default router;

