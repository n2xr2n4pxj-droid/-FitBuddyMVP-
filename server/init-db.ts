import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function initDatabase() {
  console.log("開始初始化數據庫...");
  
  try {
    // 創建 sessions 表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid VARCHAR PRIMARY KEY,
        sess JSONB NOT NULL,
        expire TIMESTAMP NOT NULL
      );
    `);
    console.log("✅ sessions 表已創建");

    // 創建 sessions 表的索引
    await pool.query(`
      CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions(expire);
    `);
    console.log("✅ sessions 索引已創建");

    // 創建 users 表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR UNIQUE,
        password_hash VARCHAR,
        first_name VARCHAR,
        last_name VARCHAR,
        profile_image_url VARCHAR,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        gender VARCHAR(20),
        age INTEGER,
        height_cm NUMERIC(10, 2),
        current_weight_kg NUMERIC(10, 2),
        body_fat_percentage NUMERIC(5, 2),
        activity_level VARCHAR(20),
        bmr NUMERIC(10, 2),
        tdee NUMERIC(10, 2),
        goal_type VARCHAR(20),
        goal_calories INTEGER,
        protein_g INTEGER,
        carbs_g INTEGER,
        fat_g INTEGER,
        last_tdee_update TIMESTAMP
      );
    `);
    console.log("✅ users 表已創建");

    // 創建 meals 表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS meals (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        food_name TEXT NOT NULL,
        calories NUMERIC(10, 2) NOT NULL,
        protein NUMERIC(10, 2),
        carbs NUMERIC(10, 2),
        fat NUMERIC(10, 2),
        meal_type VARCHAR(50) NOT NULL,
        date TIMESTAMP NOT NULL,
        serving_size NUMERIC(10, 2),
        serving_size_unit VARCHAR(10),
        user_serving_amount NUMERIC(10, 2),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ meals 表已創建");

    // 創建 meals 表的索引
    await pool.query(`
      CREATE INDEX IF NOT EXISTS meals_user_id_idx ON meals(user_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS meals_date_idx ON meals(date);
    `);
    console.log("✅ meals 索引已創建");

    // 創建 workouts 表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workouts (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workout_type VARCHAR(100) NOT NULL,
        duration_minutes INTEGER NOT NULL,
        date TIMESTAMP NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ workouts 表已創建");

    // 創建 workouts 表的索引
    await pool.query(`
      CREATE INDEX IF NOT EXISTS workouts_user_id_idx ON workouts(user_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS workouts_date_idx ON workouts(date);
    `);
    console.log("✅ workouts 索引已創建");

    // 創建 tdee_history 表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tdee_history (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date TIMESTAMP NOT NULL DEFAULT NOW(),
        weight_kg NUMERIC(10, 2) NOT NULL,
        body_fat_percentage NUMERIC(5, 2),
        activity_level VARCHAR(20) NOT NULL,
        bmr NUMERIC(10, 2) NOT NULL,
        tdee NUMERIC(10, 2) NOT NULL,
        goal_calories INTEGER NOT NULL,
        protein_g INTEGER NOT NULL,
        carbs_g INTEGER NOT NULL,
        fat_g INTEGER NOT NULL,
        notes TEXT
      );
    `);
    console.log("✅ tdee_history 表已創建");

    // 創建 tdee_history 表的索引
    await pool.query(`
      CREATE INDEX IF NOT EXISTS tdee_history_user_id_idx ON tdee_history(user_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS tdee_history_date_idx ON tdee_history(date);
    `);
    console.log("✅ tdee_history 索引已創建");

    console.log("\n🎉 數據庫初始化完成！所有表已成功創建。");
    console.log("\n已創建的表：");
    console.log("  - sessions (會話存儲)");
    console.log("  - users (用戶)");
    console.log("  - meals (餐點)");
    console.log("  - workouts (運動)");
    console.log("  - tdee_history (TDEE 歷史記錄)");

  } catch (error) {
    console.error("❌ 數據庫初始化失敗:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

initDatabase();

