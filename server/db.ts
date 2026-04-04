import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./db/schema";
import { config } from "./config/env";

/**
 * 遠端 PostgreSQL（如 Neon）需 TLS；本機開發不強制加參數。
 * 若 URL 尚未帶 sslmode，則補上 sslmode=require。
 */
function ensureSslModeRequire(url: string): string {
  if (!url) return url;
  const isLocal =
    /\/\/(localhost|127\.0\.0\.1)(?::\d+)?\//i.test(url) ||
    /@localhost(?::\d+)?\//i.test(url);
  if (isLocal) return url;
  if (/[?&]sslmode=/i.test(url)) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}sslmode=require`;
}

// 驗證數據庫 URL
if (!config.database.url) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const databaseUrl = ensureSslModeRequire(config.database.url);

export const pool = new Pool({
  connectionString: databaseUrl,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("PG pool error on idle client:", err);
});

export const db = drizzle({ client: pool, schema });

// Test connection
pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("✗ Database connection failed:", err.message);
  } else {
    console.log("✓ Database connected successfully");
  }
});
