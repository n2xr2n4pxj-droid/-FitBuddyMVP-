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

    if (!workoutType || (!duration && !durationMinutes) || (!performedAt && !date)) {
      return res.status(400).json({
        error: "Missing required fields: workoutType, duration, performedAt",
      });
    }

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

    const finalDuration = duration || durationMinutes || 0;
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
        exercises,
        notes || null,
        finalPerformedAt,
      ]
    );

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

    if (date) {
      query += ` AND DATE(performed_at) = $2`;
      params.push(date);
    } else {
      query += ` AND performed_at >= NOW() - INTERVAL '1 day'`;
    }

    query += ` ORDER BY performed_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
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
    } = req.body;

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

    // 處理 exercises JSON
    if (exerciseName !== undefined || sets !== undefined || reps !== undefined || weight !== undefined) {
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

