import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import { pool } from "../db";

// 獲取當前文件的絕對路徑
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const migrationFile = path.resolve(__dirname, "migrations", "20260103_220750_create_email_logs.sql");
  
  console.log("📄 Reading migration file:", migrationFile);
  const sql = readFileSync(migrationFile, "utf-8");
  
  console.log("🔌 Connecting to database...");
  
  try {
    const client = await pool.connect();
    console.log("✅ Connected to database");
    
    console.log("🚀 Executing migration...");
    await client.query(sql);
    
    console.log("✅ Migration completed successfully!");
    
    // 驗證表是否創建成功
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'email_logs'
    `);
    
    if (result.rows.length > 0) {
      console.log("✅ email_logs table created successfully!");
      
      // 顯示表結構
      const columns = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'email_logs'
        ORDER BY ordinal_position
      `);
      
      console.log("\n📊 Table structure:");
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default || 'none'})`);
      });
    } else {
      console.log("⚠️  Warning: email_logs table not found after migration");
    }
    
    client.release();
  } catch (error: any) {
    console.error("❌ Migration failed:", error.message);
    if (error.code) {
      console.error("   Error code:", error.code);
    }
    if (error.detail) {
      console.error("   Detail:", error.detail);
    }
    throw error;
  }
}

runMigration()
  .then(() => {
    console.log("\n✨ Migration script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Migration script failed:", error);
    process.exit(1);
  });

