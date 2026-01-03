import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 獲取當前文件的絕對路徑
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加載環境變量（與 server/index.ts 和 server/db.ts 保持一致）
dotenv.config({ path: path.resolve(__dirname, 'server', '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Please check your .env file.');
}

export default defineConfig({
  schema: './server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
