import "dotenv/config";
import { pool } from "./db";

/**
 * Migration script to add serving size columns to the meals table
 * 
 * This migration adds the following columns:
 * - serving_size: Base serving size from database (g/ml)
 * - serving_size_unit: Unit of measurement ("g" or "ml")
 * - user_serving_amount: User's actual serving amount (g/ml)
 */
async function migrate() {
  try {
    console.log("Starting migration: Adding serving size columns to meals table...");
    
    // Add serving_size column if it doesn't exist
    console.log("Adding serving_size column...");
    await pool.query(`
      ALTER TABLE meals 
      ADD COLUMN IF NOT EXISTS serving_size NUMERIC(10, 2)
    `);
    console.log("✓ serving_size column added");
    
    // Add serving_size_unit column if it doesn't exist
    console.log("Adding serving_size_unit column...");
    await pool.query(`
      ALTER TABLE meals 
      ADD COLUMN IF NOT EXISTS serving_size_unit VARCHAR(10)
    `);
    console.log("✓ serving_size_unit column added");
    
    // Add user_serving_amount column if it doesn't exist
    console.log("Adding user_serving_amount column...");
    await pool.query(`
      ALTER TABLE meals 
      ADD COLUMN IF NOT EXISTS user_serving_amount NUMERIC(10, 2)
    `);
    console.log("✓ user_serving_amount column added");
    
    console.log("\n✅ Migration completed successfully!");
    console.log("All serving size columns have been added to the meals table.");
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    await pool.end();
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrate();
}

export { migrate };

