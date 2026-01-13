import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./db/schema";
import { config } from "./config/env";

// 驗證數據庫 URL
if (!config.database.url) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: config.database.url 
});

export const db = drizzle({ client: pool, schema });

// Test connection
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('✗ Database connection failed:', err.message);
  } else {
    console.log('✓ Database connected successfully');
  }
});

